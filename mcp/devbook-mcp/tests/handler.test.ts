// Local tests for the DevBook MCP handler against an in-memory store. SIMULATED: no InsForge, no network, no real database.
// Run: deno test --allow-net=127.0.0.1 --allow-env --allow-read=./handler.ts,./sql,../proposals/rls-hardening/final tests/
import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { APPEND_RETRY_DEFAULTS, DURABLE_LIMITS, legacyReaderText, authenticate, availableTools, callTool, createHandler, createInsforgeStore, isAmbiguousLegacyStep, makeConfirmation, RateLimiter, readerText, sha256Hex, StoreError, type Deps, type Principal } from "../handler.ts";
import { isReaderVisible, readerMarkdown } from "../../proposals/reader-leak-fix/reader-visibility.ts";
import { FakeStore } from "./fake-store.ts";

// ---------------------------------------------------------------- fixture
const U = { owner: "00000000-0000-4000-8000-0000000000a1", editor: "00000000-0000-4000-8000-0000000000a2", reviewer: "00000000-0000-4000-8000-0000000000a3", viewer: "00000000-0000-4000-8000-0000000000a4", stranger: "00000000-0000-4000-8000-0000000000a5" };
const ID = {
  bk1: "00000000-0000-4000-8000-0000000000b1", bk2: "00000000-0000-4000-8000-0000000000b2", bkArch: "00000000-0000-4000-8000-0000000000b3", bkDel: "00000000-0000-4000-8000-0000000000b4",
  ph1: "00000000-0000-4000-8000-0000000000c1", ph2: "00000000-0000-4000-8000-0000000000c2", phArch: "00000000-0000-4000-8000-0000000000c3", phDel: "00000000-0000-4000-8000-0000000000c4",
  s1: "00000000-0000-4000-8000-0000000000d1", s2: "00000000-0000-4000-8000-0000000000d2", s3: "00000000-0000-4000-8000-0000000000d3", sOther: "00000000-0000-4000-8000-0000000000d4", sArch: "00000000-0000-4000-8000-0000000000d5", sDel: "00000000-0000-4000-8000-0000000000d6",
};
const DRAFT_CANARY = "DRAFT_CANARY_7f3a";
const PUB_TEXT = "PUBLISHED_TEXT_ok";
const PRIVATE_CANARY = "OTHER_USERS_PRIVATE_CANARY_91bc";
const BACKEND_CANARY = "BACKEND_SECRET_CANARY_5d2e";

const rnd = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "").slice(0, n); };
async function mkToken(store: FakeStore, userId: string, o: { scopes?: string[]; expires?: string; revoked?: string | null } = {}) {
  const raw = `dbk_${rnd(8)}_${rnd(43)}`;
  store.addToken(await sha256Hex(raw), { id: crypto.randomUUID(), user_id: userId, scopes: o.scopes ?? ["read", "draft"], expires_at: o.expires ?? "2027-01-01T00:00:00Z", revoked_at: o.revoked ?? null, last_used_at: null });
  return raw;
}

type Env = { store: FakeStore; deps: Deps; logs: string[]; handler: (r: Request) => Promise<Response>; now: { t: number }; tok: Record<keyof typeof U, string>; key: Uint8Array };
async function setup(o: { write?: boolean; publish?: boolean; key?: boolean; scopes?: string[]; realLimits?: boolean } = {}): Promise<Env> {
  const store = new FakeStore();
  const now = { t: Date.parse("2026-10-18T12:00:00Z") };
  const logs: string[] = [];
  const key = crypto.getRandomValues(new Uint8Array(32));
  const deps: Deps = { store, now: () => now.t, confirmKey: o.key === false ? null : key, writeToolsEnabled: o.write ?? true, publishToolEnabled: o.publish ?? true, audit: (l) => logs.push(l), limiter: o.realLimits ? new RateLimiter(() => now.t) : new RateLimiter(() => now.t, { read: 1e6, write: 1e6 }) };
  store.addBook({ id: ID.bk1, title: "Book One", publication_status: "PUBLISHED", access_level: "PUBLIC", tags: ["db"] }, [[U.owner, "OWNER"], [U.editor, "EDITOR"], [U.reviewer, "REVIEWER"], [U.viewer, "VIEWER"]]);
  store.addBook({ id: ID.bk2, title: "Strangers Book", publication_status: "DRAFT", access_level: "PRIVATE" }, [[U.stranger, "OWNER"]]);
  store.addBook({ id: ID.bkArch, title: "Archived", publication_status: "ARCHIVED" }, [[U.owner, "OWNER"], [U.editor, "EDITOR"]]);
  store.addBook({ id: ID.bkDel, title: "Deleted", deleted_at: "2026-01-01T00:00:00Z" }, [[U.owner, "OWNER"], [U.editor, "EDITOR"]]);
  store.addPhase(ID.ph1, ID.bk1, "Phase One"); store.addPhase(ID.ph2, ID.bk2, "Strangers phase"); store.addPhase(ID.phArch, ID.bkArch, "Arch phase"); store.addPhase(ID.phDel, ID.bkDel, "Del phase");
  store.addStep(ID.s1, ID.ph1, "Published step", 1, { slug: "published-step", status: "Published", markdown: `newer unpublished edit ${DRAFT_CANARY}`, publishedMarkdown: PUB_TEXT, description: "d", difficulty: "Intermediate", estimatedTime: 7, visibility: "Public", custom: { keep: true } });
  store.addStep(ID.s2, ID.ph1, "Draft only step", 2, { slug: "draft-only", status: "Draft", markdown: `secret draft ${DRAFT_CANARY}`, visibility: "Public" });
  store.addStep(ID.s3, ID.ph1, "Legacy step", 3, { markdown: "legacy text" });
  store.addStep(ID.sOther, ID.ph2, "Other users step", 1, { slug: "x", status: "Published", markdown: PRIVATE_CANARY, publishedMarkdown: PRIVATE_CANARY });
  store.addStep(ID.sArch, ID.phArch, "Arch step", 1, { slug: "arch", status: "Draft", markdown: "a" });
  store.addStep(ID.sDel, ID.phDel, "Del step", 1, { slug: "del", status: "Draft", markdown: "d" });
  const tok = {} as Env["tok"];
  for (const k of Object.keys(U) as (keyof typeof U)[]) tok[k] = await mkToken(store, U[k], { scopes: o.scopes ?? ["read", "draft", "publish"] });
  return { store, deps, logs, handler: createHandler(() => deps), now, tok, key };
}

