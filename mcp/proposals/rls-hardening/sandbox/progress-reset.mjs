// Which progress rows survive a "reset progress", for different implementations? (sandbox only, native PostgreSQL)
//   PGHOST/PGPORT/PGUSER PG_MODULE=... SQL_DIR=<dir with 01..04> node progress-reset.mjs
// Rows are seeded as the superuser; every algorithm then runs as the READER (role authenticated) under RLS.
// step_progress / book_progress DDL in the sandbox is reconstructed (FK ... ON DELETE CASCADE is an assumption).
// SAFETY: these scripts CREATE and DROP databases. They only run against a local disposable PostgreSQL.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST) || (process.env.PGHOST === undefined && process.env.PGHOSTADDR)) {
  console.error("Refusing: PGHOST must be 127.0.0.1/localhost (a disposable local PostgreSQL), never a shared or production database.");
  process.exit(2);
}
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const here = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = process.env.SQL_DIR ?? path.resolve(here, "..");
const rd = (f) => fs.readFileSync(path.join(f === "schema.sql" ? here : sqlDir, f), "utf8");
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const V = uid(4);
const ID = { PUB: "b0000000-0000-0000-0000-000000000001", LOST: "b0000000-0000-0000-0000-000000000002", ARCH: "b0000000-0000-0000-0000-000000000003" };
const STEP = { s1: "50000000-0000-0000-0000-000000000001", s2: "50000000-0000-0000-0000-000000000002", s3: "50000000-0000-0000-0000-000000000003", l1: "50000000-0000-0000-0000-000000000004", a1: "50000000-0000-0000-0000-000000000005" };
const label = Object.fromEntries(Object.entries(STEP).map(([k, v]) => [v, k]));
const LABEL_BOOK = Object.fromEntries(Object.entries(ID).map(([k, v]) => [v, k]));

// The server-side fix. Uses 05_optional_reset_my_book_progress.sql from SQL_DIR when present (the final set), otherwise the
// inline prototype. Created only inside the throwaway database below; never in any migration run against a real backend.
const PROTOTYPE_INLINE = `
CREATE OR REPLACE FUNCTION public.reset_my_book_progress(target_book_id uuid) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $f$
DECLARE uid uuid := auth.uid(); n integer;
BEGIN
    IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
    DELETE FROM step_progress sp USING steps s, phases p
     WHERE sp.user_id = uid AND sp.step_id = s.id AND s.phase_id = p.id AND p.book_id = target_book_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM book_progress WHERE user_id = uid AND book_id = target_book_id;
    RETURN n;
END $f$;
REVOKE EXECUTE ON FUNCTION public.reset_my_book_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_book_progress(uuid) TO authenticated;`;
const f05 = path.join(sqlDir, "05_optional_reset_my_book_progress.sql");
const PROTOTYPE = fs.existsSync(f05) ? fs.readFileSync(f05, "utf8") : PROTOTYPE_INLINE;

async function fresh(files, extra) {
  const name = "pr_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect(); c.dbname = name;
  await c.query(rd("schema.sql"));
  for (const f of files) await c.query(rd(f));
  if (extra) await c.query(extra);
  for (const i of [1, 4]) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [uid(i)]); }
  const book = (id, title, status) => c.query("insert into books(id,title,slug,publication_status,access_level,created_by) values ($1,$2,$2,$3,'PUBLIC',$4)", [id, title, status, uid(1)]);
  await book(ID.PUB, "PUB", "PUBLISHED"); await book(ID.LOST, "LOST", "PUBLISHED"); await book(ID.ARCH, "ARCH", "PUBLISHED");
  await c.query("update books set access_level='PRIVATE' where id=$1", [ID.LOST]);        // V never was a member: no access any more
  await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'VIEWER')", [ID.PUB, V]);
  for (const [k, b] of [["PUB", "f0000000-0000-0000-0000-000000000001"], ["LOST", "f0000000-0000-0000-0000-000000000002"], ["ARCH", "f0000000-0000-0000-0000-000000000003"]])
    await c.query("insert into phases(id,book_id,title,position) values ($1,$2,'P',1)", [b, ID[k]]);
  const st = (k, ph, pos, content) => c.query("insert into steps(id,phase_id,title,position,content) values ($1,$2,$3,$4,$5::jsonb)", [STEP[k], ph, k, pos, JSON.stringify(content)]);
  const PUBC = { status: "Published", markdown: "m", publishedMarkdown: "m" };
  await st("s1", "f0000000-0000-0000-0000-000000000001", 1, PUBC);
  await st("s2", "f0000000-0000-0000-0000-000000000001", 2, { status: "Draft", markdown: "unpublished later" }); // published when V progressed, since unpublished
  await st("s3", "f0000000-0000-0000-0000-000000000001", 3, { status: "Draft", markdown: "never visible" });   // draft step; row possible only via today's leak
  await st("l1", "f0000000-0000-0000-0000-000000000002", 1, PUBC);
  await st("a1", "f0000000-0000-0000-0000-000000000003", 1, PUBC);
  for (const k of ["s1", "s2", "s3", "l1", "a1"]) await c.query("insert into step_progress(user_id,step_id,status) values ($1,$2,'COMPLETED')", [V, STEP[k]]);
  for (const b of Object.values(ID)) await c.query("insert into book_progress(user_id,book_id,progress_percentage) values ($1,$2,50)", [V, b]);
  await c.query("update books set publication_status='ARCHIVED' where id=$1", [ID.ARCH]);                   // archived AFTER progress was recorded
  return c;
}
const asV = async (c, fn) => { await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [V]); await c.query("set role authenticated"); try { return await fn(); } finally { await c.query("reset role"); } };
const remaining = async (c) => ({
  step_progress: (await c.query("select step_id from step_progress where user_id=$1", [V])).rows.map((r) => label[r.step_id]).sort(),
  book_progress: (await c.query("select book_id from book_progress where user_id=$1", [V])).rows.map((r) => LABEL_BOOK[r.book_id]).sort(),
});
const visibleToV = (c) => asV(c, async () => ({ step_progress: (await c.query("select step_id from step_progress")).rows.map((r) => label[r.step_id]).sort(), book_progress: (await c.query("select book_id from book_progress")).rows.map((r) => LABEL_BOOK[r.book_id]).sort() }));
async function drop(c) { const n = c.dbname; await c.end(); const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`drop database if exists ${n} with (force)`); await a.end(); }

