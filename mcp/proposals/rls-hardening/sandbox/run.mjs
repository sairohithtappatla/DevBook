// Functional test of the RLS proposal in a DISPOSABLE in-memory PostgreSQL (PGlite). Touches no InsForge project,
// no network, no files except reading the SQL next to it. Usage:
//   npm i @electric-sql/pglite            (in any temp folder)
//   PGLITE=/abs/path/to/node_modules/@electric-sql/pglite/dist/index.js node run.mjs
// Three phases: BASELINE (original policies) -> NEW (01+02+03 applied verbatim) -> ROLLBACK (03,02,01 rollbacks).
// The expected values come from an independent JavaScript implementation of the approved rules (the "oracle"),
// not from the SQL under test.
// SAFETY: these scripts CREATE and DROP databases. They only run against a local disposable PostgreSQL.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST) || (process.env.PGHOST === undefined && process.env.PGHOSTADDR)) {
  console.error("Refusing: PGHOST must be 127.0.0.1/localhost (a disposable local PostgreSQL), never a shared or production database.");
  process.exit(2);
}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(here, "..");
// Engine: PGlite (default) or a native PostgreSQL server (PGHOST/PGPORT/PGUSER + PG_MODULE=/abs/path/to/node_modules/pg).
// The native engine creates one throwaway database per instance and drops it on close().
let PGlite;
if (process.env.PG_MODULE) {
  const { createRequire } = await import("node:module");
  const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
  let seq = 0;
  PGlite = class {
    constructor() { this.name = `rls_${process.pid}_${Date.now()}_${seq++}`; this.ready = this.init(); }
    async init() {
      const admin = new pg.Client({ database: "postgres" }); await admin.connect();
      await admin.query(`create database ${this.name}`); await admin.end();
      this.c = new pg.Client({ database: this.name }); await this.c.connect();
    }
    async exec(sql) { await this.ready; await this.c.query({ text: sql }); }
    async query(sql, params = []) { await this.ready; const r = await this.c.query(sql, params); return { rows: r.rows, affectedRows: r.rowCount }; }
    async close() {
      await this.ready; await this.c.end();
      const admin = new pg.Client({ database: "postgres" }); await admin.connect();
      await admin.query(`drop database if exists ${this.name} with (force)`); await admin.end();
    }
  };
} else ({ PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : "@electric-sql/pglite"));

// ---------------------------------------------------------------- data (single source for fixtures and oracle)
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const U = { owner: uid(1), editor: uid(2), reviewer: uid(3), viewer: uid(4), follower: uid(5), selected: uid(6), stranger: uid(7) };
const ACTORS = [
  { name: "anon", anon: true },
  { name: "stranger", uid: U.stranger },
  { name: "follower", uid: U.follower },
  { name: "selected", uid: U.selected },
  { name: "viewer", uid: U.viewer, member: "VIEWER" },
  { name: "reviewer", uid: U.reviewer, member: "REVIEWER" },
  { name: "editor", uid: U.editor, member: "EDITOR" },
  { name: "owner", uid: U.owner, member: "OWNER" },
];
const NON_DRAFT_ACTORS = ["anon", "stranger", "follower", "selected", "viewer"];
const BOOKS = [
  { n: 1, status: "PUBLISHED", access: "PUBLIC" },
  { n: 2, status: "DRAFT", access: "PUBLIC" },
  { n: 3, status: "PUBLISHED", access: "PRIVATE" },
  { n: 4, status: "PUBLISHED", access: "FOLLOWERS_ONLY" },
  { n: 5, status: "PUBLISHED", access: "SELECTED_USERS" },
  { n: 6, status: "ARCHIVED", access: "PUBLIC" },
  { n: 7, status: "PUBLISHED", access: "PUBLIC", deleted: true },
  { n: 8, status: "PUBLISHED", access: "UNLISTED" },
];
const bookId = (n) => `b0000000-0000-0000-0000-00000000000${n}`;
const phaseId = (n) => `f0000000-0000-0000-0000-00000000000${n}`;
const stepId = (n, k) => `50000000-0000-0000-0000-0000000000${n}${k}`;
const attId = (n, k) => `a0000000-0000-0000-0000-0000000000${n}${k}`;