const H = { "content-type": "application/json", accept: "application/json, text/event-stream" };
function req(token: string | null, body: unknown, extra: Record<string, string> = {}, method = "POST") {
  return new Request("http://local/mcp", { method, headers: { ...H, ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}
let rid = 0;
async function rpc(env: Env, token: string | null, method: string, params: unknown = {}) {
  const res = await env.handler(req(token, { jsonrpc: "2.0", id: ++rid, method, params }));
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers };
}
async function tool(env: Env, token: string, name: string, args: unknown = {}) {
  const r = await rpc(env, token, "tools/call", { name, arguments: args });
  assertEquals(r.status, 200, r.text);
  const result = r.json.result;
  assert(result, r.text);
  return { ...result, data: result.structuredContent, text: r.text };
}
const code = (r: { data: { error?: { code: string } } }) => r.data.error?.code;

// ---------------------------------------------------------------- HTTP + authentication
Deno.test("auth: missing, malformed, unknown, expired, revoked and scope-less tokens all get the identical 401", async () => {
  const env = await setup();
  const expired = await mkToken(env.store, U.owner, { expires: "2026-10-01T00:00:00Z" });
  const revoked = await mkToken(env.store, U.owner, { revoked: "2026-10-02T00:00:00Z" });
  const noScope = await mkToken(env.store, U.owner, { scopes: ["admin", "x"] });
  const unknown = `dbk_${rnd(8)}_${rnd(43)}`;
  const bodies = new Set<string>();
  for (const t of [null, "garbage", "dbk_short", unknown, expired, revoked, noScope]) {
    const r = await rpc(env, t, "tools/list");
    assertEquals(r.status, 401, String(t));
    assertEquals(r.headers.get("www-authenticate"), 'Bearer realm="devbook-mcp"');
    bodies.add(r.text);
  }
  assertEquals(bodies.size, 1, "all rejection bodies must be identical");
  const bad = await env.handler(new Request("http://local/mcp", { method: "POST", headers: { ...H, authorization: "Basic abc" }, body: "{}" }));
  assertEquals(bad.status, 401);
  // a token in the query string is never read
  const q = await env.handler(new Request(`http://local/mcp?token=${env.tok.owner}`, { method: "POST", headers: H, body: "{}" }));
  assertEquals(q.status, 401);
});
Deno.test("auth: a valid token authenticates; last_used_at is touched at most every 5 minutes", async () => {
  const env = await setup();
  const touches: string[] = [];
  const orig = env.store.touchToken.bind(env.store);
  env.store.touchToken = (id, at) => { touches.push(at); return orig(id, at); };
  for (let i = 0; i < 3; i++) assertEquals((await rpc(env, env.tok.owner, "tools/list")).status, 200);
  assertEquals(touches.length, 1);
  env.now.t += 6 * 60 * 1000;
  await rpc(env, env.tok.owner, "tools/list");
  assertEquals(touches.length, 2);
});
Deno.test("http: method, origin, content-type, size, JSON and backend-outage handling", async () => {
  const env = await setup();
  assertEquals((await env.handler(req(env.tok.owner, "", {}, "GET"))).status, 405);
  assertEquals((await env.handler(new Request("http://local/mcp", { method: "DELETE", headers: { authorization: `Bearer ${env.tok.owner}` } }))).status, 405);
  assertEquals((await env.handler(req(env.tok.owner, {}, { origin: "https://evil.example" }))).status, 403);
  assertEquals((await env.handler(req(env.tok.owner, {}, { "content-type": "text/plain" }))).status, 415);
  const big = JSON.stringify({ pad: "x".repeat(300 * 1024) });
  assertEquals((await env.handler(req(env.tok.owner, big))).status, 413);
  assertEquals((await env.handler(req(env.tok.owner, "{nope"))).status, 400);
  assertEquals((await env.handler(new Request("http://local/mcp", { method: "POST", headers: { ...H, authorization: `Bearer ${env.tok.owner}` }, body: new Uint8Array([0x7b, 0xff, 0x7d]) }))).status, 400);
  // chunked body without content-length is capped too
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{\"a\":\"" + "x".repeat(200 * 1024))); c.enqueue(new TextEncoder().encode("y".repeat(200 * 1024) + "\"}")); c.close(); } });
  assertEquals((await env.handler(new Request("http://local/mcp", { method: "POST", headers: { ...H, authorization: `Bearer ${env.tok.owner}` }, body: stream, duplex: "half" } as RequestInit))).status, 413);
  // auth backend down: 503, never 200 and never a misleading 401
  env.store.failWith = new Error(BACKEND_CANARY);
  const down = await rpc(env, env.tok.owner, "tools/list");
  assertEquals(down.status, 503); assert(!down.text.includes(BACKEND_CANARY));
  // service not configured
  const unconf = createHandler(() => { throw new Error(BACKEND_CANARY); });
  const r = await unconf(req(env.tok.owner, {}));
  assertEquals(r.status, 503); assert(!(await r.text()).includes(BACKEND_CANARY));
});
Deno.test("http: unexpected exceptions return a generic 500 without internals", async () => {
  const env = await setup();
  const h = createHandler(() => ({ ...env.deps, get store(): never { throw new TypeError(BACKEND_CANARY); } }) as unknown as Deps);
  const res = await h(req(env.tok.owner, {}));
  const body = await res.text();
  assert(res.status === 500 || res.status === 503); assert(!body.includes(BACKEND_CANARY));
});

// ---------------------------------------------------------------- tool exposure
Deno.test("tools/list is limited by scope and by the write/publish switches", async () => {
  const names = async (o: Parameters<typeof setup>[0], who: keyof typeof U = "owner") => { const env = await setup(o); return (await rpc(env, env.tok[who], "tools/list")).json.result.tools.map((t: { name: string }) => t.name) as string[]; };
  assertEquals((await names({ write: false, publish: false })).length, 6);
  assertEquals((await names({ write: true, publish: false })).length, 10);
  assert((await names({ write: true, publish: true })).includes("publish_draft"));
  assert(!(await names({ write: true, publish: true, key: false })).includes("publish_draft"), "publish needs the HMAC key");
  assert(!(await names({ write: true, publish: true, scopes: ["read", "draft"] })).includes("publish_draft"), "publish needs the publish scope");
  assertEquals((await names({ scopes: ["read"] })).length, 6);
  const env = await setup({ write: true, publish: true });
  const tools = (await rpc(env, env.tok.owner, "tools/list")).json.result.tools;
  for (const t of tools) { assertEquals(t.inputSchema.additionalProperties, false, t.name); assertEquals(t.annotations.openWorldHint, false); }
  assertEquals(tools.find((t: { name: string }) => t.name === "publish_draft").annotations.destructiveHint, true);
  assertEquals(tools.find((t: { name: string }) => t.name === "search_books").annotations.readOnlyHint, true);
});
Deno.test("disabled or out-of-scope tools cannot be called", async () => {
  const off = await setup({ write: false });
  assertEquals(code(await tool(off, off.tok.owner, "create_phase", { book_id: ID.bk1, title: "X" })), "NOT_AVAILABLE");
  const ro = await setup({ scopes: ["read"] });
  assertEquals(code(await tool(ro, ro.tok.owner, "create_phase", { book_id: ID.bk1, title: "X" })), "FORBIDDEN_SCOPE");
  const before = ro.store.snapshot();
  assertEquals(ro.store.snapshot(), before);
  assertEquals(code(await tool(ro, ro.tok.owner, "drop_everything", {})), "NOT_FOUND");
});

