// Integration tests of the real handler + createInsforgeStore against REAL PostgreSQL tables, constraints, triggers and the
// FINAL RLS/reader SQL (mcp/proposals/rls-hardening/final). SIMULATED parts: the PostgREST/InsForge layer is replaced by
// tests/pg-db.ts, and the service credential is the superuser. These tests prove the store's queries, compare-and-set on the
// trigger-maintained updated_at, append-with-retry on the unique position, draft isolation against the real reader function,
// and the closed mcp_tokens table. They do NOT prove anything about InsForge's API, roles or auth.
// Needs a disposable PostgreSQL on 127.0.0.1 (PGPORT, default 54329, user postgres, trust auth).
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1.0.13";
import pg from "npm:pg@8.13.1";
import { createHandler, createInsforgeStore, RateLimiter, readerText, sha256Hex, type Deps } from "../handler.ts";
import { PgDb } from "./pg-db.ts";

const port = Number(Deno.env.get("PGPORT") ?? "54329");
const host = "127.0.0.1";
if (host !== "127.0.0.1") throw new Error("only a local disposable PostgreSQL may be used");
const dbName = "mcp_e2e_" + crypto.randomUUID().slice(0, 8).replaceAll("-", "");
const admin = new pg.Client({ host, port, user: "postgres", database: "postgres" });
await admin.connect();
await admin.query(`create database ${dbName}`);
const pool = new pg.Pool({ host, port, user: "postgres", database: dbName, max: 8 });
const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));
await pool.query(read("../../proposals/rls-hardening/sandbox/schema.sql"));
// the full target state: hardening incl. the legacy freeze and the strict reader rule, then the MCP tables
for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "02b_legacy_step_freeze.sql", "03_policy_switch.sql", "04_helper_guard.sql", "07_strict_reader_rule.sql"]) await pool.query(read(`../../proposals/rls-hardening/final/${f}`));
await pool.query(read("../sql/001_mcp_tokens.sql"));
await pool.query(read("../sql/002_mcp_ops.sql"));

const U = { owner: "c0000000-0000-0000-0000-000000000001", editor: "c0000000-0000-0000-0000-000000000002", reviewer: "c0000000-0000-0000-0000-000000000003", viewer: "c0000000-0000-0000-0000-000000000004", stranger: "c0000000-0000-0000-0000-000000000005" };
const B = { pub: "b0000000-0000-0000-0000-000000000001", other: "b0000000-0000-0000-0000-000000000002", arch: "b0000000-0000-0000-0000-000000000003" };
const P = { a: "f0000000-0000-0000-0000-00000000000a", other: "f0000000-0000-0000-0000-00000000000b", arch: "f0000000-0000-0000-0000-00000000000c" };
const S = { pub: "50000000-0000-0000-0000-000000000001", draft: "50000000-0000-0000-0000-000000000002", other: "50000000-0000-0000-0000-000000000003" };
for (const [k, id] of Object.entries(U)) { await pool.query("insert into auth.users(id,email) values ($1,$2)", [id, `${k}@x.invalid`]); await pool.query("insert into users(id,name) values ($1,$2)", [id, k]); }
const book = (id: string, title: string, status: string, access: string, owner: string) => pool.query("insert into books(id,title,slug,publication_status,access_level,created_by) values ($1,$2,$2,$3,$4,$5)", [id, title, status, access, owner]);
await book(B.pub, "pub", "PUBLISHED", "PUBLIC", U.owner); await book(B.other, "other", "DRAFT", "PRIVATE", U.stranger); await book(B.arch, "arch", "ARCHIVED", "PUBLIC", U.owner);
for (const [who, role] of [["editor", "EDITOR"], ["reviewer", "REVIEWER"], ["viewer", "VIEWER"]]) await pool.query("insert into book_members(book_id,user_id,role) values ($1,$2,$3)", [B.pub, U[who as keyof typeof U], role]);
for (const [id, b] of [[P.a, B.pub], [P.other, B.other], [P.arch, B.arch]]) await pool.query("insert into phases(id,book_id,title,position) values ($1,$2,'Phase',1)", [id, b]);
const stepSql = "insert into steps(id,phase_id,title,position,content) values ($1,$2,$3,$4,$5::jsonb)";
await pool.query(stepSql, [S.pub, P.a, "Published step", 1, JSON.stringify({ slug: "published-step", status: "Published", markdown: "NEWER_DRAFT_EDIT", publishedMarkdown: "PUBLISHED_TEXT", custom: { keep: [1, 2] } })]);
await pool.query(stepSql, [S.draft, P.a, "Draft step", 2, JSON.stringify({ slug: "draft-step", status: "Draft", markdown: "DRAFT_ONLY_TEXT" })]);
await pool.query(stepSql, [S.other, P.other, "Others step", 1, JSON.stringify({ slug: "o", status: "Published", markdown: "OTHERS_PRIVATE", publishedMarkdown: "OTHERS_PRIVATE" })]);

