// Records reader_book_tree output for a soft-deleted book, WITHOUT and WITH 02-tree-hide-soft-deleted.patch.
//   PGHOST/PGPORT/PGUSER PG_MODULE=...  SQL_BEFORE=<dir with 01..04>  SQL_AFTER=<same dir + the patch applied>  node generate-softdelete-fixtures.mjs
// SAFETY: these scripts CREATE and DROP databases. They only run against a local disposable PostgreSQL.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST) || (process.env.PGHOST === undefined && process.env.PGHOSTADDR)) {
  console.error("Refusing: PGHOST must be 127.0.0.1/localhost (a disposable local PostgreSQL), never a shared or production database.");
  process.exit(2);
}
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rls = path.resolve(here, "..");
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const BOOK = "b0000000-0000-0000-0000-0000000000d1";
const ACTORS = { anon: null, stranger: 5, editor: 2, owner: 1 };
async function record(sqlDir) {
  const name = "sdf_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect();
  await c.query(fs.readFileSync(path.join(rls, "sandbox/schema.sql"), "utf8"));
  for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]) await c.query(fs.readFileSync(path.join(sqlDir, f), "utf8"));
  for (let i = 1; i <= 5; i++) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,$2)", [uid(i), `Author ${i}`]); }
  await c.query("insert into books(id,title,slug,publication_status,access_level,created_by,deleted_at) values ($1,'Deleted Book','deleted-book','PUBLISHED','PUBLIC',$2,now())", [BOOK, uid(1)]);
  await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'EDITOR')", [BOOK, uid(2)]);
  await c.query("insert into phases(id,book_id,title,position) values ('f0000000-0000-0000-0000-0000000000d1',$1,'P',1)", [BOOK]);
  await c.query(`insert into steps(phase_id,title,position,content) values ('f0000000-0000-0000-0000-0000000000d1','Deleted step',1,'{"status":"Published","markdown":"M","publishedMarkdown":"M"}')`);
  const out = {};
  for (const [actor, u] of Object.entries(ACTORS)) {
    await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [u ? uid(u) : ""]); await c.query(u ? "set role authenticated" : "set role anon");
    out[actor] = (await c.query("select reader_book_tree($1::uuid,true) t", [BOOK])).rows[0].t;
  }
  await c.query("reset role"); await c.end();
  const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
  return out;
}
const fx = { book: BOOK, before: await record(process.env.SQL_BEFORE ?? rls), after: await record(process.env.SQL_AFTER) };
fs.writeFileSync(path.join(here, "fixtures/softdelete-fixtures.json"), JSON.stringify(fx, null, 1));
console.log("before (owner returns tree):", fx.before.owner !== null, "| after (owner):", fx.after.owner);