// ---------------------------------------------------------------- reads: authorization and draft isolation
Deno.test("search_books lists only books the caller is a member of, never someone else's or soft-deleted ones", async () => {
  const env = await setup();
  const o = await tool(env, env.tok.owner, "search_books");
  assertEquals(o.data.books.map((b: { id: string }) => b.id).sort(), [ID.bk1, ID.bkArch].sort()); // bkDel hidden
  const s = await tool(env, env.tok.stranger, "search_books");
  assertEquals(s.data.books.map((b: { id: string }) => b.id), [ID.bk2]);
  assert(!s.text.includes("Book One"));
  const q = await tool(env, env.tok.owner, "search_books", { query: "archived", limit: 1 });
  assertEquals(q.data.books.length, 1);
});
Deno.test("book tools: strangers and soft-deleted books are indistinguishable from missing", async () => {
  const env = await setup();
  const missing = "00000000-0000-4000-8000-0000000000ff";
  for (const t of ["get_book_metadata", "get_book_structure"]) {
    const a = await tool(env, env.tok.stranger, t, { book_id: ID.bk1 });
    const b = await tool(env, env.tok.stranger, t, { book_id: missing });
    assertEquals(a.text.replace(/"id":\d+/, ""), b.text.replace(/"id":\d+/, ""), t);
    assertEquals(code(a), "NOT_FOUND");
    assertEquals(code(await tool(env, env.tok.owner, t, { book_id: ID.bkDel })), "NOT_FOUND"); // owner too: soft-deleted is hidden
    assertEquals(code(await tool(env, env.tok.editor, t, { book_id: ID.bkDel })), "NOT_FOUND");
  }
  assertEquals(code(await tool(env, env.tok.owner, "get_step_content", { step_id: ID.sDel })), "NOT_FOUND");
  assertEquals(code(await tool(env, env.tok.owner, "get_step_content", { step_id: ID.sOther })), "NOT_FOUND"); // another user's private step
});
Deno.test("draft isolation: VIEWER and strangers never receive draft text; OWNER/EDITOR/REVIEWER do", async () => {
  const env = await setup();
  for (const who of ["owner", "editor", "reviewer"] as const) {
    const r = await tool(env, env.tok[who], "get_step_content", { step_id: ID.s2 });
    assertEquals(r.data.markdown, `secret draft ${DRAFT_CANARY}`, who);
    const s1 = await tool(env, env.tok[who], "get_step_content", { step_id: ID.s1, include_published: true });
    assertEquals(s1.data.markdown, `newer unpublished edit ${DRAFT_CANARY}`); assertEquals(s1.data.published_markdown, PUB_TEXT);
    assertEquals(s1.data.revision, env.store.step(ID.s1).updated_at);
  }
  // viewer: draft-only step does not exist for them; published step shows published text only, no revision
  assertEquals(code(await tool(env, env.tok.viewer, "get_step_content", { step_id: ID.s2 })), "NOT_FOUND");
  const v = await tool(env, env.tok.viewer, "get_step_content", { step_id: ID.s1, include_published: true });
  assertEquals(v.data.markdown, PUB_TEXT); assert(!v.text.includes(DRAFT_CANARY)); assertEquals(v.data.revision, undefined);
  // strict reader rule (07): a legacy step that was never frozen (no publishedMarkdown) is not reader-visible at all
  assertEquals(code(await tool(env, env.tok.viewer, "get_step_content", { step_id: ID.s3 })), "NOT_FOUND");
  // structure, metadata, search, status for the viewer contain no draft trace
  for (const [name, args] of [["get_book_structure", { book_id: ID.bk1 }], ["get_book_metadata", { book_id: ID.bk1 }], ["search_content", { query: "secret" }], ["search_content", { query: DRAFT_CANARY }], ["get_publication_status", { step_id: ID.s1 }], ["get_publication_status", { book_id: ID.bk1 }]] as const) {
    const r = await tool(env, env.tok.viewer, name, args);
    assert(!r.text.includes(DRAFT_CANARY) && !r.text.includes("Draft only step") && !r.text.includes("draft-only"), `${name} leaked a draft to a viewer`);
  }
  const structure = await tool(env, env.tok.viewer, "get_book_structure", { book_id: ID.bk1 });
  assertEquals(structure.data.phases[0].steps.map((s: { id: string }) => s.id), [ID.s1]);
  const ownerStructure = await tool(env, env.tok.owner, "get_book_structure", { book_id: ID.bk1 });
  assertEquals(ownerStructure.data.phases[0].steps.map((s: { id: string }) => s.id), [ID.s1, ID.s2, ID.s3]);
  assertEquals((await tool(env, env.tok.reviewer, "search_content", { query: DRAFT_CANARY })).data.results.length, 2);
  assertEquals((await tool(env, env.tok.viewer, "search_content", { query: PUB_TEXT.slice(0, 9) })).data.results.length, 1);
  assertEquals((await tool(env, env.tok.owner, "search_content", { query: PRIVATE_CANARY })).data.results.length, 0); // other users' content is out of reach
});
Deno.test("an archived book is readable by its members (role-based) but not writable", async () => {
  const env = await setup();
  assertEquals((await tool(env, env.tok.owner, "get_book_structure", { book_id: ID.bkArch })).isError, undefined);
  assertEquals(code(await tool(env, env.tok.owner, "create_phase", { book_id: ID.bkArch, title: "N" })), "BOOK_ARCHIVED");
  assertEquals(code(await tool(env, env.tok.editor, "create_draft", { phase_id: ID.phArch, title: "N", markdown: "m" })), "BOOK_ARCHIVED");
  const rev = env.store.step(ID.sArch).updated_at;
  assertEquals(code(await tool(env, env.tok.owner, "update_draft", { step_id: ID.sArch, expected_revision: rev, markdown: "x", change_summary: "c" })), "BOOK_ARCHIVED");
  assertEquals(env.store.step(ID.sArch).content.markdown, "a");
});

