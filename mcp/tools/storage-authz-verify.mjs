// Signed-in storage authorization checks for migration 09 (rev 2.1) on the InsForge TEST project ONLY.
//
// Target identity: taken from ./.insforge/project.json of the CURRENT folder (the project the CLI is linked to), and it must equal
// EXPECTED_TEST_APPKEY and must not be production. A wrong or missing env value, or a folder linked elsewhere, stops the run.
// Credentials: per role either <ROLE>_TOKEN (an ordinary user access token) or <ROLE>_EMAIL + <ROLE>_PASSWORD, from the environment
// only. Nothing secret is printed. Every token is checked with GET /api/auth/sessions/current: role must be `authenticated` and the
// user id must equal <ROLE>_ID, so an admin/API key can never be used by mistake.
// Objects: only `rv-<RUN_ID>-…` keys are created; they are recorded in RUN_FILE and only those are deleted. Cleanup runs in a
// finally block and is idempotent (an already-deleted object counts as clean).
//
//   node mcp/tools/storage-authz-verify.mjs [--keep]       run the matrix (with --keep, leave the run's objects for inspection)
//   node mcp/tools/storage-authz-verify.mjs --cleanup      delete the objects listed in RUN_FILE, then verify they are gone
// Required env: EXPECTED_TEST_APPKEY, RUN_ID, RUN_FILE, OWNER_*, EDITOR_*, REVIEWER_*, VIEWER_*, STRANGER_* (TOKEN or EMAIL+PASSWORD, plus ID),
//   PUB_STEP (published step of a PUBLIC book the owner owns), DRAFT_STEP (draft-only step of that book),
//   RESTRICTED_STEP (published step of a book the stranger may NOT read). Optional: PUBLIC_BUCKET/PUBLIC_KEY, PRIVATE_BUCKET/PRIVATE_KEY.
import fs from "node:fs";
import path from "node:path";

