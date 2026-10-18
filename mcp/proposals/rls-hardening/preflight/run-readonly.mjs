// Runs readonly-queries.sql against the TEST project through the InsForge CLI, after guard.mjs passes.
// Default is a DRY RUN that only prints the statements it would send. Add --exec to send them.
//   EXPECTED_TEST_APPKEY=<test appkey> node run-readonly.mjs [--exec] [file.sql]
// Safety: statements must start with SELECT/WITH/SHOW, contain no second statement, no write/DDL/privilege keyword,
// and none of the characters that a shell would interpret. The CLI call uses `db query` WITHOUT --unrestricted.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const exec = process.argv.includes("--exec");
const file = process.argv.find((a, i) => i > 1 && a.endsWith(".sql")) ?? path.join(here, "readonly-queries.sql");

export function splitStatements(text) {
  const out = []; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^--\s*(Q\d+):/);
    if (m) { if (cur) out.push(cur); cur = { id: m[1], sql: "" }; continue; }
    if (!cur || line.trim().startsWith("--")) continue;
    cur.sql += (cur.sql ? " " : "") + line.trim();
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.sql);
}
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do|copy|set|reset|vacuum|lock|listen|notify|execute|prepare|comment|security|refresh|reindex|cluster|import|merge|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|set_config|pg_terminate_backend|pg_cancel_backend|nextval|setval)\b/i;
const SHELL = /["`$%!^&|<>\;]/;
export function check(stmt) {
  const s = stmt.sql;
  if (!/^(select|with|show)\b/i.test(s)) return "must start with SELECT/WITH/SHOW";
  if (SHELL.test(s)) return "contains a character the shell could interpret";
  if (FORBIDDEN.test(s.replace(/'[^']*'/g, "''"))) return "contains a write/DDL/privilege keyword";
  return null;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const stmts = splitStatements(fs.readFileSync(file, "utf8"));
  const bad = stmts.map((s) => [s.id, check(s)]).filter(([, e]) => e);
  if (bad.length) { for (const [id, e] of bad) console.error(`REFUSED ${id}: ${e}`); process.exit(2); }
  if (exec) {
    const g = spawnSync(process.execPath, [path.join(here, "guard.mjs")], { stdio: "inherit", env: process.env });
    if (g.status !== 0) process.exit(g.status ?? 2);
  }
  for (const s of stmts) {
    console.log(`\n== ${s.id}`);
    if (!exec) { console.log(s.sql); continue; }
    const r = spawnSync(`npx @insforge/cli db query "${s.sql}" --json`, { shell: true, stdio: "inherit" });
    if (r.status !== 0) { console.error(`${s.id} failed (exit ${r.status}); stopping.`); process.exit(r.status ?? 1); }
  }
  if (!exec) console.log(`\nDRY RUN: ${stmts.length} read-only statements validated, nothing sent. Re-run with --exec after guard.mjs is satisfied.`);
}