// ---------------------------------------------------------------- writes
Deno.test("write authorization: only OWNER/EDITOR; viewer/reviewer forbidden; strangers and cross-book ids not found; nothing changes", async () => {
  const env = await setup();
  const before = env.store.snapshot();
  const rev = env.store.step(ID.s2).updated_at;
  for (const who of ["viewer", "reviewer"] as const) {
    assertEquals(code(await tool(env, env.tok[who], "create_phase", { book_id: ID.bk1, title: "N" })), "FORBIDDEN_ROLE", who);
    assertEquals(code(await tool(env, env.tok[who], "update_draft", { step_id: ID.s1, expected_revision: env.store.step(ID.s1).updated_at, markdown: "x", change_summary: "c" })), "FORBIDDEN_ROLE");
  }
  assertEquals(code(await tool(env, env.tok.viewer, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: "x", change_summary: "c" })), "NOT_FOUND"); // hidden draft step
  for (const [name, args] of [
    ["create_phase", { book_id: ID.bk1, title: "N" }],
    ["create_draft", { phase_id: ID.ph1, title: "N", markdown: "m" }],
    ["update_draft", { step_id: ID.s1, expected_revision: env.store.step(ID.s1).updated_at, markdown: "x", change_summary: "c" }],
    ["update_step_metadata", { step_id: ID.s1, expected_revision: env.store.step(ID.s1).updated_at, title: "T" }],
    ["publish_draft", { step_id: ID.s2 }],
  ] as const) assertEquals(code(await tool(env, env.tok.stranger, name, args)), "NOT_FOUND", `stranger ${name}`);
  // the stranger's own step cannot be touched by the owner of book one, even by guessing ids
  for (const [name, args] of [
    ["update_draft", { step_id: ID.sOther, expected_revision: env.store.step(ID.sOther).updated_at, markdown: "pwn", change_summary: "c" }],
    ["create_draft", { phase_id: ID.ph2, title: "N", markdown: "m" }],
    ["create_phase", { book_id: ID.bk2, title: "N" }],
    ["publish_draft", { step_id: ID.sOther }],
  ] as const) assertEquals(code(await tool(env, env.tok.owner, name, args)), "NOT_FOUND", `cross-book ${name}`);
  assertEquals(env.store.snapshot(), before, "no denied call may change anything");
});
Deno.test("create_phase / create_draft: append, idempotent, drafts invisible to readers, duplicates detected", async () => {
  const env = await setup();
  const p1 = await tool(env, env.tok.editor, "create_phase", { book_id: ID.bk1, title: "  New   Phase " });
  assertEquals(p1.data.created, true); assertEquals(p1.data.phase.position, 2);
  const p2 = await tool(env, env.tok.editor, "create_phase", { book_id: ID.bk1, title: "new phase" });
  assertEquals(p2.data.created, false); assertEquals(p2.data.phase.id, p1.data.phase.id);
  const d1 = await tool(env, env.tok.editor, "create_draft", { phase_id: p1.data.phase.id, title: "Intro Chapter", markdown: `# Hi ${DRAFT_CANARY}`, difficulty: "Advanced", estimated_minutes: 20 });
  assertEquals(d1.data.created, true);
  const row = env.store.step(d1.data.step.id);
  assertEquals(row.content, { slug: "intro-chapter", status: "Draft", markdown: `# Hi ${DRAFT_CANARY}`, description: "", difficulty: "Advanced", estimatedTime: 20, visibility: "Public" });
  assert(!("publishedMarkdown" in row.content));
  const again = await tool(env, env.tok.editor, "create_draft", { phase_id: p1.data.phase.id, title: "Intro Chapter", markdown: `# Hi ${DRAFT_CANARY}` });
  assertEquals(again.data.created, false); assertEquals(env.store.steps.filter((s) => s.title === "Intro Chapter").length, 1);
  assertEquals(code(await tool(env, env.tok.editor, "create_draft", { phase_id: p1.data.phase.id, title: "Intro Chapter", markdown: "different" })), "DUPLICATE");
  // readers cannot see or read it
  assertEquals(code(await tool(env, env.tok.viewer, "get_step_content", { step_id: d1.data.step.id })), "NOT_FOUND");
  assert(!(await tool(env, env.tok.viewer, "get_book_structure", { book_id: ID.bk1 })).text.includes("Intro Chapter"));
  assertEquals(code(await tool(env, env.tok.editor, "create_draft", { phase_id: "00000000-0000-4000-8000-0000000000fe", title: "N", markdown: "m" })), "NOT_FOUND");
});
Deno.test("update_draft: changes only markdown; published text, status, slug, visibility and unknown keys stay byte-identical; other rows untouched", async () => {
  const env = await setup();
  const rev = env.store.step(ID.s1).updated_at;
  const beforeContent = structuredClone(env.store.step(ID.s1).content);
  const others = JSON.stringify([env.store.step(ID.s2), env.store.step(ID.s3), env.store.step(ID.sOther)]);
  const books = JSON.stringify(env.store.books);
  const r = await tool(env, env.tok.editor, "update_draft", { step_id: ID.s1, expected_revision: rev, markdown: "# new draft\r\n\ttabs and ünïcode ✓", change_summary: "tidy" });
  assertEquals(r.isError, undefined);
  assertNotEquals(r.data.revision, rev);
  const after = env.store.step(ID.s1).content;
  assertEquals({ ...after, markdown: undefined }, { ...beforeContent, markdown: undefined });
  assertEquals(after.markdown, "# new draft\r\n\ttabs and ünïcode ✓"); // exact round trip
  assertEquals(after.publishedMarkdown, PUB_TEXT);
  assertEquals(JSON.stringify([env.store.step(ID.s2), env.store.step(ID.s3), env.store.step(ID.sOther)]), others);
  assertEquals(JSON.stringify(env.store.books), books);
  // a viewer still sees the published text only
  assertEquals((await tool(env, env.tok.viewer, "get_step_content", { step_id: ID.s1 })).data.markdown, PUB_TEXT);
});
Deno.test("update_draft concurrency: stale revision, replay, editor autosave in between, parallel updates", async () => {
  const env = await setup();
  const rev = env.store.step(ID.s2).updated_at;
  const ok1 = await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: "one", change_summary: "c" });
  assertEquals(ok1.isError, undefined);
  const replay = await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: "one", change_summary: "c" });
  assertEquals(code(replay), "CONFLICT"); assertEquals(replay.data.error.current_revision, ok1.data.revision);
  assertEquals(env.store.step(ID.s2).content.markdown, "one");
  // browser editor saves between our read and our write
  const rev2 = env.store.step(ID.s2).updated_at;
  env.store.beforeCas = () => { const s = env.store.step(ID.s2); s.content = { ...s.content, markdown: "editor autosave" }; s.updated_at = "2026-10-18T10:59:59.999999+00:00"; env.store.beforeCas = null; };
  assertEquals(code(await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev2, markdown: "mcp", change_summary: "c" })), "CONFLICT");
  assertEquals(env.store.step(ID.s2).content.markdown, "editor autosave");
  // two parallel updates with the same revision: exactly one wins
  const rev3 = env.store.step(ID.s2).updated_at;
  const results = await Promise.all([env.tok.owner, env.tok.editor].map((t, i) => tool(env, t, "update_draft", { step_id: ID.s2, expected_revision: rev3, markdown: `p${i}`, change_summary: "c" })));
  assertEquals(results.filter((r) => r.isError === undefined).length, 1);
  assertEquals(results.filter((r) => code(r) === "CONFLICT").length, 1);
});
Deno.test("update_step_metadata keeps slug and markdown; needs a field and a current revision", async () => {
  const env = await setup();
  const rev = env.store.step(ID.s1).updated_at;
  // s1 is reader-visible, so a token without the publish scope may not change its (undrafted) metadata
  const draftOnly = await mkToken(env.store, U.owner, { scopes: ["read", "draft"] });
  assertEquals(code(await tool(env, draftOnly, "update_step_metadata", { step_id: ID.s1, expected_revision: rev, title: "Sneaky" })), "FORBIDDEN_SCOPE");
  assertEquals(env.store.step(ID.s1).title, "Published step");
  // ...but it may on a draft-only step, which readers cannot see
  assertEquals((await tool(env, draftOnly, "update_step_metadata", { step_id: ID.s2, expected_revision: env.store.step(ID.s2).updated_at, title: "Draft renamed" })).isError, undefined);
  const r = await tool(env, env.tok.owner, "update_step_metadata", { step_id: ID.s1, expected_revision: rev, title: "Renamed", difficulty: "Advanced", estimated_minutes: 30, description: "new" });
  assertEquals(r.isError, undefined);
  const c = env.store.step(ID.s1).content;
  assertEquals([env.store.step(ID.s1).title, c.slug, c.difficulty, c.estimatedTime, c.description, c.markdown, c.publishedMarkdown], ["Renamed", "published-step", "Advanced", 30, "new", `newer unpublished edit ${DRAFT_CANARY}`, PUB_TEXT]);
  assertEquals(code(await tool(env, env.tok.owner, "update_step_metadata", { step_id: ID.s1, expected_revision: rev, title: "x" })), "CONFLICT");
  assertEquals(code(await tool(env, env.tok.owner, "update_step_metadata", { step_id: ID.s1, expected_revision: env.store.step(ID.s1).updated_at })), "VALIDATION");
});