let tokenSeq = 0;
const rnd = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "").slice(0, n); };
async function token(user: string, scopes = ["read", "draft", "publish"], extra = "") {
  const raw = `dbk_${rnd(8)}_${rnd(43)}`;
  await pool.query(`insert into mcp_tokens(user_id,token_prefix,token_hash,label,scopes ${extra ? ",expires_at" : ""}) values ($1,$2,$3,$4,$5::text[] ${extra ? ",$6" : ""})`,
    extra ? [user, raw.slice(4, 12), await sha256Hex(raw), `t${++tokenSeq}`, scopes, extra] : [user, raw.slice(4, 12), await sha256Hex(raw), `t${++tokenSeq}`, scopes]);
  return raw;
}
const tok = {} as Record<keyof typeof U, string>;
for (const k of Object.keys(U) as (keyof typeof U)[]) tok[k] = await token(U[k]);

const logs: string[] = [];
const key = crypto.getRandomValues(new Uint8Array(32));
const deps: Deps = { store: createInsforgeStore(new PgDb(pool)), now: () => Date.now(), confirmKey: key, writeToolsEnabled: true, publishToolEnabled: true, audit: (l) => logs.push(l), limiter: new RateLimiter(() => Date.now(), { read: 1e6, write: 1e6 }) };
const handler = createHandler(() => deps);
let rid = 0;
async function rpc(token: string | null, method: string, params: unknown = {}) {
  const res = await handler(new Request("http://local/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rid, method, params }) }));
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}
async function tool(token: string, name: string, args: unknown = {}) {
  const r = await rpc(token, "tools/call", { name, arguments: args });
  assertEquals(r.status, 200, r.text);
  return { ...r.json.result, data: r.json.result.structuredContent, text: r.text };
}
const code = (r: { data: { error?: { code: string } } }) => r.data.error?.code;
// deno-lint-ignore no-explicit-any
async function sql(q: string, params: unknown[] = []): Promise<any[]> { return (await pool.query(q, params)).rows; }
// the REAL reader function, as a given actor (or anonymous), under RLS
async function readerTree(actor: keyof typeof U | null, bookId: string, drafts: boolean) {
  const c = new pg.Client({ host, port, user: "postgres", database: dbName }); await c.connect();
  try {
    await c.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ? U[actor] : ""]);
    await c.query(actor ? "set role authenticated" : "set role anon");
    return (await c.query("select reader_book_tree($1::uuid,$2::boolean) t", [bookId, drafts])).rows[0].t;
  } finally { await c.end(); }
}
const stepIds = (t: { phases: { steps: { id: string }[] }[] } | null) => (t ? t.phases.flatMap((p) => p.steps.map((s) => s.id)).sort() : null);
const opts = { sanitizeResources: false, sanitizeOps: false };

