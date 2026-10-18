// 04_helper_guard.sql re-defines seven functions (CREATE OR REPLACE) with a guard block added. If 01/02 are edited later
// and 04 is not, 04 silently reverts the edit. This check fails when any function body in 04 differs from its source
// (01, 02 or the original schema) by anything other than the guard block, and likewise for 04_rollback.sql (which must
// equal the source exactly).
//   node check-04-drift.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => fs.readFileSync(path.join(here, f), "utf8").replace(/\r\n/g, "\n"); // tolerate CRLF checkouts
const blocks = (s) => Object.fromEntries([...s.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(.*?\$function\$;/gs)].map((m) => [m[1], m[0]]));
const norm = (t) => t.replace(/\s+/g, " ").replace(/\s*\(\s*/g, "(").trim();
const GUARD = /\n\s*-- 04: the caller may only ask about itself[^\n]*\n\s*IF \(current_setting\('role', true\) IN \('anon', 'authenticated'\) OR auth\.uid\(\) IS NOT NULL\) AND req_user_id IS DISTINCT FROM auth\.uid\(\) THEN\n\s*RETURN FALSE;\n\s*END IF;\n/;
const sources = { ...blocks(rd("sandbox/schema.sql")), ...blocks(rd("02_reader_objects.sql")), ...blocks(rd("01_access_predicates.sql")) };
let bad = 0;
const g = blocks(rd("04_helper_guard.sql")), r = blocks(rd("04_rollback.sql"));
for (const [name, body] of Object.entries(g)) {
  if (!GUARD.test(body)) { console.log(`MISSING GUARD in 04 for ${name}`); bad++; continue; }
  if (norm(body.replace(GUARD, "\n")) !== norm(sources[name])) { console.log(`DRIFT: 04_helper_guard.sql ${name} differs from its source beyond the guard`); bad++; }
  if (!r[name] || norm(r[name]) !== norm(sources[name])) { console.log(`DRIFT: 04_rollback.sql ${name} is not the source body`); bad++; }
}
console.log(`${Object.keys(g).length} functions checked; ${bad ? bad + " problem(s)" : "04 is in sync with 01/02/schema"}`);
process.exit(bad ? 1 : 0);
