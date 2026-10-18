// F3: a logged-in user must not create a book on behalf of another user (sandbox only, native PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... node insert-books.mjs
// Original policy: spoofed created_by succeeds and the victim becomes OWNER. Final: spoof refused, normal inserts work.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST)) { console.error("Refusing: PGHOST must be a local disposable PostgreSQL."); process.exit(2); }
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const here = path.dirname(fileURLToPath(import.meta.url));
const final = path.resolve(here, "..");
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
async function run(label, files) {
  const name = "ib_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect();
  await c.query(fs.readFileSync(path.join(final, "sandbox/schema.sql"), "utf8"));
  for (const f of files) await c.query(fs.readFileSync(path.join(final, f), "utf8"));
  for (const i of [1, 2]) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [uid(i)]); }
  const attempt = async (sql, params) => { await c.query("savepoint s"); try { await c.query(sql, params); await c.query("release savepoint s"); return true; } catch { await c.query("rollback to savepoint s"); return false; } };
  await c.query("begin");
  await c.query("reset role"); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(2)]); await c.query("set role authenticated"); // attacker = user 2
  const spoof = await attempt("insert into books(title,slug,created_by) values ('planted','planted',$1)", [uid(1)]);
  const normal = await attempt("insert into books(title,slug) values ('mine','mine')");
  const self = await attempt("insert into books(title,slug,created_by) values ('mine2','mine2',$1)", [uid(2)]);
  await c.query("reset role"); await c.query("set role anon"); await c.query("select set_config('request.jwt.claim.sub','',false)");
  const anon = await attempt("insert into books(title,slug) values ('anon','anon')");
  await c.query("reset role");
  const victimOwns = (await c.query("select count(*)::int n from book_members where user_id=$1", [uid(1)])).rows[0].n;
  await c.query("rollback"); await c.end();
  const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
  console.log(`${label.padEnd(10)} spoofed created_by=${spoof ? "ACCEPTED" : "refused"} | victim became OWNER of ${victimOwns} book(s) | normal insert=${normal ? "ok" : "REFUSED"} | created_by=self=${self ? "ok" : "REFUSED"} | anon insert=${anon ? "ACCEPTED" : "refused"}`);
  return { spoof, victimOwns, normal, self, anon };
}
const o = await run("original", []);
const f = await run("final", ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]);
const ok = o.spoof && o.victimOwns === 1 && !f.spoof && f.victimOwns === 0 && f.normal && f.self && !f.anon && !o.anon;
console.log(`RESULT: ${ok ? "PASS" : "FAIL"} (original must be exploitable, final must refuse the spoof and still accept normal inserts)`);
process.exit(ok ? 0 : 1);