// ---------------------------------------------------------------- validation
Deno.test("validation: strict inputs, no rejected value echoed, nothing written", async () => {
  const env = await setup();
  const before = env.store.snapshot();
  const secret = "LEAKY_INPUT_VALUE_77";
  const cases: [string, unknown][] = [
    ["get_book_metadata", { book_id: "not-a-uuid" }], ["get_book_metadata", {}], ["get_book_metadata", { book_id: ID.bk1, user_id: U.stranger }],
    ["search_books", { limit: 1000 }], ["search_books", { query: "a".repeat(201) }], ["search_books", { cursor: "-1" }],
    ["create_phase", { book_id: ID.bk1, title: "" }], ["create_phase", { book_id: ID.bk1, title: "a\u0000b" }], ["create_phase", { book_id: ID.bk1, title: "x".repeat(201) }],
    ["create_draft", { phase_id: ID.ph1, title: "T", markdown: "a".repeat(100_001) }], ["create_draft", { phase_id: ID.ph1, title: "T", markdown: "bad\u0001ctrl" }],
    ["create_draft", { phase_id: ID.ph1, title: "T", markdown: "m", difficulty: secret }], ["create_draft", { phase_id: ID.ph1, title: "T", markdown: "m", estimated_minutes: 0 }],
    ["update_draft", { step_id: ID.s1, markdown: "x", change_summary: "c" }], ["update_draft", { step_id: ID.s1, expected_revision: "'; drop table", markdown: "x", change_summary: "c" }],
    ["get_publication_status", {}], ["get_publication_status", { book_id: ID.bk1, step_id: ID.s1 }], ["publish_draft", { step_id: ID.s1, confirm: "yes" }],
    ["search_content", { query: "   " }], ["get_step_content", { step_id: ID.s1, include_published: secret }],
  ];
  for (const [name, args] of cases) {
    const r = await tool(env, env.tok.owner, name, args);
    assertEquals(code(r), "VALIDATION", `${name} ${JSON.stringify(args).slice(0, 60)}`);
    assert(!r.text.includes(secret), "rejected values must not be echoed");
  }
  assertEquals(env.store.snapshot(), before);
  // markdown with legitimate whitespace/control chars (tab, CR, LF) passes
  const rev = env.store.step(ID.s2).updated_at;
  assertEquals((await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: "a\tb\r\nc", change_summary: "c" })).isError, undefined);
});

// ---------------------------------------------------------------- publishing
async function preview(env: Env, who: keyof typeof U, step = ID.s2) {
  const r = await tool(env, env.tok[who], "publish_draft", { step_id: step });
  assertEquals(r.isError, undefined, r.text);
  return r.data as { confirmation_token: string; diff: { added_lines: number }; book_publication_status: string };
}
Deno.test("publish_draft: preview writes nothing, confirm publishes exactly this step", async () => {
  const env = await setup();
  const before = env.store.snapshot();
  const pv = await preview(env, "owner");
  assertEquals(env.store.snapshot(), before); assert(pv.diff.added_lines >= 1); assertEquals(env.store.casCalls, 0);
  const others = JSON.stringify([env.store.step(ID.s1), env.store.step(ID.s3), env.store.step(ID.sOther)]);
  const books = JSON.stringify(env.store.books);
  const done = await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Draft only step" });
  assertEquals(done.isError, undefined, done.text); assertEquals(done.data.published, true);
  const c = env.store.step(ID.s2).content;
  assertEquals([c.status, c.publishedMarkdown, c.markdown, c.slug], ["Published", `secret draft ${DRAFT_CANARY}`, `secret draft ${DRAFT_CANARY}`, "draft-only"]);
  assertEquals(JSON.stringify([env.store.step(ID.s1), env.store.step(ID.s3), env.store.step(ID.sOther)]), others);
  assertEquals(JSON.stringify(env.store.books), books);
  // replay of the same confirmation fails (revision moved)
  assertEquals(code(await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Draft only step" })), "CONFLICT");
  // now readers see it
  assertEquals((await tool(env, env.tok.viewer, "get_step_content", { step_id: ID.s2 })).data.markdown, `secret draft ${DRAFT_CANARY}`);
});
Deno.test("publish_draft: every confirmation failure mode is refused and writes nothing", async () => {
  const env = await setup();
  const pv = await preview(env, "owner");
  const snap = env.store.snapshot();
  const go = (extra: Record<string, unknown>, who: keyof typeof U = "owner", step = ID.s2) => tool(env, env.tok[who], "publish_draft", { step_id: step, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Draft only step", ...extra });
  assertEquals(code(await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true })), "CONFIRMATION_REQUIRED");
  assertEquals(code(await go({ confirm_title: "draft only step" })), "CONFIRMATION_INVALID"); // exact title
  const [b, s] = pv.confirmation_token.split(".");
  assertEquals(code(await go({ confirmation_token: `${b}.${s.slice(0, -2)}AA` })), "CONFIRMATION_INVALID"); // bad signature
  assertEquals(code(await go({ confirmation_token: `${btoa(JSON.stringify({ sub: U.owner, step: ID.s2, rev: "x", h: "y", exp: 9e15 }))}.${s}` })), "CONFIRMATION_INVALID"); // tampered payload
  assertEquals(code(await go({ confirmation_token: "not.a.token.at.all.really-not" })), "CONFIRMATION_INVALID");
  const forEditor = await makeConfirmation(env.key, { op: "publish_draft", sub: U.editor, tid: "t", step: ID.s2, rev: env.store.step(ID.s2).updated_at, h: await sha256Hex(`secret draft ${DRAFT_CANARY}`), exp: env.now.t + 1e6 });
  assertEquals(code(await go({ confirmation_token: forEditor })), "CONFIRMATION_INVALID"); // validly signed, but minted for another user
  assertEquals(code(await go({}, "editor")), "FORBIDDEN_ROLE"); // editors cannot publish through MCP at all (owner-only)
  assertEquals(code(await go({}, "owner", ID.s1)), "CONFIRMATION_INVALID"); // token for another step
  const otherKey = await makeConfirmation(crypto.getRandomValues(new Uint8Array(32)), { op: "publish_draft", sub: U.owner, tid: "t", step: ID.s2, rev: env.store.step(ID.s2).updated_at, h: await sha256Hex(`secret draft ${DRAFT_CANARY}`), exp: env.now.t + 1e6 });
  assertEquals(code(await go({ confirmation_token: otherKey })), "CONFIRMATION_INVALID"); // signed with a different key
  env.now.t += 11 * 60 * 1000;
  assertEquals(code(await go({})), "CONFIRMATION_EXPIRED");
  env.now.t -= 11 * 60 * 1000;
  assertEquals(env.store.snapshot(), snap);
  // content changed between preview and confirm
  const rev = env.store.step(ID.s2).updated_at;
  await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: "changed after preview", change_summary: "c" });
  const snap2 = env.store.snapshot();
  assertEquals(code(await go({})), "CONFLICT");
  assertEquals(env.store.snapshot(), snap2);
  // roles and scope
  const pv2 = await preview(env, "owner");
  for (const who of ["viewer", "reviewer"] as const) assertEquals(code(await tool(env, env.tok[who], "publish_draft", { step_id: ID.s1, confirm: true, confirmation_token: pv2.confirmation_token, confirm_title: "x" })), "FORBIDDEN_ROLE");
  const noPublish = await setup({ scopes: ["read", "draft"] });
  assertEquals(code(await tool(noPublish, noPublish.tok.owner, "publish_draft", { step_id: ID.s2 })), "FORBIDDEN_SCOPE");
  const noKey = await setup({ key: false });
  assertEquals(code(await tool(noKey, noKey.tok.owner, "publish_draft", { step_id: ID.s2 })), "NOT_AVAILABLE");
  assertEquals(code(await tool(env, env.tok.owner, "publish_draft", { step_id: ID.sArch })), "BOOK_ARCHIVED");
});

