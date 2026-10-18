// 04 guard when the API does NOT switch the Postgres role (sandbox only, native PostgreSQL).
//   PGHOST/PGPORT/PGUSER PG_MODULE=... node guard-no-role.mjs
// Session stays the connecting superuser (current_setting('role') = 'none') but a JWT subject is present: this is "pooler role + JWT claims".
// Final 04 must still refuse a user asking about another user; the earlier role-only guard did not. An admin context (no JWT subject)
// must still work with any user id, and an owner asking about itself must still work.
if (!["127.0.0.1", "localhost", "::1", undefined].includes(process.env.PGHOST)) { console.error("Refusing: PGHOST must be a local disposable PostgreSQL."); process.exit(2); }
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.join(process.env.PG_MODULE, "x.js"))("pg");
const here = path.dirname(fileURLToPath(import.meta.url));
const final = path.resolve(here, "..");
const uid = (n) => `c0000000-0000-0000-0000-00000000000${n}`;
const BOOK = "b0000000-0000-0000-0000-000000000001";
async function run(label, guardTransform) {
  const name = "gn_" + Math.random().toString(36).slice(2, 8);
  const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
  const c = new pg.Client({ database: name }); await c.connect();
  await c.query(fs.readFileSync(path.join(final, "sandbox/schema.sql"), "utf8"));
  for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql"]) await c.query(fs.readFileSync(path.join(final, f), "utf8"));
  await c.query(guardTransform(fs.readFileSync(path.join(final, "04_helper_guard.sql"), "utf8")));
  for (const i of [1, 2]) { await c.query("insert into auth.users(id,email) values ($1,$2)", [uid(i), `u${i}@x.invalid`]); await c.query("insert into users(id,name) values ($1,'u')", [uid(i)]); }
  await c.query("insert into books(id,title,slug,publication_status,access_level,created_by) values ($1,'b','b','PUBLISHED','PUBLIC',$2)", [BOOK, uid(1)]);
  const ask = async (sub, asUser) => { await c.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]); return (await c.query("select can_edit_book($1::uuid,$2::uuid) v", [BOOK, asUser])).rows[0].v; };
  const role = (await c.query("select current_setting('role') r")).rows[0].r;
  const r = { role, strangerAsksAboutOwner: await ask(uid(2), uid(1)), ownerAsksAboutSelf: await ask(uid(1), uid(1)), adminAsksAboutOwner: await ask("", uid(1)) };
  await c.end();
  const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
  console.log(`${label.padEnd(26)} role=${r.role} | stranger asks about owner -> ${r.strangerAsksAboutOwner} | owner about self -> ${r.ownerAsksAboutSelf} | admin (no JWT) about owner -> ${r.adminAsksAboutOwner}`);
  return r;
}
const roleOnly = (sql) => sql.replaceAll("(current_setting('role', true) IN ('anon', 'authenticated') OR auth.uid() IS NOT NULL)", "current_setting('role', true) IN ('anon', 'authenticated')");
const old = await run("role-only guard (old)", roleOnly);
const now = await run("final guard (role OR uid)", (s) => s);
const ok = old.role === "none" && old.strangerAsksAboutOwner === true && now.strangerAsksAboutOwner === false && now.ownerAsksAboutSelf === true && now.adminAsksAboutOwner === true;
console.log(`RESULT: ${ok ? "PASS" : "FAIL"} (old guard leaks without a role switch, final guard does not, admin and self-queries unaffected)`);
process.exit(ok ? 0 : 1);
