// Reader RPC contract check against a SEPARATE InsForge TEST project (never production). Calls
// reader_book_tree for every actor x book x include_drafts and compares with rpc-expectations.mjs. Read-only: RPC reads
// and sign-ins only. NOT RUN anywhere yet (syntax-checked); expectations are verified locally by rpc-expectations.test.mjs.
//
//   CONFIRM_TEST_PROJECT=yes EXPECTED_TEST_APPKEY=<test app key> TEST_URL=https://<test-appkey>.<region>.insforge.app TEST_ANON_KEY=<test anon key> \
//   BOOKS_JSON='{"PUB":"<uuid>","EMPTY":"<uuid>","UNL":"<uuid>","DRAFTBOOK":"<uuid>","DELETED":"<uuid, optional>"}' \
//   ACTOR_STRANGER_EMAIL=... ACTOR_STRANGER_PASSWORD=... (same for VIEWER, REVIEWER, EDITOR, OWNER) \
//   [SOFT_DELETE_PATCH=yes|no]  node rpc-contract-check.mjs
// Passwords and tokens are read from the environment only and are never printed.
import { ACTORS, BOOKS, verify } from "./rpc-expectations.mjs";

const PROD_APPKEY = "6ktij8hk";
const { TEST_URL, TEST_ANON_KEY, CONFIRM_TEST_PROJECT } = process.env;
if (CONFIRM_TEST_PROJECT !== "yes" || !TEST_URL || !TEST_ANON_KEY) { console.error("Refusing: set CONFIRM_TEST_PROJECT=yes, TEST_URL and TEST_ANON_KEY for the TEST project."); process.exit(2); }
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
if (new URL(TEST_URL).host.includes(PROD_APPKEY)) { console.error("Refusing: TEST_URL points at the production project."); process.exit(2); }
let ids; try { ids = JSON.parse(process.env.BOOKS_JSON ?? ""); } catch { console.error("Refusing: BOOKS_JSON is missing or not JSON."); process.exit(2); }
const { createClient } = await import("@insforge/sdk"); // loaded only after the safety checks above passed
const opts = { softDeletePatch: process.env.SOFT_DELETE_PATCH !== "no" };
const short = (e) => (e ? `${e.code ?? e.statusCode ?? ""} ${String(e.message ?? e)}`.trim().slice(0, 90) : null);

let bad = 0, total = 0;
const line = (ok, text) => { total++; if (!ok) bad++; console.log(`${ok ? "ok  " : "BAD "} ${text}`); };
for (const actor of ACTORS) {
  const client = createClient({ baseUrl: TEST_URL, anonKey: TEST_ANON_KEY });
  if (actor !== "anon") {
    const email = process.env[`ACTOR_${actor.toUpperCase()}_EMAIL`], password = process.env[`ACTOR_${actor.toUpperCase()}_PASSWORD`];
    if (!email || !password) { console.error(`Missing credentials for ${actor}`); process.exit(2); }
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { console.error(`Sign-in failed for ${actor}: ${short(error)}`); process.exit(2); }
  }
  console.log(`\n== actor: ${actor}`);
  for (const book of BOOKS) {
    if (!ids[book]) continue;
    for (const drafts of [false, true]) {
      const { data, error } = await client.database.rpc("reader_book_tree", { target_book_id: ids[book], include_drafts: drafts });
      if (error) { line(false, `${book} drafts=${drafts}: RPC error ${short(error)}`); continue; }
      const problems = verify(actor, book, drafts, data ?? null, opts);
      line(problems.length === 0, `${book} drafts=${drafts}: ${data === null ? "null" : `${data.phases?.length ?? "?"} phases`}${problems.length ? " -> " + problems.join("; ") : ""}`);
    }
  }
  // missing id and an inaccessible id must look the same
  const none = await client.database.rpc("reader_book_tree", { target_book_id: "00000000-0000-0000-0000-000000000000", include_drafts: true });
  line(!none.error && none.data === null, `random id -> ${none.error ? "error " + short(none.error) : JSON.stringify(none.data)}`);
  // function permissions through the API (expected: reader_step_json NOT callable, reader_markdown callable)
  const sj = await client.database.rpc("reader_step_json", { s: null, book_status: "PUBLISHED", with_drafts: false });
  line(!!sj.error, `reader_step_json not callable -> ${sj.error ? short(sj.error) : "CALLABLE (unexpected)"}`);
  const rm = await client.database.rpc("reader_markdown", { step_content: {}, book_status: "PUBLISHED" });
  line(!rm.error, `reader_markdown callable (views need it) -> ${rm.error ? short(rm.error) : "ok"}`);
}
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