// ---------------------------------------------------------------- errors, logs, secrets
Deno.test("backend errors become INTERNAL with a fixed message: no backend text, no stack, no content in response or logs", async () => {
  const env = await setup();
  // (a) every store call fails with a StoreError carrying a canary; called past authentication with a fixed principal
  env.store.failWith = new StoreError("BACKEND", BACKEND_CANARY);
  const failed = await callTool(env.deps, { userId: U.owner, tokenId: "t", scopes: ["read"] }, "get_book_metadata", { book_id: ID.bk1 });
  assertEquals((failed.structuredContent.error as { code: string }).code, "INTERNAL");
  assert(!JSON.stringify(failed).includes(BACKEND_CANARY));
  // ...and the same outage during token lookup is a 503, never a 401 or 200
  assertEquals((await rpc(env, env.tok.owner, "tools/list")).status, 503);
  env.store.failWith = null;
  // (b) an arbitrary exception with a path, a stack-like text and a token in its message
  const origGet = env.store.getMemberBook.bind(env.store);
  env.store.getMemberBook = () => { throw new Error(`${BACKEND_CANARY} at /secret/path.ts:12 ${env.tok.owner}`); };
  const r = await tool(env, env.tok.owner, "get_book_metadata", { book_id: ID.bk1 });
  assertEquals(code(r), "INTERNAL");
  assert(!r.text.includes(BACKEND_CANARY) && !r.text.includes("/secret/path") && !r.text.includes("at "));
  env.store.getMemberBook = origGet;
  assert(!env.logs.join("\n").includes(BACKEND_CANARY));
  assert(env.logs.some((l) => l.includes('"outcome":"INTERNAL')));
});
Deno.test("canary: tokens, draft text, written Markdown and other users' content never reach logs; audit lines have an allowlisted shape", async () => {
  const env = await setup();
  const rev = env.store.step(ID.s2).updated_at;
  await tool(env, env.tok.owner, "get_step_content", { step_id: ID.s2 });
  await tool(env, env.tok.owner, "update_draft", { step_id: ID.s2, expected_revision: rev, markdown: `WRITTEN_MARKDOWN_CANARY ${DRAFT_CANARY}`, change_summary: "SUMMARY_CANARY" });
  await tool(env, env.tok.owner, "get_step_content", { step_id: ID.sOther });
  await rpc(env, "dbk_AAAAAAAA_" + "B".repeat(43), "tools/list");
  const unauth = await rpc(env, env.tok.owner + "x", "tools/list");
  const logs = env.logs.join("\n");
  for (const secret of [...Object.values(env.tok), "dbk_AAAAAAAA_" + "B".repeat(43), "WRITTEN_MARKDOWN_CANARY", DRAFT_CANARY, "SUMMARY_CANARY", PRIVATE_CANARY]) assert(!logs.includes(secret), `log leaked ${secret.slice(0, 12)}`);
  assert(!unauth.text.includes(env.tok.owner));
  const allowed = new Set(["t", "event", "requestId", "tokenId", "userId", "tool", "bookId", "stepId", "outcome", "revisionBefore", "revisionAfter", "contentSha256", "ms"]);
  for (const l of env.logs) { const o = JSON.parse(l); for (const k of Object.keys(o)) assert(allowed.has(k), `unexpected audit key ${k}`); }
  const w = env.logs.map((l) => JSON.parse(l)).find((o) => o.tool === "update_draft");
  assertEquals(w.contentSha256, await sha256Hex(`WRITTEN_MARKDOWN_CANARY ${DRAFT_CANARY}`)); assertEquals(w.revisionBefore, rev); assertEquals(w.userId, U.owner);
});
Deno.test("rate limiting: a write burst is throttled per token and refills", async () => {
  const env = await setup({ realLimits: true });
  const outcomes: (string | undefined)[] = [];
  for (let i = 0; i < 25; i++) outcomes.push(code(await tool(env, env.tok.owner, "create_phase", { book_id: ID.bk1, title: `P${i}` })));
  assertEquals(outcomes.filter((o) => o === "RATE_LIMITED").length, 5);
  assertEquals((await tool(env, env.tok.editor, "create_phase", { book_id: ID.bk1, title: "other token ok" })).isError, undefined);
  env.now.t += 60_000;
  assertEquals((await tool(env, env.tok.owner, "create_phase", { book_id: ID.bk1, title: "after refill" })).isError, undefined);
});
Deno.test("authenticate(): revoked/expired are re-checked on every request (no caching)", async () => {
  const env = await setup();
  assert(await authenticate(env.deps, `Bearer ${env.tok.owner}`));
  for (const row of env.store.tokenHashes.values()) row.revoked_at = "2026-10-18T11:00:00Z";
  assertEquals(await authenticate(env.deps, `Bearer ${env.tok.owner}`), null);
  const p: Principal = { userId: U.owner, tokenId: "t", scopes: ["read"] };
  assertEquals(availableTools(p, env.deps).length, 6);
  assertStringIncludes(JSON.stringify(await callTool(env.deps, p, "update_draft", {})), "FORBIDDEN_SCOPE"); // read-only principal
});

Deno.test("publish_draft: a stored title with surrounding spaces can be confirmed with its trimmed form", async () => {
  const env = await setup();
  env.store.step(ID.s2).title = "  Padded Title  ";
  const pv = await preview(env, "owner");
  const done = await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Padded Title" });
  assertEquals(done.isError, undefined, done.text);
});

Deno.test("store: unique-violation detection accepts the SQLSTATE or the wording; other errors are BACKEND", async () => {
  const { createInsforgeStore, StoreError } = await import("../handler.ts");
  const mk = (firstError: { code?: string; message?: string; details?: string } | null) => {
    let inserts = 0;
    const row = { id: "x", phase_id: "p", title: "t", position: 2, content: {}, updated_at: "2026-10-18T10:00:00.000001+00:00" };
    // deno-lint-ignore no-explicit-any
    const builder = (table: string): any => {
      const b: any = { select: () => b, eq: () => b, order: () => b, limit: () => Promise.resolve({ data: [{ position: 1 }], error: null }), insert: () => { inserts++; return b; }, single: () => Promise.resolve(inserts === 1 && firstError ? { data: null, error: firstError } : { data: row, error: null }) };
      void table; return b;
    };
    return { store: createInsforgeStore({ from: builder }, { sleep: async () => {} }), inserts: () => inserts };
  };
  for (const err of [{ code: "23505" }, { message: "duplicate key value violates unique constraint" }, { details: "Key (phase_id, position)=(p, 2) already exists." }]) {
    const m = mk(err); await m.store.insertStep("p", "t", {}, "u"); assertEquals(m.inserts(), 2, JSON.stringify(err));
  }
  const m = mk({ code: "42501", message: "permission denied" });
  let thrown: unknown; try { await m.store.insertStep("p", "t", {}, "u"); } catch (e) { thrown = e; }
  assert(thrown instanceof StoreError && thrown.code === "BACKEND"); assertEquals(m.inserts(), 1);
});
Deno.test("rate limiter: exceeding the bucket map size keeps throttled callers throttled (evicts the least throttled bucket)", () => {
  const t = { v: 0 };
  const rl = new RateLimiter(() => t.v, { read: 5, write: 1 });
  assert(rl.take("victim", "write")); assert(!rl.take("victim", "write")); // victim is now throttled
  for (let i = 0; i < 6000; i++) rl.take(`t${i}`, "read");
  assert(!rl.take("victim", "write"), "a flood of other tokens must not reset the victim's bucket");
});

