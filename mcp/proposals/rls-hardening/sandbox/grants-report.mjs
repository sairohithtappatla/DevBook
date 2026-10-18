// Exact EXECUTE grants after the proposal (sandbox only, native PostgreSQL), plus rollback behaviour.
//   PGHOST/PGPORT/PGUSER PG_MODULE=... SQL_DIR=<dir with 01..04 [+ patches applied]> [RESTRICTIVE=1: new functions are NOT executable by PUBLIC by default] node grants-report.mjs
// Effective flags come from has_function_privilege (what the role can actually do, PUBLIC included); "acl" is the raw ACL.
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
const name = "gr_" + Math.random().toString(36).slice(2, 8);
const a = new pg.Client({ database: "postgres" }); await a.connect(); await a.query(`create database ${name}`); await a.end();
const c = new pg.Client({ database: name }); await c.connect();
await c.query(rd("schema.sql"));
if (process.env.RESTRICTIVE === "1") await c.query("ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;");
const SNAP = `select p.oid::regprocedure::text as fn, coalesce(p.proacl::text,'(default: PUBLIC)') as acl,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
  coalesce((select bool_or(x.grantee = 0) from aclexplode(p.proacl) x), true) as public_exec, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`;
const snap = async () => Object.fromEntries((await c.query(SNAP)).rows.map((r) => [r.fn, r]));
const before = await snap();
for (const f of ["01_access_predicates.sql", "02_reader_objects.sql", "03_policy_switch.sql", "04_helper_guard.sql"]) await c.query(rd(f));
const after = await snap();
const NEWFN = Object.keys(after).filter((k) => !(k in before));
console.log("NEW functions and their effective EXECUTE (PUBLIC / anon / authenticated), SECURITY DEFINER:");
for (const k of NEWFN) { const r = after[k]; console.log(`  ${k.padEnd(78)} PUBLIC=${r.public_exec ? "Y" : "n"} anon=${r.anon ? "Y" : "n"} auth=${r.auth ? "Y" : "n"} definer=${r.definer ? "Y" : "n"}`); }
const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
console.log("\nPre-existing functions whose ACL/exec/definer flags changed:", changed.length ? changed.map((k) => `${k} (definer ${before[k].definer} -> ${after[k].definer}; exec ${before[k].anon}/${before[k].auth} -> ${after[k].anon}/${after[k].auth})`).join("; ") : "none");
// idempotence: re-running 02 must not change anything
await c.query(rd("02_reader_objects.sql"));
const again = await snap();
console.log("Re-running 02 changes no ACL:", JSON.stringify(Object.fromEntries(NEWFN.map((k) => [k, again[k].acl]))) === JSON.stringify(Object.fromEntries(NEWFN.map((k) => [k, after[k].acl]))));
for (const f of ["04_rollback.sql", "03_rollback.sql", "02_rollback.sql", "01_rollback.sql"]) await c.query(rd(f));
const rolled = await snap();
const leftovers = NEWFN.filter((k) => k in rolled);
const aclDrift = Object.keys(before).filter((k) => JSON.stringify({ ...before[k], definer: undefined }) !== JSON.stringify({ ...rolled[k], definer: undefined }) );
console.log("\nAfter rollback (04,03,02,01): new functions left behind:", leftovers.length ? leftovers.join(", ") : "none", "| pre-existing functions with different ACL/exec than before:", aclDrift.length ? aclDrift.join(", ") : "none");
await c.end();
const d = new pg.Client({ database: "postgres" }); await d.connect(); await d.query(`drop database ${name} with (force)`); await d.end();
