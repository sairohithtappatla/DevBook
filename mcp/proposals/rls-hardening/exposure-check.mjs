// READ-ONLY exposure check through the real InsForge/PostgREST API of the TEST project. Never run it against production.
// It issues SELECTs and RPC reads only, then scans every response for draft markers. It is the part of D-d the
// in-memory sandbox cannot cover: actual API exposure, view ownership, grants and RPC visibility.
//
//   CONFIRM_TEST_PROJECT=yes EXPECTED_TEST_APPKEY=<test app key> TEST_URL=https://<test-appkey>.<region>.insforge.app TEST_ANON_KEY=<test anon key> \
//   [ACTOR_EMAIL=... ACTOR_PASSWORD=...] [ACTOR_ROLE=reader|draft-viewer] [PROBE_BOOK_IDS=id1,id2,...] [PROBE_USER_ID=<test owner uuid>] \
//   [MARKERS=DRAFT_SECRET,draft.pdf] node mcp/proposals/rls-hardening/exposure-check.mjs
//
// ACTOR_ROLE=reader (default) means: any marker found is a FAILURE (anon, stranger, follower, selected, viewer).
// ACTOR_ROLE=draft-viewer (owner, editor, reviewer) means: markers are expected; the run only reports counts.
// Use the test project's own anon key and test accounts. Never the production key.

const PROD_APPKEY = "6ktij8hk";
const { TEST_URL, TEST_ANON_KEY, CONFIRM_TEST_PROJECT, ACTOR_EMAIL, ACTOR_PASSWORD } = process.env;
if (CONFIRM_TEST_PROJECT !== "yes" || !TEST_URL || !TEST_ANON_KEY) {
  console.error("Refusing: set CONFIRM_TEST_PROJECT=yes, TEST_URL and TEST_ANON_KEY for the TEST project.");
  process.exit(2);
}
// Second lock: the app key of the TEST project must be named explicitly and must be the first label of TEST_URL's host.
{
  const expected = (process.env.EXPECTED_TEST_APPKEY ?? "").trim().toLowerCase();
  const u = new URL(TEST_URL);
  const label = u.hostname.split(".")[0].toLowerCase();
  const local = ["127.0.0.1", "localhost"].includes(u.hostname);
  if (!local && (u.protocol !== "https:" || !/^[a-z0-9]{6,12}$/.test(expected) || expected === PROD_APPKEY || label !== expected)) {
    console.error("Refusing: set EXPECTED_TEST_APPKEY to the TEST project's app key; it must equal the first label of an https TEST_URL and must not be the production key.");
    process.exit(2);
  }
}
if (new URL(TEST_URL).host.includes(PROD_APPKEY)) {
  console.error("Refusing: TEST_URL points at the production project.");
  process.exit(2);
}
const role = process.env.ACTOR_ROLE === "draft-viewer" ? "draft-viewer" : "reader";
const markers = (process.env.MARKERS ?? "DRAFT_SECRET,draft.pdf").split(",").filter(Boolean);
const probeBooks = (process.env.PROBE_BOOK_IDS ?? "").split(",").filter(Boolean);

const { createClient } = await import("@insforge/sdk"); // loaded only after every safety check above passed
const client = createClient({ baseUrl: TEST_URL, anonKey: TEST_ANON_KEY });
let who = "anon";
if (ACTOR_EMAIL && ACTOR_PASSWORD) {
  const { error } = await client.auth.signInWithPassword({ email: ACTOR_EMAIL, password: ACTOR_PASSWORD });
  if (error) { console.error("Sign-in failed:", error.message ?? error); process.exit(2); }
  who = ACTOR_EMAIL.replace(/(^.).*(@.*$)/, "$1***$2");
}

const results = [];
function record(name, res) {
  const err = res.error ? String(res.error.message ?? res.error).slice(0, 80) : null;
  const text = JSON.stringify(res.data ?? null);
  const hits = markers.filter((m) => text.includes(m));
  const rows = Array.isArray(res.data) ? res.data.length : res.data == null ? 0 : 1;
  const vector = /search_vector/.test(text) ? " [search_vector column present]" : "";
  results.push({ name, rows, hits, err });
  console.log(`${err ? "ERR " : hits.length ? "HIT " : "ok  "} ${name.padEnd(48)} rows=${rows}${typeof res.data === "boolean" ? ` value=${res.data}` : ""}${hits.length ? ` markers=${hits.join("|")}` : ""}${vector}${err ? ` (${err})` : ""}`);
}

console.log(`actor: ${who} (${role}); markers: ${markers.join(", ")}\n`);
for (const t of ["books", "phases", "steps", "attachments", "book_members", "book_access", "book_revisions", "users", "reader_steps", "reader_book_step_counts"])
  record(`table/view ${t}`, await client.database.from(t).select("*").limit(1000));
record("steps ?search_vector=fts(secret)", await client.database.from("steps").select("id").textSearch("search_vector", "secret", { config: "english" }));
record("steps ?content->>markdown ilike %SECRET%", await client.database.from("steps").select("id").ilike("content->>markdown", "%SECRET%"));
for (const id of probeBooks)
  for (const drafts of [false, true])
    record(`rpc reader_book_tree(${id.slice(0, 8)}…, drafts=${drafts})`, await client.database.rpc("reader_book_tree", { target_book_id: id, include_drafts: drafts }));
// Helper-function exposure (finding N3). PROBE_USER_ID = the user id of a test OWNER (a uuid, not a secret). Interpretation:
//   error "not found"/404 = not exposed through this API; permission error = exposed but EXECUTE revoked;
//   data TRUE for a user id that is not the caller = membership oracle (expected before 04, FALSE after 04).
const probeUser = process.env.PROBE_USER_ID;
if (probeBooks[0] && probeUser) {
  for (const fn of ["can_edit_book", "can_manage_members", "can_delete_book", "can_view_drafts", "can_read_book", "can_discover_book"])
    record(`rpc ${fn}(book, other user) [N3]`, await client.database.rpc(fn, { target_book_id: probeBooks[0], req_user_id: probeUser }));
  record("rpc get_book_id_for_step(random) [info]", await client.database.rpc("get_book_id_for_step", { target_step_id: "00000000-0000-0000-0000-000000000000" }));
}

const hit = results.filter((r) => r.hits.length);
console.log(`\n${results.length} probes, ${hit.length} returned draft markers.`);
if (role === "reader" && hit.length) { console.log("FAIL: a reader actor received draft material."); process.exit(1); }
console.log(role === "reader" ? "PASS: no draft material reached this reader actor." : "Draft-viewer run: markers above are expected.");