// ---------------------------------------------------------------- adversarial tests added after the 2026-10-20 review
Deno.test("adversarial: update_draft refuses ambiguous legacy steps (LEGACY_STEP) and changes nothing; a failed attempt can be retried after migration", async () => {
  const env = await setup();
  const LEG_PUB = "00000000-0000-4000-8000-0000000000e1";
  env.store.addStep(LEG_PUB, ID.ph1, "Legacy published", 4, { status: "Published", markdown: "OLD_PUBLISHED_TEXT", slug: "lp" });
  for (const id of [ID.s3, LEG_PUB]) {
    const before = JSON.stringify(env.store.step(id));
    const r = await tool(env, env.tok.editor, "update_draft", { step_id: id, expected_revision: env.store.step(id).updated_at, markdown: `NEW_DRAFT ${DRAFT_CANARY}`, change_summary: "c" });
    assertEquals(code(r), "LEGACY_STEP");
    assert(!r.text.includes(DRAFT_CANARY) && !r.text.includes("OLD_PUBLISHED_TEXT"));
    assertEquals(JSON.stringify(env.store.step(id)), before, "nothing may change");
  }
  assertEquals(env.store.casCalls, 0);
  // after the 02b-style migration (publishedMarkdown frozen) the same edit succeeds and stays a draft
  const s = env.store.step(LEG_PUB);
  s.content = { ...s.content, publishedMarkdown: "OLD_PUBLISHED_TEXT" };
  const ok2 = await tool(env, env.tok.editor, "update_draft", { step_id: LEG_PUB, expected_revision: s.updated_at, markdown: `NEW_DRAFT ${DRAFT_CANARY}`, change_summary: "c" });
  assertEquals(ok2.isError, undefined, ok2.text);
  assertEquals((await tool(env, env.tok.viewer, "get_step_content", { step_id: LEG_PUB })).data.markdown, "OLD_PUBLISHED_TEXT");
  // classification
  assertEquals(isAmbiguousLegacyStep({ status: "Draft", markdown: "a" }, "PUBLISHED"), false);
  assertEquals(isAmbiguousLegacyStep({ status: "Published", markdown: "a", publishedMarkdown: "p" }, "PUBLISHED"), false);
  assertEquals(isAmbiguousLegacyStep({ markdown: "a" }, "DRAFT"), false);
  assertEquals(isAmbiguousLegacyStep({ markdown: "a" }, "PUBLISHED"), true);
  assertEquals(isAmbiguousLegacyStep({ status: "Published", markdown: 5 }, "DRAFT"), true);
});

Deno.test("adversarial: LEGACY reader rule parity between handler.ts (legacyReaderText) and the website's reader-visibility.ts over every content shape; the STRICT rule never falls back to markdown", () => {
  const pms = [undefined, "P", "", null, 7], sts = [undefined, "Published", "Draft", "Archived", "", null, 42], mds = [undefined, "M", "", null, 3];
  let n = 0;
  for (const pm of pms) for (const st of sts) for (const md of mds) for (const bs of ["PUBLISHED", "DRAFT", "ARCHIVED"]) {
    const c: Record<string, unknown> = {};
    if (pm !== undefined) c.publishedMarkdown = pm;
    if (st !== undefined) c.status = st;
    if (md !== undefined) c.markdown = md;
    const mine = legacyReaderText(c, bs);
    assertEquals(isReaderVisible(c as never, bs), mine !== null, JSON.stringify([c, bs]));
    assertEquals(readerMarkdown(c as never, bs), mine ?? "", JSON.stringify([c, bs]));
    // strict: only a publishedMarkdown string, never the draft; and it is always a subset of the legacy rule
    assertEquals(readerText(c, bs), typeof c.publishedMarkdown === "string" ? c.publishedMarkdown : null, JSON.stringify([c, bs]));
    if (readerText(c, bs) !== null) assertEquals(readerText(c, bs), mine);
    n++;
  }
  assertEquals(n, 525);
});

Deno.test("adversarial: append retries use jittered exponential backoff and end in BUSY, never INTERNAL", async () => {
  const mk = (conflicts: number) => {
    let inserts = 0;
    const sleeps: number[] = [];
    const row = { id: "x", phase_id: "p", title: "t", position: 2, content: {}, updated_at: "2026-10-18T10:00:00.000001+00:00" };
    // deno-lint-ignore no-explicit-any
    const builder = (): any => {
      // deno-lint-ignore no-explicit-any
      const b: any = { select: () => b, eq: () => b, order: () => b, limit: () => Promise.resolve({ data: [{ position: 1 }], error: null }), insert: () => { inserts++; return b; }, single: () => Promise.resolve(inserts <= conflicts ? { data: null, error: { code: "23505" } } : { data: row, error: null }) };
      return b;
    };
    const store = createInsforgeStore({ from: builder }, { sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.999999 });
    return { store, inserts: () => inserts, sleeps };
  };
  const five = mk(5);
  await five.store.insertStep("p", "t", {}, "u");
  assertEquals(five.inserts(), 6);
  assertEquals(five.sleeps, [24, 49, 99, 199, 399]); // random() * min(cap, 25 * 2^i), floored
  const forever = mk(1000);
  let thrown: unknown;
  try { await forever.store.insertStep("p", "t", {}, "u"); } catch (e) { thrown = e; }
  assert(thrown instanceof StoreError && thrown.code === "BUSY");
  assertEquals(forever.inserts(), APPEND_RETRY_DEFAULTS.attempts);
  assertEquals(forever.sleeps, [24, 49, 99, 199, 399, 799, 999]); // capped at 1 s, ~2.6 s worst case in total
  // through the tool layer BUSY is its own retryable code with a fixed message
  const env = await setup();
  env.store.insertStep = () => Promise.reject(new StoreError("BUSY"));
  assertEquals(code(await tool(env, env.tok.editor, "create_draft", { phase_id: ID.ph1, title: "Busy", markdown: "m" })), "BUSY");
});