const STEPS = [];
STEPS.push({ n: 1, k: 1, content: { slug: "s11", status: "Published", markdown: "DRAFT_SECRET_s11_newer", publishedMarkdown: "PUB_s11" } });
STEPS.push({ n: 1, k: 2, content: { slug: "s12", status: "Draft", markdown: "DRAFT_SECRET_s12" } });
STEPS.push({ n: 1, k: 3, content: { slug: "s13", status: "Published", markdown: "LEGACY_s13" } });
STEPS.push({ n: 1, k: 4, content: { slug: "s14", markdown: "LEGACY_s14" } });
for (let n = 2; n <= 8; n++) STEPS.push({ n, k: 1, content: { slug: `s${n}1`, status: "Published", markdown: `PUB_b${n}`, publishedMarkdown: `PUB_b${n}` } });
STEPS.push({ n: 2, k: 2, content: { slug: "s22", status: "Draft", markdown: "DRAFT_SECRET_b2" } });
const ATTS = [
  { n: 1, k: 1, name: "pub.pdf" }, { n: 1, k: 2, name: "draft.pdf" },
  { n: 8, k: 1, name: "unlisted.pdf" }, { n: 2, k: 2, name: "b2draft.pdf" },
];
const LABEL = new Map();
BOOKS.forEach((b) => { LABEL.set(bookId(b.n), `b${b.n}`); LABEL.set(phaseId(b.n), `p${b.n}`); });
STEPS.forEach((s) => LABEL.set(stepId(s.n, s.k), `s${s.n}${s.k}`));
ATTS.forEach((a) => LABEL.set(attId(a.n, a.k), `a${a.n}${a.k}`));
const lab = (id) => LABEL.get(id) ?? id;

// ---------------------------------------------------------------- oracle: the approved rules, written independently
const isMember = (a) => !!a.member;
function canRead(a, b) {
  if (b.deleted) return a.member === "OWNER";
  if (isMember(a)) return true;
  if (b.status !== "PUBLISHED") return false;
  if (b.access === "PUBLIC" || b.access === "UNLISTED") return true;
  if (b.access === "FOLLOWERS_ONLY") return a.name === "follower";
  if (b.access === "SELECTED_USERS") return a.name === "selected";
  return false;
}
const canDiscover = (a, b) => canRead(a, b) && (isMember(a) || b.access !== "UNLISTED");
const canDrafts = (a, b) => ["OWNER", "EDITOR", "REVIEWER"].includes(a.member) && (!b.deleted || a.member === "OWNER");
const canEdit = (a) => ["OWNER", "EDITOR"].includes(a.member);
function readerMd(c, bookStatus) {
  if (typeof c.publishedMarkdown === "string") return c.publishedMarkdown;
  if (c.status === "Published") return typeof c.markdown === "string" ? c.markdown : "";
  const missing = c.status === undefined || c.status === null || c.status === "";
  if (missing && bookStatus === "PUBLISHED" && typeof c.markdown === "string") return c.markdown;
  return null;
}
const draftMd = (c) => (typeof c.markdown === "string" ? c.markdown : readerMd(c, "PUBLISHED") ?? "");
const stepsOf = (n) => STEPS.filter((s) => s.n === n);
const attsOf = (s) => ATTS.filter((x) => x.n === s.n && x.k === s.k).map((x) => x.name).sort();
const sorted = (xs) => [...xs].sort();

