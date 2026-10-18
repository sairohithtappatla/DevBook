// Proves 00_baseline_schema.sql loads on a platform that LOOKS like the InsForge test project (facts observed there by the preflight:
// PostgreSQL 15, roles anon/authenticated/project_admin, auth.users with extra columns, auth.uid() = nullif(auth.jwt()->>'sub','')::uuid
// reading request.jwt.claims, default privileges granting arwd to anon/authenticated, no CREATE on public for them), then that 01-04 apply
// on top, a short end-to-end scenario passes, and the rollbacks restore the freshly loaded baseline. Sandbox only (local PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... node validate-loader.mjs
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST)) { console.error("Refusing: PGHOST must be a local disposable PostgreSQL."); process.exit(2); }
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const here = path.dirname(fileURLToPath(import.meta.url));
const final = path.resolve(here, "..");
const rd = (f) => fs.readFileSync(path.join((f.startsWith("00_") || f.startsWith("10_")) ? here : final, f), "utf8");
const name = "tp_" + Math.random().toString(36).slice(2, 8);
const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
const c = new pg.Client({ database: name }); await c.connect();
let fails = 0; const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails++; };

// --- InsForge-like platform
await c.query(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='project_admin') THEN CREATE ROLE project_admin NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, password text, email_verified boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), profile jsonb, metadata jsonb, is_project_admin boolean DEFAULT false, is_anonymous boolean DEFAULT false);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt() ->> 'sub', '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);

const snapshot = async () => {
  const f = (await c.query("select p.oid::regprocedure::text sig, md5(pg_get_functiondef(p.oid)) d, coalesce(p.proacl::text,'') acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1")).rows;
  const p = (await c.query("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2")).rows;
  const v = (await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind in ('v','m') order by 1")).rows;
  return JSON.stringify({ f, p, v });
};

// --- 1. the baseline loads
try { await c.query(rd("00_baseline_schema.sql")); check(true, "00_baseline_schema.sql loads on PostgreSQL " + (await c.query("show server_version")).rows[0].server_version); }
catch (e) { check(false, "baseline failed to load: " + e.message); process.exit(1); }
const counts = (await c.query("select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r')::int t, (select count(*) from pg_policies where schemaname='public')::int p, (select count(*) from pg_trigger where not tgisinternal)::int g, (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e')::int e")).rows[0];
check(counts.t === 11 && counts.p === 24 && counts.e === 5 && counts.g === 7, `objects: ${JSON.stringify(counts)} (expect 11 tables, 24 policies, 5 enums, 7 triggers)`);
check((await c.query("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity")).rows[0].n === 0, "RLS is enabled on every table");
const baseline = await snapshot();

// --- 2. users and a scenario BEFORE hardening (reproduces the leak on the platform-like setup)
const U = { owner: "c0000000-0000-0000-0000-000000000001", stranger: "c0000000-0000-0000-0000-000000000002" };
for (const [k, id] of Object.entries(U)) { await c.query("insert into auth.users(id,email,email_verified) values ($1,$2,true)", [id, `${k}@example.invalid`]); await c.query("insert into public.users(id,name) values ($1,$2)", [id, k]); }
const as = async (sub, role, fn) => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims',$1,false)", [sub ? JSON.stringify({ sub }) : ""]); await c.query(`set role ${role}`); try { return await fn(); } finally { await c.query("reset role"); } };
let bookId;
await as(U.owner, "authenticated", async () => {
  bookId = (await c.query("insert into books(title,slug,publication_status,access_level) values ('B','b','PUBLISHED','PUBLIC') returning id")).rows[0].id;
  const ph = (await c.query("insert into phases(book_id,title,position) values ($1,'P',1) returning id", [bookId])).rows[0].id;
  await c.query(`insert into steps(phase_id,title,position,content) values ($1,'S1',1,'{"status":"Published","markdown":"newer DRAFT_TEXT","publishedMarkdown":"PUB_TEXT"}'),($1,'S2',2,'{"status":"Draft","markdown":"DRAFT_ONLY"}')`, [ph]);
});
const leakBefore = await as(null, "anon", async () => (await c.query("select count(*)::int n from steps where content::text like '%DRAFT%'")).rows[0].n);
check(leakBefore === 2, `baseline reproduces the leak for anon (draft steps readable: ${leakBefore})`);

// --- 3. hardening applies on top
for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]) {
  try { await c.query(rd(f)); check(true, `${f} applies`); } catch (e) { check(false, `${f} failed: ${e.message}`); }
}
check(await as(null, "anon", async () => (await c.query("select count(*)::int n from steps")).rows[0].n) === 0, "after 03: anon reads no steps from the base table");
const tree = await as(null, "anon", async () => (await c.query("select reader_book_tree($1::uuid,true) t", [bookId])).rows[0].t);
check(tree && JSON.stringify(tree).includes("PUB_TEXT") && !JSON.stringify(tree).includes("DRAFT"), "after 02/03: anon gets the published text only through reader_book_tree");
const ownerTree = await as(U.owner, "authenticated", async () => (await c.query("select reader_book_tree($1::uuid,true) t", [bookId])).rows[0].t);
check(JSON.stringify(ownerTree).includes("DRAFT_ONLY"), "owner still gets draft steps with include_drafts=true");
check(await as(U.stranger, "authenticated", async () => (await c.query("select can_edit_book($1::uuid,$2::uuid) v", [bookId, U.owner])).rows[0].v) === false, "04: a signed-in stranger cannot ask whether the owner edits the book");
const priv = (await c.query("select has_function_privilege('anon','public.reader_step_json(public.steps,publication_status,boolean)','EXECUTE') a, has_function_privilege('anon','public.reader_markdown(jsonb,publication_status)','EXECUTE') b")).rows[0];
check(priv.a === false && priv.b === true, "reader_step_json not executable by anon, reader_markdown is");