Deno.test({ name: "pg: token table is closed to anon/authenticated and enforces its constraints", ...opts, fn: async () => {
  for (const role of ["anon", "authenticated"]) {
    const c = new pg.Client({ host, port, user: "postgres", database: dbName }); await c.connect();
    await c.query(`set role ${role}`);
    let denied = 0;
    for (const q of ["select * from mcp_tokens", "insert into mcp_tokens(user_id,token_prefix,token_hash,label) values ('c0000000-0000-0000-0000-000000000001','abcdefgh',repeat('a',64),'x')", "update mcp_tokens set revoked_at = null", "delete from mcp_tokens"]) {
      try { await c.query(q); } catch (e) { if (/permission denied/.test(String((e as Error).message))) denied++; }
    }
    await c.end();
    assertEquals(denied, 4, role);
  }
  for (const bad of ["insert into mcp_tokens(user_id,token_prefix,token_hash,label) values ('c0000000-0000-0000-0000-000000000001','abcdefgh','NOTHEX','x')", "insert into mcp_tokens(user_id,token_prefix,token_hash,label,scopes) values ('c0000000-0000-0000-0000-000000000001','abcdefgh',repeat('b',64),'x',array['admin'])", "insert into mcp_tokens(user_id,token_prefix,token_hash,label,expires_at) values ('c0000000-0000-0000-0000-000000000001','abcdefgh',repeat('c',64),'x', now() + interval '400 days')"]) {
    let failed = false; try { await pool.query(bad); } catch { failed = true; }
    assert(failed, bad.slice(0, 80));
  }
  // deleting the user removes their tokens
  await pool.query("insert into auth.users(id,email) values ('c0000000-0000-0000-0000-0000000000ee','tmp@x.invalid')");
  const t = await token("c0000000-0000-0000-0000-0000000000ee");
  assertEquals((await rpc(t, "tools/list")).status, 200);
  await pool.query("delete from auth.users where id = 'c0000000-0000-0000-0000-0000000000ee'");
  assertEquals((await rpc(t, "tools/list")).status, 401);
} });

Deno.test({ name: "pg: authentication through the real table; revoke and expiry take effect on the next request", ...opts, fn: async () => {
  assertEquals((await rpc(tok.owner, "tools/list")).status, 200);
  const expired = await token(U.owner, ["read"], new Date(Date.now() + 86_400_000).toISOString()); // valid now (relative date, not a fixed one), then force expiry below
  assertEquals((await rpc(expired, "tools/list")).status, 200);
  await pool.query("update mcp_tokens set expires_at = now() - interval '1 second', created_at = now() - interval '2 days' where token_hash = $1", [await sha256Hex(expired)]);
  assertEquals((await rpc(expired, "tools/list")).status, 401);
  const rev = await token(U.owner);
  assertEquals((await rpc(rev, "tools/list")).status, 200);
  await pool.query("update mcp_tokens set revoked_at = now() where token_hash = $1", [await sha256Hex(rev)]);
  assertEquals((await rpc(rev, "tools/list")).status, 401);
  const used = await sql("select last_used_at from mcp_tokens where token_hash = $1", [await sha256Hex(tok.owner)]);
  assert(used[0].last_used_at !== null, "last_used_at touched");
} });

Deno.test({ name: "pg: reads match the real reader function for every role, and other users' data is unreachable", ...opts, fn: async () => {
  // what each role sees through MCP == what the SQL reader function returns for that role
  for (const who of ["owner", "editor", "reviewer", "viewer"] as const) {
    const mcp = await tool(tok[who], "get_book_structure", { book_id: B.pub });
    const mcpIds = mcp.data.phases.flatMap((p: { steps: { id: string }[] }) => p.steps.map((s) => s.id)).sort();
    assertEquals(mcpIds, stepIds(await readerTree(who, B.pub, true)), `${who}: MCP structure vs reader_book_tree(include_drafts=true)`);
  }
  assertEquals(stepIds(await readerTree("viewer", B.pub, true)), [S.pub]); // viewer: published only, even when asking for drafts
  assertEquals(stepIds(await readerTree(null, B.pub, true)), [S.pub]);
  const viewerText = (await tool(tok.viewer, "get_step_content", { step_id: S.pub })).data.markdown;
  assertEquals(viewerText, "PUBLISHED_TEXT");
  assertEquals(code(await tool(tok.viewer, "get_step_content", { step_id: S.draft })), "NOT_FOUND");
  const ed = await tool(tok.editor, "get_step_content", { step_id: S.pub, include_published: true });
  assertEquals([ed.data.markdown, ed.data.published_markdown], ["NEWER_DRAFT_EDIT", "PUBLISHED_TEXT"]);
  // revision strings keep the database's microseconds and round-trip into an equality filter
  const rows = await sql("select to_jsonb(s)->>'updated_at' as u from steps s where id = $1", [S.pub]);
  assertEquals(ed.data.revision, rows[0].u);
  // other users
  for (const t of ["owner", "viewer"] as const) { assertEquals(code(await tool(tok[t], "get_step_content", { step_id: S.other })), "NOT_FOUND"); assertEquals(code(await tool(tok[t], "get_book_metadata", { book_id: B.other })), "NOT_FOUND"); }
  assertEquals((await tool(tok.owner, "search_content", { query: "OTHERS_PRIVATE" })).data.results.length, 0);
  assertEquals((await tool(tok.stranger, "search_books")).data.books.map((b: { id: string }) => b.id), [B.other]);
  // soft deletion hides the book from MCP, even from its owner
  await pool.query("update books set deleted_at = now() where id = $1", [B.arch]);
  assertEquals(code(await tool(tok.owner, "get_book_structure", { book_id: B.arch })), "NOT_FOUND");
  assert(!(await tool(tok.owner, "search_books")).data.books.some((b: { id: string }) => b.id === B.arch));
  await pool.query("update books set deleted_at = null where id = $1", [B.arch]);
} });