function expected(a, hasObjs) {
  const e = { books: [], phases: [], members: [], access: [], stepsBase: [], search: [], attachments: [], write: {}, progress: [], tree: {} };
  for (const b of BOOKS) {
    const L = `b${b.n}`;
    if (canDiscover(a, b) || a.name === "owner") e.books.push(L);
    if (canDiscover(a, b) || canEdit(a)) e.phases.push(`p${b.n}`);
    if (canDiscover(a, b) || a.member === "OWNER") e.members.push(L);
    if (b.n === 5 && (canDiscover(a, b) || canEdit(a))) e.access.push(L);
    for (const s of stepsOf(b.n)) {
      const SL = `s${s.n}${s.k}`;
      const base = canDrafts(a, b) || canEdit(a);
      if (base) {
        e.stepsBase.push(SL);
        if (String(s.content.markdown ?? "").includes("SECRET")) e.search.push(SL);
      }
      const visible = readerMd(s.content, b.status) !== null;
      for (const nm of attsOf(s)) {
        const AL = `a${s.n}${s.k}`;
        if (ATTS.find((x) => x.n === s.n && x.k === s.k && x.name === nm) && (canDrafts(a, b) || canEdit(a) || (visible && canDiscover(a, b))) && !e.attachments.includes(AL)) e.attachments.push(AL);
      }
    }
    e.write[b.n] = canEdit(a);
    if (!a.anon && canRead(a, b)) e.progress.push(`s${b.n}1`);
    if (hasObjs) {
      for (const mode of [false, true]) {
        if (!canRead(a, b)) { e.tree[`${b.n}:${mode}`] = null; continue; }
        const drafts = mode && canDrafts(a, b);
        const steps = stepsOf(b.n)
          .map((s) => ({ id: `s${s.n}${s.k}`, md: drafts ? draftMd(s.content) : readerMd(s.content, b.status), atts: attsOf(s) }))
          .filter((s) => s.md !== null);
        e.tree[`${b.n}:${mode}`] = { book: `b${b.n}`, steps: steps.sort((x, y) => x.id.localeCompare(y.id)) };
      }
    }
  }
  if (hasObjs) {
    e.readerSteps = {};
    e.counts = {};
    for (const b of BOOKS) for (const s of stepsOf(b.n)) {
      const md = readerMd(s.content, b.status);
      if (md !== null && canDiscover(a, b)) { e.readerSteps[`s${s.n}${s.k}`] = md; e.counts[`b${b.n}`] = (e.counts[`b${b.n}`] ?? 0) + 1; }
    }
  }
  for (const k of ["books", "phases", "members", "access", "stepsBase", "search", "attachments", "progress"]) e[k] = sorted(e[k]);
  return e;
}

// ---------------------------------------------------------------- database helpers
const read = (f) => fs.readFileSync(path.join(sqlDir, f), "utf8");
const rowsOf = async (db, sql, params = []) => {
  try { return (await db.query(sql, params)).rows; } catch (err) { return { error: String(err.message).split("\n")[0].slice(0, 100) }; }
};
async function asActor(db, a, fn) {
  await db.exec("RESET ROLE");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a.uid ?? ""]);
  await db.exec(a.anon ? "SET ROLE anon" : "SET ROLE authenticated");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
const labels = (r, col = "id") => (Array.isArray(r) ? sorted(r.map((x) => lab(x[col]))) : r);

function normTree(t) {
  if (t == null) return null;
  if (t.error) return t;
  const steps = (t.phases ?? []).flatMap((p) => p.steps).map((s) => ({ id: lab(s.id), md: s.markdown, atts: (s.attachments ?? []).map((x) => x.file_name).sort() }));
  return { book: lab(t.book.id), steps: steps.sort((x, y) => x.id.localeCompare(y.id)) };
}
const MARKERS = ["DRAFT_SECRET", "'secret'", "draft.pdf", "b2draft.pdf"];

async function observe(db, a, hasObjs) {
  return asActor(db, a, async () => {
    const o = { write: {}, tree: {} };
    o.books = labels(await rowsOf(db, "select id from books"));
    o.phases = labels(await rowsOf(db, "select id from phases"));
    o.access = labels(await rowsOf(db, "select distinct book_id as id from book_access"));
    o.stepsBase = labels(await rowsOf(db, "select id from steps"));
    o.search = labels(await rowsOf(db, "select id from steps where search_vector @@ to_tsquery('english','secret')"));
    o.attachments = labels(await rowsOf(db, "select id from attachments"));
    const leakRows = [];
    for (const t of ["books", "phases", "steps", "attachments", "book_access", "book_revisions", "users"]) {
      const r = await rowsOf(db, `select to_jsonb(t)::text as j from ${t} t`);
      if (Array.isArray(r)) leakRows.push(...r.map((x) => x.j));
    }
    if (hasObjs) {
      const rs = await rowsOf(db, "select id, content->>'markdown' as md from reader_steps");
      o.readerSteps = Array.isArray(rs) ? Object.fromEntries(rs.map((x) => [lab(x.id), x.md]).sort()) : rs;
      const cs = await rowsOf(db, "select book_id, step_count from reader_book_step_counts");
      o.counts = Array.isArray(cs) ? Object.fromEntries(cs.map((x) => [lab(x.book_id), x.step_count]).sort()) : cs;
      for (const t of ["reader_steps", "reader_book_step_counts"]) {
        const r = await rowsOf(db, `select to_jsonb(t)::text as j from ${t} t`);
        if (Array.isArray(r)) leakRows.push(...r.map((x) => x.j));
      }
    }
    for (const b of BOOKS) {
      if (hasObjs) {
        for (const mode of [false, true]) {
          const r = await rowsOf(db, "select public.reader_book_tree($1::uuid, $2::boolean) as t", [bookId(b.n), mode]);
          const t = Array.isArray(r) ? r[0].t : r;
          o.tree[`${b.n}:${mode}`] = normTree(t);
          if (Array.isArray(r) && t != null) leakRows.push(JSON.stringify(t));
        }
      }
      const first = stepId(b.n, 1);
      const w = await (async () => { try { return (await db.query("update steps set title = title where id = $1", [first])).affectedRows > 0; } catch { return false; } })();
      o.write[b.n] = w;

    }
    o.progress = labels(await rowsOf(db, "select step_id as id from step_progress"));
    o.leakHits = leakRows.reduce((n, j) => n + MARKERS.filter((m) => j.includes(m)).length, 0);
    return o;
  }).finally(async () => { await db.exec("RESET ROLE"); });
}

