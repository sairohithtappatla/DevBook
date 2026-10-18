// Regression test for soft-deleted books vs the reader function (sandbox only, native PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... SQL_DIR=<dir with 01..04 (+ patches applied as wanted)> EXPECT=patched|unpatched [EXTRA_FILES=file1.sql,file2.sql applied last] node softdelete.mjs
// Invariant: whenever the application's getBook() would return nothing for a book (it filters deleted_at IS NULL), 
// reader_book_tree() must return NULL for the same caller, in both include_drafts modes. EXPECT=unpatched documents the
// current gap (the OWNER of a soft-deleted book still receives the tree) and passes only if exactly that gap exists.
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
const expect = process.env.EXPECT === "unpatched" ? "unpatched" : "patched";
const rd = (f) => fs.readFileSync(path.join(f === "schema.sql" ? here : sqlDir, f), "utf8");
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const ACTORS = { anon: null, stranger: 5, viewer: 4, reviewer: 3, editor: 2, owner: 1 };
const BOOKS = { LIVE: ["b0000000-0000-0000-0000-000000000001", "PUBLISHED", null], DEL: ["b0000000-0000-0000-0000-000000000002", "PUBLISHED", "now()"], DELDRAFT: ["b0000000-0000-0000-0000-000000000003", "DRAFT", "now()"] };
const name = "sd_" + Math.random().toString(36).slice(2, 8);
const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
const c = new pg.Client({ database: name }); await c.connect();
await c.query(rd("schema.sql"));
for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql", ...(process.env.EXTRA_FILES ?? "").split(",").filter(Boolean)]) await c.query(rd(f));
for (let i = 1; i <= 5; i++) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [uid(i)]); }
let n = 0;
for (const [k, [id, status, del]] of Object.entries(BOOKS)) {
  await c.query(`insert into books(id,title,slug,publication_status,access_level,created_by,deleted_at) values ($1,$2,$3,$4,'PUBLIC',$5,${del ?? "null"})`, [id, k, k.toLowerCase(), status, uid(1)]);
  for (const [u, role] of [[2, "EDITOR"], [3, "REVIEWER"], [4, "VIEWER"]]) await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,$3)", [id, uid(u), role]);
  const ph = `f0000000-0000-0000-0000-00000000000${++n}`;
  await c.query("insert into phases(id,book_id,title,position) values ($1,$2,'P',1)", [ph, id]);
  await c.query(`insert into steps(phase_id,title,position,content) values ($1,'S',1,'{"status":"Published","markdown":"M","publishedMarkdown":"M"}')`, [ph]);
}
const violations = [], wrongHidden = [];
for (const [actor, u] of Object.entries(ACTORS)) {
  await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [u ? uid(u) : ""]); await c.query(u ? "set role authenticated" : "set role anon");
  for (const [k, [id]] of Object.entries(BOOKS)) {
    const appSees = (await c.query("select 1 from books where id=$1 and deleted_at is null", [id])).rowCount > 0; // DBService.getBook
    for (const drafts of [false, true]) {
      const t = (await c.query("select reader_book_tree($1::uuid,$2::boolean) t", [id, drafts])).rows[0].t;
      if (!appSees && t !== null) violations.push(`${actor}/${k}/drafts=${drafts}`);
      if (k === "LIVE" && !t) wrongHidden.push(`${actor}/${k}/drafts=${drafts}`);
    }
  }
}
await c.query("reset role"); await c.end();
const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
console.log(`SQL_DIR=${sqlDir}\n  soft-deleted book returned although getBook hides it: ${violations.length ? violations.join(", ") : "none"}\n  live published public book hidden from someone: ${wrongHidden.length ? wrongHidden.join(", ") : "none"}`);
const ok = expect === "patched" ? !violations.length && !wrongHidden.length
  : violations.length === 4 && violations.every((v) => v.startsWith("owner/")) && !wrongHidden.length; // owner x {DEL, DELDRAFT} x 2 modes
console.log(`EXPECT=${expect}: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