const PROD = "6ktij8hk";
const die = (m) => { console.error("STOP: " + m); process.exit(2); };
const expected = (process.env.EXPECTED_TEST_APPKEY ?? "").trim().toLowerCase();
if (!/^[a-z0-9]{6,12}$/.test(expected) || expected === PROD) die("EXPECTED_TEST_APPKEY must be the TEST app key (never production)");
let linked;
try { linked = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".insforge", "project.json"), "utf8")); } catch { die("run from the folder linked to the TEST project (.insforge/project.json missing)"); }
const hosts = new Set();
(function walk(v) { if (typeof v === "string") for (const m of v.matchAll(/https?:\/\/([a-z0-9]+)\.([a-z0-9-]+)\.insforge\.app/gi)) hosts.add(`${m[1].toLowerCase()}|${m[2].toLowerCase()}`); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(linked);
const appkeys = new Set([...hosts].map((h) => h.split("|")[0]));
if (appkeys.has(PROD)) die("this folder is linked to PRODUCTION");
if (appkeys.size !== 1 || !appkeys.has(expected)) die(`linked project app key does not match EXPECTED_TEST_APPKEY`);
const region = [...hosts][0].split("|")[1];
const HOST = `https://${expected}.${region}.insforge.app`;

const RUN = process.env.RUN_ID ?? "";
const RUN_FILE = process.env.RUN_FILE ?? "";
if (!/^[a-z0-9]{4,16}$/.test(RUN) || !RUN_FILE) die("RUN_ID (a-z0-9) and RUN_FILE are required");
const CLEANUP_ONLY = process.argv.includes("--cleanup"), KEEP = process.argv.includes("--keep");

const secretVals = Object.entries(process.env).filter(([k]) => /_(TOKEN|PASSWORD)$/.test(k)).map(([, v]) => v).filter(Boolean);
const red = (s) => secretVals.reduce((a, x) => a.split(x).join("<redacted>"), String(s)).replace(/eyJ[A-Za-z0-9._-]{10,}/g, "<token>");
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + red(detail).slice(0, 170) : ""}`); };
const enc = (k) => k.split("/").map(encodeURIComponent).join("/");
const objUrl = (b, k) => `${HOST}/api/storage/buckets/${b}/objects/${enc(k)}`;
const ok2 = (s) => s >= 200 && s < 300;
const H = (t) => (t ? { Authorization: `Bearer ${t}` } : {});

async function tokenFor(role) {
  if (process.env[`${role}_TOKEN`]) return process.env[`${role}_TOKEN`];
  const email = process.env[`${role}_EMAIL`], password = process.env[`${role}_PASSWORD`];
  if (!email || !password) die(`${role}: provide ${role}_TOKEN or ${role}_EMAIL/${role}_PASSWORD`);
  const r = await fetch(`${HOST}/api/auth/sessions?client_type=server`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "password", email, password }) });
  const j = await r.json().catch(() => ({}));
  if (!j.accessToken) die(`${role}: sign-in failed (HTTP ${r.status})`);
  return j.accessToken;
}
// Identity = the SERVER confirms the user id behind the token (GET /api/auth/sessions/current; on TEST this response carries no
// `role` field, unlike the docs), AND the token is a user JWT whose `role` claim is `authenticated` (decoded locally, never printed).
// An admin/API key is not a user JWT, so it fails the claim check and the run stops.
function jwtClaims(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); } catch { return null; }
}
async function verifyIdentity(role, token) {
  const r = await fetch(`${HOST}/api/auth/sessions/current`, { headers: H(token) });
  const j = await r.json().catch(() => ({}));
  const claims = jwtClaims(token);
  const okId = !!j?.user?.id && j.user.id === process.env[`${role}_ID`] && claims?.sub === j.user.id;
  const okRole = claims?.role === "authenticated";
  check(`identity: server confirms ${role}_ID behind the token; token role claim 'authenticated' (not admin)`, r.status === 200 && okId && okRole, `HTTP ${r.status} claim role=${claims?.role ?? "none"}`);
  if (!(r.status === 200 && okId && okRole)) die(`${role} identity check failed; refusing to test with this credential`);
}
async function put(t, b, k, text) { const f = new FormData(); f.append("file", new Blob([text], { type: "text/plain" }), "probe.txt"); const r = await fetch(objUrl(b, k), { method: "PUT", headers: H(t), body: f }); return { status: r.status, body: await r.text() }; }
async function get(t, b, k) { const r = await fetch(objUrl(b, k), { headers: H(t), redirect: "follow" }); return { status: r.status, body: await r.text() }; }
async function del(t, b, k) { const r = await fetch(objUrl(b, k), { method: "DELETE", headers: H(t) }); return { status: r.status, body: await r.text() }; }

const created = fs.existsSync(RUN_FILE) ? JSON.parse(fs.readFileSync(RUN_FILE, "utf8")) : [];
const record = (bucket, key, uploaderRole) => { if (!created.some((c) => c.bucket === bucket && c.key === key)) created.push({ bucket, key, uploaderRole }); fs.writeFileSync(RUN_FILE, JSON.stringify(created, null, 2)); };
const isRunKey = (k) => k.split("/").pop().startsWith(`rv-${RUN}-`);

async function cleanup(tokens) {
  let allGone = true;
  for (const c of [...created]) {
    if (!isRunKey(c.key)) { console.log(`skip (not a key of run ${RUN}): ${c.bucket}/${c.key}`); continue; }
    const t = tokens[c.uploaderRole] ?? tokens.OWNER;
    const d = await del(t, c.bucket, c.key);
    const g = await get(tokens.OWNER, c.bucket, c.key);
    const gone = !ok2(g.status);
    if (!gone) allGone = false;
    console.log(`${gone ? "PASS" : "FAIL"} cleanup ${c.bucket}/${c.key}: delete HTTP ${d.status}, now ${gone ? "absent" : "STILL PRESENT"}`);
  }
  if (allGone) fs.writeFileSync(RUN_FILE, "[]");
  return allGone;
}

const roles = ["OWNER", "EDITOR", "REVIEWER", "VIEWER", "STRANGER"];
const T = {};
for (const r of roles) T[r] = await tokenFor(r);
for (const r of roles) await verifyIdentity(r, T[r]);

if (CLEANUP_ONLY) { const ok = await cleanup(T); console.log(`\nCLEANUP: ${ok ? "COMPLETE" : "INCOMPLETE"}`); process.exit(ok ? 0 : 1); }

const PUBSTEP = process.env.PUB_STEP, DRAFTSTEP = process.env.DRAFT_STEP, RSTEP = process.env.RESTRICTED_STEP;
if (!PUBSTEP || !DRAFTSTEP || !RSTEP) die("PUB_STEP, DRAFT_STEP and RESTRICTED_STEP are required");
const K = { pub: `${PUBSTEP}/rv-${RUN}-owner-pub.txt`, draft: `${DRAFTSTEP}/rv-${RUN}-owner-draft.txt`, ed: `${PUBSTEP}/rv-${RUN}-editor.txt`, restricted: `${RSTEP}/rv-${RUN}-restricted.txt` };
const TXT = { pub: `rv ${RUN} owner published-step probe\n`, draft: `rv ${RUN} owner draft-step probe\n`, ed: `rv ${RUN} editor probe\n`, restricted: `rv ${RUN} restricted-book probe\n` };
let r;
try {
  // A. owner/editor authorized access
  r = await put(T.OWNER, "book-assets", K.pub, TXT.pub); if (ok2(r.status)) record("book-assets", K.pub, "OWNER"); check("A1 owner uploads under the published step", ok2(r.status), `HTTP ${r.status} ${r.body}`);
  r = await put(T.OWNER, "book-assets", K.draft, TXT.draft); if (ok2(r.status)) record("book-assets", K.draft, "OWNER"); check("A2 owner uploads under the draft-only step", ok2(r.status), `HTTP ${r.status} ${r.body}`);
  r = await put(T.OWNER, "book-assets", K.restricted, TXT.restricted); if (ok2(r.status)) record("book-assets", K.restricted, "OWNER"); check("A3 owner uploads into the restricted (SELECTED_USERS) book", ok2(r.status), `HTTP ${r.status} ${r.body}`);
  r = await put(T.EDITOR, "book-assets", K.ed, TXT.ed); if (ok2(r.status)) record("book-assets", K.ed, "EDITOR"); check("A4 editor uploads", ok2(r.status), `HTTP ${r.status} ${r.body}`);
  r = await get(T.OWNER, "book-assets", K.ed); check("A5 owner downloads the editor's object", r.status === 200 && r.body === TXT.ed, `HTTP ${r.status}`);
  r = await get(T.EDITOR, "book-assets", K.draft); check("A6 editor downloads the owner's draft-step object", r.status === 200 && r.body === TXT.draft, `HTTP ${r.status}`);
  const upd = `rv ${RUN} owner published-step probe v2\n`;
  r = await put(T.OWNER, "book-assets", K.pub, upd); const v2 = await get(T.OWNER, "book-assets", K.pub);
  check("A7 owner overwrites its own object (legitimate update)", ok2(r.status) && v2.body === upd, `HTTP ${r.status}`); TXT.pub = v2.status === 200 ? v2.body : TXT.pub;
  // C. reader rules
  r = await get(T.REVIEWER, "book-assets", K.draft); check("C1 reviewer downloads the draft-step object (draft viewer)", r.status === 200 && r.body === TXT.draft, `HTTP ${r.status}`);
  r = await get(T.VIEWER, "book-assets", K.draft); check("C2 viewer cannot download the draft-step object", !ok2(r.status) && r.body !== TXT.draft, `HTTP ${r.status}`);
  r = await get(T.VIEWER, "book-assets", K.pub); check("C3 viewer downloads the published-step object", r.status === 200 && r.body === TXT.pub, `HTTP ${r.status}`);
  r = await get(T.STRANGER, "book-assets", K.pub); check("C4 signed-in stranger downloads a published attachment of a PUBLIC book (discoverable)", r.status === 200 && r.body === TXT.pub, `HTTP ${r.status}`);
  r = await get(T.OWNER, "book-assets", `00000000-0000-4000-8000-000000000000/rv-${RUN}-x.txt`); check("C5 unknown step id is denied/not found (even for the owner)", !ok2(r.status), `HTTP ${r.status}`);
  r = await put(T.OWNER, "book-assets", `not-a-step/rv-${RUN}-malformed.txt`, "x"); if (ok2(r.status)) record("book-assets", `not-a-step/rv-${RUN}-malformed.txt`, "OWNER"); check("C6 owner cannot upload under a malformed (non step-UUID) prefix", !ok2(r.status), `HTTP ${r.status}`);
  r = await put(T.OWNER, "book-assets", `rv-${RUN}-root.txt`, "x"); if (ok2(r.status)) record("book-assets", `rv-${RUN}-root.txt`, "OWNER"); check("C7 owner cannot upload at the bucket root (no step prefix)", !ok2(r.status), `HTTP ${r.status}`);
  // B. unauthorized cross-user access (each denial is followed by a content check)
  r = await get(T.STRANGER, "book-assets", K.draft); check("B1 stranger cannot download a known DRAFT-step key", !ok2(r.status) && r.body !== TXT.draft, `HTTP ${r.status}`);
  r = await get(T.STRANGER, "book-assets", K.restricted); check("B2 stranger cannot download a published attachment of a book it may not read", !ok2(r.status) && r.body !== TXT.restricted, `HTTP ${r.status}`);
  r = await put(T.STRANGER, "book-assets", `${PUBSTEP}/rv-${RUN}-stranger.txt`, "x"); if (ok2(r.status)) record("book-assets", `${PUBSTEP}/rv-${RUN}-stranger.txt`, "STRANGER"); check("B3 stranger cannot upload into the book", !ok2(r.status), `HTTP ${r.status}`);
  r = await put(T.STRANGER, "book-assets", K.pub, "overwritten by stranger"); const b4 = await get(T.OWNER, "book-assets", K.pub);
  check("B4 stranger cannot overwrite a known key; content unchanged", !ok2(r.status) && b4.body === TXT.pub, `HTTP ${r.status} / owner sees ${b4.status}`);
  r = await del(T.STRANGER, "book-assets", K.draft); const b5 = await get(T.OWNER, "book-assets", K.draft);
  check("B5 stranger cannot delete another user's object; object intact", b5.status === 200 && b5.body === TXT.draft, `delete HTTP ${r.status} / owner sees ${b5.status}`);
  r = await put(T.VIEWER, "book-assets", `${PUBSTEP}/rv-${RUN}-viewer.txt`, "x"); if (ok2(r.status)) record("book-assets", `${PUBSTEP}/rv-${RUN}-viewer.txt`, "VIEWER"); check("B6 viewer cannot upload", !ok2(r.status), `HTTP ${r.status}`);
  r = await put(T.VIEWER, "book-assets", K.pub, "overwritten by viewer"); const b7 = await get(T.OWNER, "book-assets", K.pub); check("B7 viewer cannot overwrite; content unchanged", !ok2(r.status) && b7.body === TXT.pub, `HTTP ${r.status}`);
  r = await del(T.VIEWER, "book-assets", K.ed); const b8 = await get(T.OWNER, "book-assets", K.ed); check("B8 viewer cannot delete; object intact", b8.status === 200 && b8.body === TXT.ed, `delete HTTP ${r.status}`);
  r = await put(T.REVIEWER, "book-assets", `${PUBSTEP}/rv-${RUN}-reviewer.txt`, "x"); if (ok2(r.status)) record("book-assets", `${PUBSTEP}/rv-${RUN}-reviewer.txt`, "REVIEWER"); check("B9 reviewer (read-only role) cannot upload", !ok2(r.status), `HTTP ${r.status}`);
  // D. other buckets are not widened
  if (process.env.PUBLIC_BUCKET && process.env.PUBLIC_KEY) {
    const pb = process.env.PUBLIC_BUCKET, pk = process.env.PUBLIC_KEY;
    const before = await get(null, pb, pk);
    check("D1 public probe object downloadable anonymously", before.status === 200, `HTTP ${before.status}`);
    r = await put(T.STRANGER, pb, pk, "overwritten"); check("D2 signed-in user cannot overwrite in the public probe bucket", !ok2(r.status), `HTTP ${r.status}`);
    r = await put(T.OWNER, pb, `rv-${RUN}-new.txt`, "x"); if (ok2(r.status)) record(pb, `rv-${RUN}-new.txt`, "OWNER"); check("D3 signed-in user cannot upload into the public probe bucket (09 grants nothing outside book-assets)", !ok2(r.status), `HTTP ${r.status}`);
    r = await del(T.OWNER, pb, pk); check("D4 signed-in user cannot delete in the public probe bucket", !ok2(r.status), `HTTP ${r.status}`);
    const after = await get(null, pb, pk); check("D5 public probe object unchanged", after.status === 200 && after.body === before.body, `HTTP ${after.status}`);
  }
  if (process.env.PRIVATE_BUCKET && process.env.PRIVATE_KEY) {
    const vb = process.env.PRIVATE_BUCKET, vk = process.env.PRIVATE_KEY;
    for (const role of ["OWNER", "STRANGER"]) { r = await get(T[role], vb, vk); check(`D6 ${role.toLowerCase()} cannot download from the private probe bucket`, !ok2(r.status), `HTTP ${r.status}`); }
    r = await put(T.OWNER, vb, `rv-${RUN}-new.txt`, "x"); if (ok2(r.status)) record(vb, `rv-${RUN}-new.txt`, "OWNER"); check("D7 signed-in user cannot upload into the private probe bucket", !ok2(r.status), `HTTP ${r.status}`);
    r = await del(T.STRANGER, vb, vk); check("D8 signed-in user cannot delete in the private probe bucket", !ok2(r.status), `HTTP ${r.status}`);
  }
} catch (e) {
  check("harness ran without an unexpected error", false, e.message);
} finally {
  if (KEEP) console.log(`\nKEEP: ${created.length} object(s) of run ${RUN} left in place and listed in RUN_FILE`);
  else await cleanup(T);
}
const fails = results.filter((x) => !x.ok).length;
console.log(`\nRESULT: ${fails ? "FAIL" : "PASS"} (${results.length - fails}/${results.length}) run ${RUN}`);
process.exit(fails ? 1 : 0);