function compare(a, obs, exp, hasObjs) {
  const bad = [];
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const keys = ["books", "phases", "members", "access", "stepsBase", "search", "attachments", "progress"];
  if (hasObjs) keys.push("readerSteps", "counts");
  for (const k of keys) if (!eq(obs[k], exp[k])) bad.push({ actor: a.name, check: k, expected: exp[k], observed: obs[k] });
  for (const b of BOOKS) {
    if (!eq(obs.write[b.n], exp.write[b.n])) bad.push({ actor: a.name, check: `write:b${b.n}`, expected: exp.write[b.n], observed: obs.write[b.n] });
    if (hasObjs) for (const mode of [false, true]) {
      const key = `${b.n}:${mode}`;
      if (!eq(obs.tree[key], exp.tree[key])) bad.push({ actor: a.name, check: `tree:b${b.n}:drafts=${mode}`, expected: exp.tree[key], observed: obs.tree[key] });
    }
  }
  return bad;
}

async function build() {
  const db = new PGlite();
  await db.exec(read("sandbox/schema.sql"));
  for (const u of Object.entries(U)) {
    await db.query("insert into auth.users(id,email) values ($1,$2)", [u[1], `${u[0]}@sandbox.invalid`]);
    await db.query("insert into users(id,name) values ($1,$2)", [u[1], u[0]]);
  }
  for (const b of BOOKS) {
    await db.query("insert into books(id,title,slug,publication_status,access_level,created_by,deleted_at) values ($1,$2,$3,$4,$5,$6,$7)",
      [bookId(b.n), `B${b.n}`, `b${b.n}`, b.status, b.access, U.owner, b.deleted ? new Date().toISOString() : null]);
    for (const [who, role] of [["editor", "EDITOR"], ["reviewer", "REVIEWER"], ["viewer", "VIEWER"]])
      await db.query("insert into book_members(book_id,user_id,role) values ($1,$2,$3)", [bookId(b.n), U[who], role]);
    await db.query("insert into phases(id,book_id,title,position) values ($1,$2,$3,1)", [phaseId(b.n), bookId(b.n), `P${b.n}`]);
  }
  await db.query("insert into user_followers(follower_id,following_id) values ($1,$2)", [U.follower, U.owner]);
  await db.query("insert into book_access(book_id,user_id) values ($1,$2)", [bookId(5), U.selected]);
  for (const s of STEPS)
    await db.query("insert into steps(id,phase_id,title,position,content) values ($1,$2,$3,$4,$5::jsonb)", [stepId(s.n, s.k), phaseId(s.n), `T${s.n}${s.k}`, s.k, JSON.stringify(s.content)]);
  // Progress policy test without raising errors: a failed INSERT leaks PGlite's tiny internal error stack and
  // panics after a few. select_step_progress and modify_step_progress share one expression, so seeding rows
  // as superuser and reading them back through RLS tests the same predicate.
  for (const a of ACTORS) if (a.uid) for (const b of BOOKS)
    await db.query("insert into step_progress(user_id, step_id, status) values ($1,$2,'COMPLETED')", [a.uid, stepId(b.n, 1)]);
  for (const x of ATTS)
    await db.query("insert into attachments(id,step_id,file_name,storage_path,file_type) values ($1,$2,$3,$4,'pdf')", [attId(x.n, x.k), stepId(x.n, x.k), x.name, `files/${x.name}`]);
  return db;
}

