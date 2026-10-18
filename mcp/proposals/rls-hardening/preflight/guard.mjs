// Safeguard to run BEFORE any InsForge CLI command. Reads ONLY ./.insforge/project.json of the current folder, prints
// only the project's host/app key (never keys or tokens), and exits non-zero unless this folder is linked to the project
// you named as the TEST project. It never contacts the network and never reads .env.local.
//
//   EXPECTED_TEST_APPKEY=<appkey of devbook-rls-test> node guard.mjs
//
// Refuses when: the file is missing/unparseable, no project host can be found, the app key is the production one
// (6ktij8hk), or it differs from EXPECTED_TEST_APPKEY. Fail closed: if it cannot prove the folder is the test project, it stops.
import fs from "node:fs";
import path from "node:path";

const PROD_APPKEY = "6ktij8hk";
const expected = (process.env.EXPECTED_TEST_APPKEY ?? "").trim().toLowerCase();
const die = (msg) => { console.error("GUARD STOP: " + msg); process.exit(2); };

if (!/^[a-z0-9]{6,12}$/.test(expected)) die("set EXPECTED_TEST_APPKEY to the app key of the TEST project (letters/digits only).");
if (expected === PROD_APPKEY) die("EXPECTED_TEST_APPKEY is the production app key.");

const file = path.join(process.cwd(), ".insforge", "project.json");
let raw;
try { raw = fs.readFileSync(file, "utf8"); } catch { die(`${file} not found: this folder is not linked to any project.`); }
let json;
try { json = JSON.parse(raw); } catch { die("project.json is not valid JSON."); }

// Collect every string that looks like an InsForge host; ignore every other value (they may be secrets).
const hosts = new Set();
(function walk(v) {
  if (typeof v === "string") { for (const m of v.matchAll(/https?:\/\/([a-z0-9]+)\.[a-z0-9-]+\.insforge\.app/gi)) hosts.add(m[1].toLowerCase()); }
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
})(json);
// Some link files store the app key on its own.
for (const k of ["appkey", "app_key", "appKey"]) if (typeof json[k] === "string") hosts.add(json[k].toLowerCase());

if (hosts.size === 0) die("cannot find a project host/app key in project.json; refusing to guess.");
if (hosts.has(PROD_APPKEY)) die("this folder is linked to the PRODUCTION project (" + PROD_APPKEY + ").");
if (hosts.size !== 1 || !hosts.has(expected)) die(`linked app key(s) [${[...hosts].join(", ")}] do not match EXPECTED_TEST_APPKEY (${expected}).`);

console.log(`GUARD OK: ${process.cwd()} is linked to test app key ${expected} (not production).`);