Deno.test("adversarial: publishing is owner-only and a confirmation works only with the token that previewed it", async () => {
  const env = await setup();
  assertEquals(code(await tool(env, env.tok.editor, "publish_draft", { step_id: ID.s2 })), "FORBIDDEN_ROLE");
  const pv = await preview(env, "owner");
  const second = await mkToken(env.store, U.owner, { scopes: ["read", "draft", "publish"] });
  const confirm = { step_id: ID.s2, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Draft only step" };
  const snap = env.store.snapshot();
  assertEquals(code(await tool(env, second, "publish_draft", confirm)), "CONFIRMATION_INVALID");
  assertEquals(env.store.snapshot(), snap);
  assertEquals((await tool(env, env.tok.owner, "publish_draft", confirm)).isError, undefined);
});

Deno.test("adversarial: viewers learn nothing about phases that only hold drafts", async () => {
  const env = await setup();
  env.store.addPhase("00000000-0000-4000-8000-0000000000c9", ID.bk1, "SECRET_PHASE_TITLE", 2);
  env.store.addStep("00000000-0000-4000-8000-0000000000e2", "00000000-0000-4000-8000-0000000000c9", "Hidden", 1, { status: "Draft", markdown: "x" });
  for (const [name, args] of [["get_book_structure", { book_id: ID.bk1 }], ["get_book_metadata", { book_id: ID.bk1 }]] as const) {
    assert(!(await tool(env, env.tok.viewer, name, args)).text.includes("SECRET_PHASE_TITLE"), name);
  }
  assertEquals((await tool(env, env.tok.viewer, "get_book_metadata", { book_id: ID.bk1 })).data.phase_count, 1);
  assertEquals((await tool(env, env.tok.owner, "get_book_metadata", { book_id: ID.bk1 })).data.phase_count, 2);
  assert((await tool(env, env.tok.reviewer, "get_book_structure", { book_id: ID.bk1 })).text.includes("SECRET_PHASE_TITLE"));
});

Deno.test("search_content says truncated when the scan budget runs out; audit lines never carry invented tool names", async () => {
  const env = await setup();
  for (let i = 0; i < 1005; i++) env.store.addStep(`bulk-${i}`, ID.ph1, `Bulk ${i}`, 10 + i, { status: "Draft", markdown: "nothing here" });
  const r = await tool(env, env.tok.owner, "search_content", { query: "zzz-no-match" });
  assertEquals([r.data.truncated, r.data.results.length], [true, 0]);
  await rpc(env, env.tok.owner, "tools/call", { name: "CANARY_TOOL_NAME_x", arguments: {} });
  assert(!env.logs.join("\n").includes("CANARY_TOOL_NAME"));
  assert(env.logs.some((l) => l.includes('"tool":"unknown"')));
});

// ---------------------------------------------------------------- strict reader rule, request ids, durable limits and audit (2026-10-20)
Deno.test("strict reader rule: 'Published' without publishedMarkdown, legacy and draft-only steps never reach a viewer through any read tool", async () => {
  const env = await setup();
  const PUB_NO_PM = "00000000-0000-4000-8000-0000000000e3";
  env.store.addStep(PUB_NO_PM, ID.ph1, "Marked published", 5, { status: "Published", markdown: `MARKED_PUBLISHED_DRAFT ${DRAFT_CANARY}`, slug: "mp" });
  assertEquals(code(await tool(env, env.tok.viewer, "get_step_content", { step_id: PUB_NO_PM })), "NOT_FOUND");
  assertEquals(code(await tool(env, env.tok.viewer, "get_publication_status", { step_id: PUB_NO_PM })), "NOT_FOUND");
  for (const [name, args] of [["get_book_structure", { book_id: ID.bk1 }], ["get_book_metadata", { book_id: ID.bk1 }], ["search_content", { query: "MARKED_PUBLISHED" }], ["search_content", { query: "legacy" }], ["search_books", {}]] as const) {
    const r = await tool(env, env.tok.viewer, name, args);
    assert(!r.text.includes("MARKED_PUBLISHED_DRAFT") && !r.text.includes(DRAFT_CANARY) && !r.text.includes("legacy text") && !r.text.includes("Marked published"), name);
  }
  assertEquals((await tool(env, env.tok.viewer, "get_book_metadata", { book_id: ID.bk1 })).data.step_count, 1); // only the properly published step
  // draft roles still see and edit it
  assertEquals((await tool(env, env.tok.editor, "get_step_content", { step_id: PUB_NO_PM })).data.markdown, `MARKED_PUBLISHED_DRAFT ${DRAFT_CANARY}`);
});

Deno.test("publish confirmation is bound to the operation: a validly signed token for another op is refused", async () => {
  const env = await setup();
  const ownerTokenId = [...env.store.tokenHashes.values()].find((t) => t.user_id === U.owner)!.id;
  const base = { sub: U.owner, tid: ownerTokenId, step: ID.s2, rev: env.store.step(ID.s2).updated_at, h: await sha256Hex(`secret draft ${DRAFT_CANARY}`), exp: env.now.t + 1e6 };
  const wrongOp = await makeConfirmation(env.key, { ...base, op: "delete_step" } as never);
  const snap = env.store.snapshot();
  assertEquals(code(await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true, confirmation_token: wrongOp, confirm_title: "Draft only step" })), "CONFIRMATION_INVALID");
  assertEquals(env.store.snapshot(), snap);
  // the same payload with the right op works, proving the only difference was the operation
  const rightOp = await makeConfirmation(env.key, { ...base, op: "publish_draft" });
  assertEquals((await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2, confirm: true, confirmation_token: rightOp, confirm_title: "Draft only step" })).isError, undefined);
});

Deno.test("every response carries a fresh x-request-id that also appears in that request's audit lines", async () => {
  const env = await setup();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const a = await env.handler(req(env.tok.owner, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_books", arguments: {} } }));
  const b = await env.handler(req(null, { jsonrpc: "2.0", id: 2, method: "tools/list" }));
  const c = await env.handler(req(env.tok.owner, {}, {}, "GET"));
  const ids = [a, b, c].map((r) => r.headers.get("x-request-id") ?? "");
  for (const id of ids) assert(UUID.test(id), id);
  assertEquals(new Set(ids).size, 3);
  assertEquals([a.status, b.status, c.status], [200, 401, 405]);
  assert(env.logs.some((l) => l.includes(`"requestId":"${ids[0]}"`) && l.includes('"tool":"search_books"')));
  assert(env.logs.some((l) => l.includes(`"requestId":"${ids[1]}"`) && l.includes('"UNAUTHENTICATED"')));
});

Deno.test("durable limits: shared per-token buckets are enforced, writes fail closed and reads fail open when the limit store is down", async () => {
  const env = await setup({ write: true, publish: true });
  const calls: string[] = [];
  let mode: "count" | "down" = "count";
  const hits = new Map<string, number>();
  env.store.rateTake = async (tokenId, bucket, limit) => {
    calls.push(bucket);
    if (mode === "down") throw new StoreError("BACKEND");
    const k = `${tokenId}:${bucket}`;
    hits.set(k, (hits.get(k) ?? 0) + 1);
    return hits.get(k)! <= limit;
  };
  // flag OFF: never consulted
  await tool(env, env.tok.owner, "search_books");
  assertEquals(calls.length, 0);
  env.deps.durableLimits = true;
  for (let i = 0; i < DURABLE_LIMITS.read; i++) assertEquals((await tool(env, env.tok.owner, "search_books")).isError, undefined);
  assertEquals(code(await tool(env, env.tok.owner, "search_books")), "RATE_LIMITED");
  // publishing has its own bucket
  await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2 });
  assertEquals(calls.at(-1), "publish");
  // limit store down: reads still work, writes and publishing refuse without touching data
  mode = "down";
  const snap = env.store.snapshot();
  assertEquals((await tool(env, env.tok.editor, "get_book_metadata", { book_id: ID.bk1 })).isError, undefined);
  assertEquals(code(await tool(env, env.tok.editor, "create_phase", { book_id: ID.bk1, title: "When store is down" })), "BUSY");
  assertEquals(code(await tool(env, env.tok.owner, "publish_draft", { step_id: ID.s2 })), "BUSY");
  assertEquals(env.store.snapshot(), snap);
  assert(env.logs.some((l) => l.includes('"event":"rate_store_error"')));
});

Deno.test("durable audit: every write/publish attempt (allowed or refused) is recorded with ids only; reads are not; a failing audit store never changes the result", async () => {
  const env = await setup({ write: true, publish: true });
  const rows: Record<string, unknown>[] = [];
  let failing = false;
  env.store.recordAudit = async (row) => { if (failing) throw new Error("audit down"); rows.push(row); };
  env.deps.durableAudit = true;
  await tool(env, env.tok.owner, "search_books");
  const created = await tool(env, env.tok.editor, "create_draft", { phase_id: ID.ph1, title: "Audited", markdown: `AUDIT_BODY ${DRAFT_CANARY}` });
  await tool(env, env.tok.viewer, "create_phase", { book_id: ID.bk1, title: "refused" });
  assertEquals(rows.map((r) => [r.tool, r.outcome]), [["create_draft", "ok"], ["create_phase", "FORBIDDEN_ROLE"]]);
  assertEquals(rows[0].step_id, created.data.step.id);
  assertEquals(rows[0].content_sha256, await sha256Hex(`AUDIT_BODY ${DRAFT_CANARY}`));
  assert(!JSON.stringify(rows).includes(DRAFT_CANARY) && !JSON.stringify(rows).includes("Audited"), "no content or titles in audit rows");
  failing = true;
  const r = await tool(env, env.tok.editor, "create_phase", { book_id: ID.bk1, title: "Still works" });
  assertEquals(r.isError, undefined);
  assert(env.logs.some((l) => l.includes('"event":"audit_store_error"')));
});