Deno.test({ name: "pg: create_phase / create_draft append with real unique positions, even in parallel (retry on 23505)", ...opts, fn: async () => {
  const ph = await tool(tok.editor, "create_phase", { book_id: B.pub, title: "Parallel phase" });
  assertEquals(ph.data.created, true); assertEquals(ph.data.phase.position, 2);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => tool(tok.owner, "create_draft", { phase_id: ph.data.phase.id, title: `Parallel ${i}`, markdown: `m${i} DRAFT_PARALLEL` })));
  const ok = results.filter((r) => r.isError === undefined);
  const positions = (await sql("select position from steps where phase_id = $1 order by position", [ph.data.phase.id])).map((r: { position: number }) => r.position);
  assertEquals(new Set(positions).size, positions.length, "positions must be unique");
  assertEquals(positions.length, ok.length);
  // 10 parallel creates (the recorded TEST-project burst that gave 4/10 with 3 undelayed attempts): all must succeed now
  assertEquals(ok.length, 10, "jittered retries must let every parallel create succeed: " + results.filter((r) => r.isError).map((r) => code(r)).join(","));
  assertEquals(positions, Array.from({ length: 10 }, (_, i) => i + 1));
  const created = await sql("select created_by, content from steps where phase_id = $1 limit 1", [ph.data.phase.id]);
  assertEquals(created[0].created_by, U.owner); assertEquals(created[0].content.status, "Draft");
  // readers (SQL reader function) see none of the new drafts; draft viewers do
  const anon = JSON.stringify(await readerTree(null, B.pub, true)), viewer = JSON.stringify(await readerTree("viewer", B.pub, true));
  assert(!anon.includes("DRAFT_PARALLEL") && !viewer.includes("DRAFT_PARALLEL") && !anon.includes("Parallel phase"));
  assert(JSON.stringify(await readerTree("editor", B.pub, true)).includes("DRAFT_PARALLEL"));
  // the viewer's FTS/search path: draft text is searchable only through draft roles in the table; the reader views never contain it
  const hits = await sql("select count(*)::int n from reader_steps where content::text like '%DRAFT_PARALLEL%'");
  assertEquals(hits[0].n, 0);
} });

