// Lifecycle + privilege test on a disposable NATIVE PostgreSQL (sandbox only; never InsForge).
//   PGHOST/PGPORT/PGUSER + PG_MODULE=/abs/path/to/node_modules   [SQL_DIR=<folder holding 01..04 .sql>] node lifecycle.mjs
// Scenarios: default privileges, and "restrictive" default privileges (new functions NOT executable by PUBLIC), which
// is where an under-granted function would break. Also checks that reader_step_json is NOT callable by
// anon/authenticated while the views, the reader function and the policies still work. reader_markdown MUST stay
// executable: functions used inside a view are checked against the CALLING user, not the view owner.
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
const U = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
let failures = 0;
async function mk() {
  const name = "life_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect(); c.dbname = name; return c;
}
async function drop(c) { const n = c.dbname; await c.end(); const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`drop database if exists ${n} with (force)`); await a.end(); }
async function as(c, u, fn) {
  await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [u ? U(u) : ""]);
  await c.query(u ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await c.query("reset role"); }
}
const T = async (label, fn, expectFail = false) => {
  try { const r = await fn(); if (expectFail) { failures++; console.log("  FAIL", label, "(expected an error)"); } else console.log("  ok  ", label, r ?? ""); }
  catch (e) { if (expectFail) console.log("  ok  ", label, "-> denied:", e.message.split("\n")[0]); else { failures++; console.log("  FAIL", label, "->", e.message.split("\n")[0]); } }
};
async function scenario(title, restrictive) {
  console.log("\n" + title);
  const c = await mk();
  await c.query(rd("schema.sql"));
  if (restrictive) await c.query("ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;");
  for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]) await c.query(rd(f));
  for (let i = 1; i <= 3; i++) { await c.query("insert into auth.users(id,email) values ($1,$2)", [U(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [U(i)]); }
  let bid, ph, st;
  await T("owner creates book, phase, step, attachment, editor member", () => as(c, 1, async () => {
    bid = (await c.query("insert into books(title,slug,publication_status,access_level) values ('L','l','DRAFT','PUBLIC') returning id")).rows[0].id;
    ph = (await c.query("insert into phases(book_id,title,position) values ($1,'P',1) returning id", [bid])).rows[0].id;
    st = (await c.query(`insert into steps(phase_id,title,position,content) values ($1,'S',1,'{"status":"Draft","markdown":"DRAFT_SECRET"}') returning id`, [ph])).rows[0].id;
    await c.query("insert into attachments(step_id,file_name,storage_path,file_type) values ($1,'a.pdf','k','pdf')", [st]);
    await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'EDITOR')", [bid, U(2)]);
  }));
  await T("editor reads and edits the draft step", () => as(c, 2, async () => {
    if ((await c.query("select count(*)::int n from steps where id=$1", [st])).rows[0].n !== 1) throw new Error("editor cannot read");
    if ((await c.query("update steps set title='S2' where id=$1", [st])).rowCount !== 1) throw new Error("0 rows");
  }));
  await T("stranger sees no draft book/step/attachment", () => as(c, 3, async () => {
    const r = (await c.query("select (select count(*) from books where id=$1)::int b,(select count(*) from steps where id=$1)::int s,(select count(*) from attachments)::int a", [bid])).rows[0];
    if (r.b + r.s + r.a !== 0) throw new Error(JSON.stringify(r));
  }));
  await T("owner publishes", () => as(c, 1, async () => {
    await c.query(`update steps set content='{"status":"Published","markdown":"PUB","publishedMarkdown":"PUB"}' where id=$1`, [st]);
    await c.query("update books set publication_status='PUBLISHED' where id=$1", [bid]);
  }));
  for (const [who, u] of [["anon", null], ["stranger", 3]]) {
    await T(`${who}: reader_book_tree returns the published step and its attachment`, () => as(c, u, async () => {
      const t = (await c.query("select reader_book_tree($1::uuid,false) t", [bid])).rows[0].t;
      if (!t || t.phases[0].steps[0].markdown !== "PUB" || t.phases[0].steps[0].attachments.length !== 1) throw new Error("unexpected tree");
    }));
    await T(`${who}: reader_steps and reader_book_step_counts views work`, () => as(c, u, async () => {
      const n = (await c.query("select (select count(*) from reader_steps)::int s,(select step_count from reader_book_step_counts where book_id=$1) c", [bid])).rows[0];
      if (n.s !== 1 || n.c !== 1) throw new Error(JSON.stringify(n));
    }));
    await T(`${who}: attachments policy (step_is_reader_visible) lets the published step's attachment through`, () => as(c, u, async () => {
      if ((await c.query("select count(*)::int n from attachments")).rows[0].n !== 1) throw new Error("attachment hidden");
    }));
    await T(`${who}: reader_step_json is NOT callable`, () => as(c, u, () => c.query("select reader_step_json(null::public.steps,'PUBLISHED',false)")), true);
  }
  const priv = (await c.query("select has_function_privilege('anon','public.reader_markdown(jsonb,publication_status)','EXECUTE') a, has_function_privilege('authenticated','public.reader_step_json(public.steps,publication_status,boolean)','EXECUTE') b, has_function_privilege('anon','public.reader_book_tree(uuid,boolean)','EXECUTE') t, has_function_privilege('anon','public.step_is_reader_visible(uuid,uuid)','EXECUTE') v")).rows[0];
  await T("EXECUTE flags: markdown=true (views need it) step_json=false tree=true visible=true", async () => { if (!priv.a || priv.b || !priv.t || !priv.v) throw new Error(JSON.stringify(priv)); return JSON.stringify(priv); });
  await drop(c);
}
await scenario("A. default privileges", false);
await scenario("B. restrictive default privileges (new functions not executable by PUBLIC)", true);
console.log(failures ? `\nRESULT: ${failures} FAILURE(S)` : "\nRESULT: PASS");
process.exit(failures ? 1 : 0);
