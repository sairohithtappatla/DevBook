// can_manage_members() policy recursion (sandbox only, native PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... SQL_DIR=<final dir> node recursion.mjs
// MECHANISM (reproduced, SQLSTATE 54001 "stack depth limit exceeded"): policy modify_members is FOR ALL, so it also filters
// SELECT, and its function can_manage_members is an INVOKER function that itself selects book_members, which applies the
// same policies again. RLS ORs the permissive policies; select_members (can_read_book, SECURITY DEFINER) normally answers
// TRUE first and the OR stops, so nothing recurs. It recurses when select_members is FALSE for a row the caller can scan:
// i.e. a NON-OWNER MEMBER of a book they cannot read, which in the original rules means a SOFT-DELETED book (can_read_book
// then admits only the owner). Then modify_members -> can_manage_members -> select book_members -> same row -> ... forever.
// Every later query that scans that row (even count(*)) fails for that member; the owner never fails. Production has only
// OWNER rows (5), so it is dormant; it activates as soon as a collaborator exists on a soft-deleted book.
// Fix (01): can_manage_members becomes SECURITY DEFINER, so its inner select does not re-enter the policies.
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
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
async function run(label, files, books, withDeleted) {
  const name = "rec_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect();
  await c.query(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));
  for (const f of files) await c.query(fs.readFileSync(path.join(sqlDir, f), "utf8"));
  for (let i = 1; i <= 4; i++) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [uid(i)]); }
  for (let b = 1; b <= books; b++) {
    const id = `b0000000-0000-0000-0000-${String(b).padStart(12, "0")}`;
    await c.query("insert into books(id,title,slug,publication_status,access_level,created_by) values ($1,$2,$2,'PUBLISHED','PUBLIC',$3)", [id, "B" + b, uid(1)]);
    await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'EDITOR'),($1,$3,'VIEWER')", [id, uid(2), uid(3)]);
  }
  if (withDeleted) {
    const id = "b0000000-0000-0000-0000-0000000000dd";
    await c.query("insert into books(id,title,slug,publication_status,access_level,created_by,deleted_at) values ($1,'DEL','del','PUBLISHED','PUBLIC',$2, now())", [id, uid(1)]);
    await c.query("insert into book_members(book_id,user_id,role) values ($1,$2,'EDITOR'),($1,$3,'VIEWER')", [id, uid(2), uid(3)]);
  }
  const out = [];
  for (const [who, u] of [["owner", 1], ["editor", 2], ["viewer", 3]]) {
    await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(u)]); await c.query("set role authenticated");
    try { out.push(`${who}=${(await c.query("select count(*)::int n from book_members")).rows[0].n} rows`); } catch (e) { out.push(`${who}=ERROR ${e.code} ${e.message.split("\n")[0]}`); }
  }
  await c.query("reset role"); await c.end();
  const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
  console.log(`${label.padEnd(36)} ${out.join(" | ")}`);
  return out;
}
const ALL = ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"];
const o8 = await run("original, 8 books, none deleted", [], 8, false);
const od = await run("original, 8 books + 1 soft-deleted", [], 8, true);
const o1d = await run("original, 1 book + 1 soft-deleted", [], 1, true);
const f1 = await run("01 only, 8 books + 1 soft-deleted", ["01_access_predicates.sql"], 8, true);
const fa = await run("final 01-04, 8 + 1 soft-deleted", ALL, 8, true);
const err = (o) => o.some((x) => x.includes("ERROR"));
const ok = !err(o8) && od[1].includes("54001") && od[2].includes("54001") && !od[0].includes("ERROR") && o1d[1].includes("54001") && !err(f1) && !err(fa);
console.log(`\nfails only for non-owner members of a soft-deleted book (any dataset size); owner never fails; fixed by 01\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