Deno.test({ name: "pg: update_draft compare-and-set on the trigger-maintained updated_at (microsecond strings)", ...opts, fn: async () => {
  const read = (await tool(tok.owner, "get_step_content", { step_id: S.draft })).data;
  const others = JSON.stringify(await sql("select id, title, content, updated_at from steps where id <> $1 order by id", [S.draft]));
  const bookRow = JSON.stringify(await sql("select * from books where id = $1", [B.pub]));
  const r = await tool(tok.owner, "update_draft", { step_id: S.draft, expected_revision: read.revision, markdown: "# written via MCP\r\n\tÜñï ✓", change_summary: "c" });
  assertEquals(r.isError, undefined, r.text);
  assertNotEquals(r.data.revision, read.revision);
  const row = (await sql("select content, to_jsonb(s)->>'updated_at' as u from steps s where id = $1", [S.draft]))[0];
  assertEquals(row.u, r.data.revision);
  assertEquals(row.content, { slug: "draft-step", status: "Draft", markdown: "# written via MCP\r\n\tÜñï ✓" });
  assertEquals(JSON.stringify(await sql("select id, title, content, updated_at from steps where id <> $1 order by id", [S.draft])), others);
  assertEquals(JSON.stringify(await sql("select * from books where id = $1", [B.pub])), bookRow);
  // replay and stale writers lose; an "editor autosave" (direct update) in between is detected
  assertEquals(code(await tool(tok.owner, "update_draft", { step_id: S.draft, expected_revision: read.revision, markdown: "stale", change_summary: "c" })), "CONFLICT");
  const rev2 = r.data.revision;
  await pool.query(`update steps set content = jsonb_set(content, '{markdown}', '"browser autosave"') where id = $1`, [S.draft]);
  assertEquals(code(await tool(tok.owner, "update_draft", { step_id: S.draft, expected_revision: rev2, markdown: "mcp after autosave", change_summary: "c" })), "CONFLICT");
  assertEquals((await sql("select content->>'markdown' m from steps where id = $1", [S.draft]))[0].m, "browser autosave");
  // two concurrent writers with the same revision: exactly one wins
  const rev3 = (await tool(tok.owner, "get_step_content", { step_id: S.draft })).data.revision;
  const both = await Promise.all([tok.owner, tok.editor].map((t, i) => tool(t, "update_draft", { step_id: S.draft, expected_revision: rev3, markdown: `racer ${i}`, change_summary: "c" })));
  assertEquals(both.filter((x) => x.isError === undefined).length, 1);
  assertEquals(both.filter((x) => code(x) === "CONFLICT").length, 1);
  // a draft edit never changes what readers get
  assertEquals(stepIds(await readerTree("viewer", B.pub, false)), [S.pub].sort());
  const t = await readerTree(null, B.pub, false);
  assertEquals(t.phases[0].steps[0].markdown, "PUBLISHED_TEXT");
} });

Deno.test({ name: "pg: publish_draft publishes one step and the real reader function then serves it", ...opts, fn: async () => {
  const pv = await tool(tok.owner, "publish_draft", { step_id: S.draft });
  assertEquals(pv.isError, undefined, pv.text);
  const snapshot = JSON.stringify(await sql("select id, content from steps where id <> $1 order by id", [S.draft]));
  const beforeBooks = JSON.stringify(await sql("select * from books order by id"));
  const title = (await sql("select title from steps where id = $1", [S.draft]))[0].title;
  assertEquals(code(await tool(tok.owner, "publish_draft", { step_id: S.draft, confirm: true, confirmation_token: pv.data.confirmation_token, confirm_title: "wrong" })), "CONFIRMATION_INVALID");
  const done = await tool(tok.owner, "publish_draft", { step_id: S.draft, confirm: true, confirmation_token: pv.data.confirmation_token, confirm_title: title });
  assertEquals(done.isError, undefined, done.text);
  const c = (await sql("select content from steps where id = $1", [S.draft]))[0].content;
  assertEquals([c.status, c.publishedMarkdown === c.markdown], ["Published", true]);
  assertEquals(JSON.stringify(await sql("select id, content from steps where id <> $1 order by id", [S.draft])), snapshot);
  assertEquals(JSON.stringify(await sql("select * from books order by id")), beforeBooks);
  const anon = await readerTree(null, B.pub, false);
  assert(stepIds(anon)!.includes(S.draft), "published step now visible to anonymous readers");
  assertEquals(code(await tool(tok.owner, "publish_draft", { step_id: S.draft, confirm: true, confirmation_token: pv.data.confirmation_token, confirm_title: title })), "CONFLICT"); // replay
} });