// PGlite's WASM build leaks Postgres's tiny internal error-stack state over a long session and eventually
// panics (ERRORDATA_STACK_SIZE exceeded). That is a sandbox limitation, not a policy problem, so every actor in
// every phase gets its own freshly built database (data-directory snapshots hang in this PGlite version).
async function freshDb(files) {
  const db = await build();
  for (const f of files) await db.exec(read(f));
  return db;
}

// book_members gets its own database: in the ORIGINAL schema the query for a member fails with a policy recursion
// (can_manage_members is not SECURITY DEFINER) and takes the whole WASM session down with it.
async function observeMembers(files, a) {
  const db = await freshDb(files);
  try { return await asActor(db, a, async () => labels(await rowsOf(db, "select distinct book_id as id from book_members"))); }
  catch (e) { return { error: String(e.message).split("\n")[0].slice(0, 100) }; }
  finally { try { await db.close(); } catch { /* session already gone */ } }
}

async function runPhase(files, title, hasObjs) {
  const all = []; const obsByActor = {}; let leaks = 0;
  for (const a of ACTORS) {
    const db = await freshDb(files);
    const obs = await observe(db, a, hasObjs);
    await db.close();
    obs.members = await observeMembers(files, a);
    obsByActor[a.name] = obs;
    if (NON_DRAFT_ACTORS.includes(a.name)) leaks += obs.leakHits;
    all.push(...compare(a, obs, expected(a, hasObjs), hasObjs));
  }
  const checks = ACTORS.length * (8 + BOOKS.length + (hasObjs ? 2 + BOOKS.length * 2 : 0));
  console.log(`\n=== ${title}`);
  console.log(`checks evaluated: ${checks}   mismatches against the approved rules: ${all.length}   draft-marker hits in non-draft actors' data: ${leaks}`);
  const byCheck = {};
  for (const m of all) (byCheck[m.check.split(":")[0]] ??= new Set()).add(m.actor);
  for (const [k, v] of Object.entries(byCheck)) console.log(`  - ${k.padEnd(12)} wrong for: ${[...v].join(", ")}`);
  return { all, snap: obsByActor, leaks };
}

async function catalog(db) {
  const f = await rowsOf(db, "select proname, pg_get_functiondef(oid) as def from pg_proc where proname in ('can_read_book','get_book_id_for_step') order by proname");
  const p = await rowsOf(db, "select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by tablename, policyname");
  return JSON.stringify({ f, p });
}

// ---------------------------------------------------------------- adversarial: direct API calls that skip the reader function
// Each actor calls the helper functions with somebody else's user id, and scans every readable table/view for the
// UNLISTED book (b8). "oracle" = a helper answered TRUE about another user's membership/permission.
async function adversarial(files, title) {
  const out = {};
  for (const a of ACTORS.filter((x) => ["anon", "stranger", "follower", "viewer"].includes(x.name))) {
    const db = await freshDb(files);
    out[a.name] = await asActor(db, a, async () => {
      const r = { oracle: [], enumerated: [], treeUnlisted: null, treeNonexistentVsPrivate: null, bookIdFromStep: null, draftViaTree: 0 };
      for (const fn of ["can_edit_book", "can_manage_members", "can_delete_book", "can_view_drafts"])
        for (const b of BOOKS) {
          const x = await rowsOf(db, `select public.${fn}($1::uuid,$2::uuid) as v`, [bookId(b.n), U.owner]);
          if (Array.isArray(x) && x[0].v === true) r.oracle.push(`${fn}(b${b.n},owner)`);
        }
      for (const b of BOOKS) {
        const x = await rowsOf(db, "select public.can_read_book($1::uuid,$2::uuid) as v", [bookId(b.n), U.stranger]);
        if (a.name !== "stranger" && Array.isArray(x) && x[0].v === true && !["anon"].includes(a.name) && a.uid !== U.stranger) r.oracle.push(`can_read_book(b${b.n},stranger)`);
      }
      const unlisted = BOOKS.find((b) => b.access === "UNLISTED");
      for (const t of ["books", "phases", "steps", "attachments", "book_members", "book_access", "book_revisions", "book_progress", "step_progress", "users", "user_followers", "reader_steps", "reader_book_step_counts"]) {
        const x = await rowsOf(db, `select to_jsonb(t)::text as j from public.${t} t`);
        if (Array.isArray(x) && x.some((y) => y.j.includes(bookId(unlisted.n)) || y.j.includes(phaseId(unlisted.n)) || y.j.includes(`b${unlisted.n}`))) r.enumerated.push(t);
      }
      const t8 = await rowsOf(db, "select public.reader_book_tree($1::uuid,false) as t", [bookId(unlisted.n)]);
      r.treeUnlisted = Array.isArray(t8) && t8[0].t != null ? "returned (link-only, by design)" : "hidden";
      const priv = await rowsOf(db, "select public.reader_book_tree($1::uuid,false) as t", [bookId(3)]);
      const none = await rowsOf(db, "select public.reader_book_tree($1::uuid,false) as t", ["00000000-0000-0000-0000-000000000000"]);
      r.treeNonexistentVsPrivate = JSON.stringify(priv) === JSON.stringify(none) ? "identical" : "DIFFERENT";
      const g = await rowsOf(db, "select public.get_book_id_for_step($1::uuid) as v", [stepId(unlisted.n, 1)]);
      r.bookIdFromStep = Array.isArray(g) ? (g[0].v ? "book id returned" : "null") : g.error;
      for (const b of BOOKS) {
        const t = await rowsOf(db, "select public.reader_book_tree($1::uuid,true) as t", [bookId(b.n)]);
        if (Array.isArray(t) && t[0].t && MARKERS.some((m) => JSON.stringify(t[0].t).includes(m)) && !(a.member && ["OWNER", "EDITOR", "REVIEWER"].includes(a.member))) r.draftViaTree++;
      }
      return r;
    });
    await db.close();
  }
  console.log(`\n=== ADVERSARIAL: ${title}`);
  for (const [k, v] of Object.entries(out))
    console.log(`  ${k.padEnd(9)} helper-oracle hits=${v.oracle.length}${v.oracle.length ? " e.g. " + v.oracle.slice(0, 3).join(", ") : ""} | unlisted found in: [${v.enumerated.join(", ") || "-"}] | tree(unlisted)=${v.treeUnlisted} | tree(private)==tree(nonexistent): ${v.treeNonexistentVsPrivate} | get_book_id_for_step=${v.bookIdFromStep} | drafts via include_drafts=true: ${v.draftViaTree}`);
  return out;
}