// --- 3b. the TEST-project seed loads and the hand-written API expectations hold against the real reader function
const { verify, ACTORS } = await import(path.join(final, "..", "rpc-expectations.mjs"));
const EMAILS = { owner: "owner", editor: "editor", reviewer: "reviewer", viewer: "viewer", stranger: "stranger" };
const ids = {};
for (const k of Object.keys(EMAILS)) {
  const r = await c.query("select id from auth.users where email = $1", [`${k}@example.invalid`]);
  ids[k] = r.rows[0]?.id ?? (await c.query("insert into auth.users(id,email,email_verified) values (gen_random_uuid(),$1,true) returning id", [`${k}@example.invalid`])).rows[0].id;
}
await c.query("delete from books where id = $1", [bookId]); // scenario book from above; keep the fixture clean
try { await c.query(rd("10_seed_fixture.sql")); check(true, "10_seed_fixture.sql loads"); } catch (e) { check(false, "seed failed: " + e.message); }
const bk = Object.fromEntries((await c.query("select slug, id from books where slug like 'fx-%'")).rows.map((r) => [r.slug, r.id]));
const BOOKMAP = { PUB: bk["fx-public"], EMPTY: bk["fx-empty"], UNL: bk["fx-unlisted"], DRAFTBOOK: bk["fx-draft"], DELETED: bk["fx-deleted"] };
let bad = 0, total = 0;
for (const actor of ACTORS) for (const [name, id] of Object.entries(BOOKMAP)) for (const drafts of [false, true]) {
  const t = await as(actor === "anon" ? null : ids[actor], actor === "anon" ? "anon" : "authenticated", async () => (await c.query("select reader_book_tree($1::uuid,$2::boolean) t", [id, drafts])).rows[0].t);
  const problems = verify(actor, name, drafts, t ?? null); total++;
  if (problems.length) { bad++; console.log("   ", actor, name, drafts, problems.join("; ").slice(0, 160)); }
}
check(bad === 0, `rpc-expectations hold against reader_book_tree for the seeded fixture (${total} combinations)`);
const rec = await as(ids.editor, "authenticated", async () => (await c.query("select count(*)::int n from book_members")).rows[0].n).catch((e) => e.message);
check(typeof rec === "number", "editor can read book_members (recursion fixed) - " + rec);
await c.query(rd("10_seed_rollback.sql"));
check((await c.query("select count(*)::int n from books where slug like 'fx-%'")).rows[0].n === 0, "10_seed_rollback.sql removes the fixture");

// --- 4. rollbacks restore the freshly loaded baseline
for (const f of ["04_rollback.sql", "03_rollback.sql", "02_rollback.sql", "01_rollback.sql"]) {
  try { await c.query(rd(f)); } catch (e) { check(false, `${f} failed: ${e.message}`); }
}
check((await snapshot()) === baseline, "after rolling back 04,03,02,01: functions (body+ACL), policies and views equal the loaded baseline");
await c.end();
const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
console.log(fails ? `RESULT: ${fails} FAILURE(S)` : "RESULT: PASS");
process.exit(fails ? 1 : 0);