Deno.test({ name: "pg: archived books are read-only through MCP; backend failure becomes INTERNAL without details", ...opts, fn: async () => {
  assertEquals((await tool(tok.owner, "get_book_structure", { book_id: B.arch })).isError, undefined);
  assertEquals(code(await tool(tok.owner, "create_phase", { book_id: B.arch, title: "no" })), "BOOK_ARCHIVED");
  assertEquals(code(await tool(tok.reviewer, "create_phase", { book_id: B.pub, title: "no" })), "FORBIDDEN_ROLE");
  // break the connection pool: the next data call fails; the response must be generic
  const broken = new pg.Pool({ host, port, user: "postgres", database: "no_such_database_xyz", max: 1 });
  const d2: Deps = { ...deps, store: createInsforgeStore(new PgDb(broken)) };
  const h2 = createHandler(() => d2);
  const res = await h2(new Request("http://local/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok.owner}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
  const body = await res.text();
  assertEquals(res.status, 503); assert(!/no_such_database|ECONN|password|postgres/i.test(body));
  await broken.end().catch(() => {});
  assert(!logs.join("\n").match(/dbk_[A-Za-z0-9_-]{8}_/), "no token in audit logs");
} });

Deno.test({ name: "pg: reader rule parity: handler.ts readerText == SQL reader_markdown over every content shape", ...opts, fn: async () => {
  const pms = [undefined, "P", "", null, 7], sts = [undefined, "Published", "Draft", "Archived", "", null, 42], mds = [undefined, "M", "", null, 3];
  const shapes: { c: Record<string, unknown>; bs: string }[] = [];
  for (const pm of pms) for (const st of sts) for (const md of mds) for (const bs of ["PUBLISHED", "DRAFT", "ARCHIVED"]) {
    const c: Record<string, unknown> = {};
    if (pm !== undefined) c.publishedMarkdown = pm;
    if (st !== undefined) c.status = st;
    if (md !== undefined) c.markdown = md;
    shapes.push({ c, bs });
  }
  const rows = await sql("select e.i, reader_markdown(e.v -> 'c', (e.v ->> 'bs')::publication_status) r from jsonb_array_elements($1::jsonb) with ordinality e(v, i) order by e.i", [JSON.stringify(shapes)]);
  assertEquals(rows.length, 525);
  for (const row of rows) { const s = shapes[Number(row.i) - 1]; assertEquals(row.r, readerText(s.c, s.bs), JSON.stringify(s)); }
} });

Deno.test({ name: "pg: update_draft refuses legacy steps; with 07 they are invisible to readers before and after (real reader function)", ...opts, fn: async () => {
  const ph = (await tool(tok.owner, "create_phase", { book_id: B.pub, title: "Legacy phase" })).data.phase.id;
  const legacy = { pub: "50000000-0000-0000-0000-0000000000a1", none: "50000000-0000-0000-0000-0000000000a2" };
  await pool.query(stepSql, [legacy.pub, ph, "Legacy published", 1, JSON.stringify({ status: "Published", markdown: "OLD_LEGACY_PUB" })]);
  await pool.query(stepSql, [legacy.none, ph, "Legacy no status", 2, JSON.stringify({ markdown: "OLD_LEGACY_NONE" })]);
  const before = JSON.stringify(await readerTree(null, B.pub, false));
  assert(!before.includes("OLD_LEGACY"), "strict rule: unfrozen legacy text is not served to readers");
  for (const id of [legacy.pub, legacy.none]) {
    const row = JSON.stringify(await sql("select content, updated_at from steps where id = $1", [id]));
    const rev = (await tool(tok.editor, "get_step_content", { step_id: id })).data.revision;
    assertEquals(code(await tool(tok.editor, "update_draft", { step_id: id, expected_revision: rev, markdown: "NEW_LEGACY_DRAFT", change_summary: "c" })), "LEGACY_STEP");
    assertEquals(JSON.stringify(await sql("select content, updated_at from steps where id = $1", [id])), row, "nothing written");
  }
  assertEquals(JSON.stringify(await readerTree(null, B.pub, false)), before);
  // 07's precondition refuses to run while such rows exist, so a re-run in this state must fail and change nothing
  let rerun = false;
  try { await pool.query(read("../../proposals/rls-hardening/final/07_strict_reader_rule.sql")); rerun = true; } catch { /* expected */ }
  assert(!rerun, "07 precondition must refuse while reader-visible-by-fallback rows exist");
  await pool.query("delete from steps where id = any($1::uuid[])", [[legacy.pub, legacy.none]]);
} });

Deno.test({ name: "pg: shared rate limit (mcp_rate_take) is atomic across concurrent callers and closed to the browser roles", ...opts, fn: async () => {
  const store = createInsforgeStore(new PgDb(pool));
  const tokenId = (await sql("select id from mcp_tokens where user_id = $1 limit 1", [U.viewer]))[0].id;
  const results = await Promise.all(Array.from({ length: 25 }, () => store.rateTake!(tokenId, "publish", 10, 3600)));
  assertEquals(results.filter(Boolean).length, 10, "exactly the limit may pass, whatever the interleaving");
  for (const role of ["anon", "authenticated"]) {
    const c = new pg.Client({ host, port, user: "postgres", database: dbName });
    await c.connect();
    try {
      await c.query(`set role ${role}`);
      let called = false, readTable = false;
      try { await c.query("select public.mcp_rate_take($1::uuid, 'read', 5, 60)", [tokenId]); called = true; } catch { /* expected */ }
      try { await c.query("select count(*) from public.mcp_rate_limits"); readTable = true; } catch { /* expected */ }
      try { await c.query("select count(*) from public.mcp_audit_events"); readTable = true; } catch { /* expected */ }
      assert(!called && !readTable, `${role} must not use the limiter or read the ops tables`);
    } finally { await c.end(); }
  }
} });

Deno.test({ name: "pg: durable audit rows for write calls (allowed and refused), ids and hashes only", ...opts, fn: async () => {
  const d3: Deps = { ...deps, store: createInsforgeStore(new PgDb(pool)), durableAudit: true, durableLimits: true };
  const h3 = createHandler(() => d3);
  const call = async (token: string, name: string, args: unknown) => {
    const res = await h3(new Request("http://local/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }));
    return { requestId: res.headers.get("x-request-id"), body: await res.json() };
  };
  const a = await call(tok.editor, "create_phase", { book_id: B.pub, title: "Audited phase AUDIT_TITLE" });
  const b = await call(tok.viewer, "create_phase", { book_id: B.pub, title: "refused" });
  const rows = await sql("select request_id::text, tool, outcome, book_id::text, content_sha256 from mcp_audit_events where request_id = any($1::uuid[]) order by at", [[a.requestId, b.requestId]]);
  assertEquals(rows.map((r: { tool: string; outcome: string }) => [r.tool, r.outcome]), [["create_phase", "ok"], ["create_phase", "FORBIDDEN_ROLE"]]);
  assertEquals(rows[0].book_id, B.pub);
  assert(!JSON.stringify(await sql("select * from mcp_audit_events")).includes("AUDIT_TITLE"), "no titles in the audit table");
} });

Deno.test({ name: "pg: paging past 1000 steps keeps every visible step and never shows drafts to a viewer", ...opts, fn: async () => {
  const ph = (await tool(tok.owner, "create_phase", { book_id: B.pub, title: "Big phase" })).data.phase.id;
  // 1205 steps: every 3rd one published (publishedMarkdown), the rest drafts
  await pool.query(`insert into steps(phase_id, title, position, content)
    select $1::uuid, 'bulk ' || g, g,
           case when g % 3 = 0 then jsonb_build_object('status', 'Published', 'markdown', 'BULK_PUB', 'publishedMarkdown', 'BULK_PUB')
                else jsonb_build_object('status', 'Draft', 'markdown', 'BULK_DRAFT_SECRET') end
      from generate_series(1, 1205) g`, [ph]);
  const countIn = (t: { data: { phases: { id: string; steps: unknown[] }[] } }) => t.data.phases.find((p) => p.id === ph)?.steps.length ?? 0;
  assertEquals(countIn(await tool(tok.owner, "get_book_structure", { book_id: B.pub })), 1205, "all steps across the 1000-row page boundary");
  assertEquals(countIn(await tool(tok.viewer, "get_book_structure", { book_id: B.pub })), 401, "only the published ones (floor(1205/3))");
  const tree = await readerTree("viewer", B.pub, true);
  const treePhase = (tree as { phases: { id: string; steps: unknown[] }[] }).phases.find((p) => p.id === ph);
  assertEquals(treePhase?.steps.length, 401, "the SQL reader function agrees");
  assert(!JSON.stringify(tree).includes("BULK_DRAFT_SECRET"));
  assertEquals((await tool(tok.viewer, "search_content", { query: "BULK_DRAFT_SECRET" })).data.results.length, 0);
  await pool.query("delete from phases where id = $1", [ph]);
} });


Deno.test({ name: "pg: cleanup", ...opts, fn: async () => {
  await pool.end();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
} });