// ---------------------------------------------------------------- run
const WITH04 = process.env.WITH04 === "1";
const NEW_FILES = ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", ...(WITH04 ? ["04_helper_guard.sql"] : [])];
const ROLLBACK_FILES = [...(WITH04 ? ["04_rollback.sql"] : []), "03_rollback.sql", "02_rollback.sql", "01_rollback.sql"];

const probe = await build();
const sanity = await rowsOf(probe, "select count(*)::int as n from steps where search_vector @@ to_tsquery('english','secret')");
console.log(`sandbox ready on ${(await rowsOf(probe, "select version() as v"))[0].v.split(" on ")[0]}; superuser search probe finds ${sanity[0].n} step(s) with draft text (expect 3)`);
await probe.close();

const baseline = await runPhase([], "PHASE 1: BASELINE (your original policies and functions)", false);
const after = await runPhase(NEW_FILES, "PHASE 2: AFTER 01 + 02 + 03 (files applied verbatim)", true);
if (after.all.length) {
  console.log("\nfirst mismatches:");
  for (const m of after.all.slice(0, 12)) console.log("  ", JSON.stringify(m).slice(0, 300));
}
const rolled = await runPhase([...NEW_FILES, ...ROLLBACK_FILES], "PHASE 3: AFTER ROLLBACK (03, 02, 01 rollbacks)", false);

await adversarial(NEW_FILES.filter((f) => !f.startsWith('04')), 'AFTER 01 + 02 + 03 (no helper guard)');
if (WITH04) await adversarial(NEW_FILES, 'AFTER 01 + 02 + 03 + 04');

const dbA = await freshDb([]); const catBefore = await catalog(dbA); await dbA.close();
const dbB = await freshDb([...NEW_FILES, ...ROLLBACK_FILES]); const catAfter = await catalog(dbB); await dbB.close();
const sameBehaviour = JSON.stringify(rolled.snap) === JSON.stringify(baseline.snap);
const sameCatalog = catAfter === catBefore;
console.log(`\nrollback restores the baseline exactly: behaviour identical = ${sameBehaviour}, function bodies + policies identical = ${sameCatalog}`);

const ok = after.all.length === 0 && after.leaks === 0 && sameBehaviour && sameCatalog && baseline.all.length > 0;
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}  (baseline must show problems, NEW must show none, rollback must restore the baseline)`);
process.exit(ok ? 0 : 1);