// the existing client algorithm (DBService.resetBookProgress on the current tree), run as V
async function oldClient(c, bookId) {
  await asV(c, async () => {
    const ph = (await c.query("select id from phases where book_id=$1", [bookId])).rows.map((r) => r.id);
    const ids = ph.length ? (await c.query("select id from steps where phase_id = any($1::uuid[])", [ph])).rows.map((r) => r.id) : [];
    if (ids.length) await c.query("delete from step_progress where user_id=$1 and step_id = any($2::uuid[])", [V, ids]);
    await c.query("delete from book_progress where user_id=$1 and book_id=$2", [V, bookId]);
  });
}
// the proposed client algorithm: ids from reader_book_tree(book, true)
async function treeClient(c, bookId) {
  await asV(c, async () => {
    const t = (await c.query("select reader_book_tree($1::uuid,true) t", [bookId])).rows[0].t;
    const ids = t ? t.phases.flatMap((p) => p.steps.map((s) => s.id)) : [];
    if (ids.length) await c.query("delete from step_progress where user_id=$1 and step_id = any($2::uuid[])", [V, ids]);
    await c.query("delete from book_progress where user_id=$1 and book_id=$2", [V, bookId]);
  });
}
const NEW = ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql"];
const report = {}; let ok = true;
const check = (cond, msg) => { if (!cond) { ok = false; console.log("  ASSERT FAILED:", msg); } };

let c = await fresh([], null);
report["A. old client, ORIGINAL policies (today), reset PUB"] = { before: await visibleToV(c) }; await oldClient(c, ID.PUB); report["A. old client, ORIGINAL policies (today), reset PUB"].remaining = await remaining(c);
check(!report["A. old client, ORIGINAL policies (today), reset PUB"].remaining.step_progress.some((s) => ["s1", "s2", "s3"].includes(s)), "A should clear all PUB steps"); await drop(c);

c = await fresh(NEW, null); await oldClient(c, ID.PUB); report["B. old client, NEW policies, reset PUB"] = { remaining: await remaining(c) };
check(["a1", "l1", "s1", "s2", "s3"].join() === report["B. old client, NEW policies, reset PUB"].remaining.step_progress.join(), "B should clear no step rows (steps are invisible to a viewer)"); await drop(c);

c = await fresh(NEW, null); await treeClient(c, ID.PUB); report["C. tree-ids client, NEW policies, reset PUB"] = { remaining: await remaining(c), visibleToV: await visibleToV(c) };
check(["a1", "l1", "s2", "s3"].join() === report["C. tree-ids client, NEW policies, reset PUB"].remaining.step_progress.join(), "C should leave s2,s3 (+ other books)"); await drop(c);

c = await fresh(NEW, null); await treeClient(c, ID.LOST); await treeClient(c, ID.ARCH); report["D. tree-ids client, NEW policies, reset LOST and ARCH (no access any more)"] = { remaining: await remaining(c) };
check(report["D. tree-ids client, NEW policies, reset LOST and ARCH (no access any more)"].remaining.book_progress.includes("LOST") && report["D. tree-ids client, NEW policies, reset LOST and ARCH (no access any more)"].remaining.book_progress.includes("ARCH"), "D: RLS must block deleting progress of unreadable books"); await drop(c);

c = await fresh(NEW, PROTOTYPE);
const E = "E. PROTOTYPE server function reset_my_book_progress, reset PUB, LOST, ARCH";
const counts = await asV(c, async () => { const r = []; for (const b of Object.values(ID)) r.push((await c.query("select reset_my_book_progress($1::uuid) n", [b])).rows[0].n); return r; });
report[E] = { deletedStepRows: counts, remaining: await remaining(c) };
check(report[E].remaining.step_progress.length === 0 && report[E].remaining.book_progress.length === 0, "E should clear everything of V");
let anonDenied = false; try { await c.query("reset role"); await c.query("set role anon"); await c.query("select reset_my_book_progress($1::uuid)", [ID.PUB]); } catch (e) { anonDenied = /permission denied/.test(e.message); }
await c.query("reset role"); check(anonDenied, "E: anon must not be able to execute the prototype"); report[E].anonDenied = anonDenied; await drop(c);

for (const [k, v] of Object.entries(report)) console.log(`\n${k}\n  ${JSON.stringify(v)}`);
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
