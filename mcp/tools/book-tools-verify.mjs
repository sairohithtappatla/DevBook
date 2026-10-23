// TEST project only: verifies the MCP book tools against the real database: create_book -> create_phase -> create_draft ->
// publish_draft -> publish_book, with what an anonymous reader sees at each stage (reader_book_tree), plus the multi-origin
// discovery of devbook-mcp and devbook-oauth. One throwaway user (email verification off only while it registers, restored
// in a finally block); its personal token is created through the Settings database function. Cleanup deletes the book and user.
//   HOST=https://393cz2pc.ap-southeast.insforge.app FN=https://393cz2pc.function2.insforge.app ANON=... ADMIN=... node mcp/tools/book-tools-verify.mjs
// Needs DEVBOOK_MCP_WRITE_TOOLS=true and DEVBOOK_MCP_PUBLISH_TOOL=true on TEST for the duration of the run.
import crypto from "node:crypto";

const { HOST, FN, ANON, ADMIN } = process.env;
const die = (m) => { console.error(`STOP: ${m}`); process.exit(2); };
if (!/^https:\/\/393cz2pc\.[a-z0-9-]+\.insforge\.app$/.test(HOST ?? "")) die("HOST must be the TEST project (393cz2pc)");
if (FN !== "https://393cz2pc.function2.insforge.app") die("FN must be the TEST functions host");
if (!ANON || !ADMIN) die("ANON and ADMIN must be set (TEST keys)");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${m}`); };
const b64url = (b) => Buffer.from(b).toString("base64url");
const run = crypto.randomBytes(3).toString("hex");
async function http(url, { method = "GET", headers = {}, body } = {}) {
  const r = await fetch(url, { method, headers, body });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? text); } catch { /* not json */ }
  return { status: r.status, headers: r.headers, json, text };
}
const adminH = { Authorization: `Bearer ${ADMIN}`, "content-type": "application/json" };
const rpc = (token, fn, args = {}) => http(`${HOST}/api/database/rpc/${fn}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
let tok = null;
async function tool(name, args) {
  const r = await http(`${FN}/devbook-mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${tok}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
  return r.json?.result?.structuredContent ?? { error: { code: `HTTP_${r.status}` } };
}
const anonTree = async (bookId) => (await rpc(ANON, "reader_book_tree", { target_book_id: bookId, include_drafts: true })).json;

// ---------------------------------------------------------------- multi-origin discovery (no user needed)
const www = async (q) => (await http(`${FN}/devbook-mcp${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).headers.get("www-authenticate") ?? "";
ok((await www("?origin_host=localhost:5173")).includes('resource_metadata="http://localhost:5173/.well-known/oauth-protected-resource/mcp"'), "MCP 401: metadata of the requesting site (listed host)");
ok((await www("?origin_host=evil.example")).includes('resource_metadata="http://localhost:5173/'), "MCP 401: unknown host falls back to the default origin");
const asm = (await http(`${FN}/devbook-oauth/.well-known/oauth-authorization-server?origin_host=evil.example`)).json;
ok(asm?.issuer === "http://localhost:5173", "OAuth metadata: unknown host falls back to the default origin");

// ---------------------------------------------------------------- throwaway user + personal token (Settings function)
const getVerification = async () => (await http(`${HOST}/api/auth/config`, { headers: adminH })).json?.requireEmailVerification;
const original = await getVerification();
if (original !== true && original !== false) die("cannot read the auth config");
let user = null;
try {
  if (original) await http(`${HOST}/api/auth/config`, { method: "PUT", headers: adminH, body: JSON.stringify({ requireEmailVerification: false }) });
  const r = await http(`${HOST}/api/auth/users?client_type=server`, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ email: `books-${run}@example.invalid`, password: `Bk!${crypto.randomBytes(15).toString("base64url")}9z`, name: "books verify" }) });
  if (!r.json?.accessToken) die(`could not register (HTTP ${r.status})`);
  user = { id: r.json.user.id, jwt: r.json.accessToken };
} finally {
  if (original) await http(`${HOST}/api/auth/config`, { method: "PUT", headers: adminH, body: JSON.stringify({ requireEmailVerification: true }) });
  console.log(`email verification restored: requireEmailVerification=${await getVerification()} (original ${original})`);
}

let bookId = null;
try {
  // a profile row like the website creates after sign-in (books.created_by references public.users)
  await http(`${HOST}/api/database/records/users`, { method: "POST", headers: { Authorization: `Bearer ${user.jwt}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ id: user.id, name: "books verify" }]) });
  const prefix = b64url(crypto.randomBytes(6)).slice(0, 8);
  tok = `dbk_${prefix}_${b64url(crypto.randomBytes(32))}`;
  const created = await rpc(user.jwt, "mcp_create_personal_token", { p_label: "books verify", p_prefix: prefix, p_hash: crypto.createHash("sha256").update(tok).digest("hex"), p_scopes: ["read", "draft", "publish"], p_days: 1 });
  ok(created.status === 200, "personal token created through Settings function");

  // ---------------------------------------------------------------- the book flow on the real database
  const cb = await tool("create_book", { title: `Verify Book ${run}`, description: "Created by the MCP", tags: ["Docker"], difficulty: "Intermediate" });
  bookId = cb.book?.id;
  ok(cb.created === true && cb.book?.publication_status === "DRAFT" && cb.book?.your_role === "OWNER", `create_book: DRAFT book owned by the caller (${cb.error?.code ?? "ok"})`);
  const row = (await http(`${HOST}/api/database/records/books?id=eq.${bookId}&select=created_by,difficulty,cover_url,estimated_read_time,access_level,slug`, { headers: adminH })).json?.[0];
  ok(row?.created_by === user.id && row?.difficulty === "INTERMEDIATE" && row?.cover_url === "docker" && row?.estimated_read_time === 60 && /^verify-book-[a-z0-9]+-[a-z0-9]{5}$/.test(row?.slug ?? ""), "stored row matches the website's New book shape");
  const mem = (await http(`${HOST}/api/database/records/book_members?book_id=eq.${bookId}&select=user_id,role`, { headers: adminH })).json;
  ok(mem?.length === 1 && mem[0].user_id === user.id && mem[0].role === "OWNER", "owner membership added by the database trigger");
  ok((await tool("create_book", { title: `verify book ${run}` })).created === false, "same title again returns the existing book");
  ok((await anonTree(bookId)) === null, "anonymous reader: a DRAFT book is invisible");

  const ph = await tool("create_phase", { book_id: bookId, title: "Getting started" });
  const st = await tool("create_draft", { phase_id: ph.phase?.id, title: "Install Docker", markdown: "# Install Docker\n\nSteps..." });
  ok(ph.created && st.created, "create_phase + create_draft on the new book");
  const pv = await tool("publish_draft", { step_id: st.step?.id });
  const pd = await tool("publish_draft", { step_id: st.step?.id, confirm: true, confirmation_token: pv.confirmation_token, confirm_title: "Install Docker" });
  ok(pd.published === true, "publish_draft publishes the step");
  ok((await anonTree(bookId)) === null, "anonymous reader: still invisible while the book is DRAFT");

  const bp = await tool("publish_book", { book_id: bookId, access_level: "UNLISTED" });
  ok(bp.preview === true && bp.reader_visible_steps === 1 && bp.current?.publication_status === "DRAFT", "publish_book preview: 1 reader-visible step");
  ok((await tool("publish_book", { book_id: bookId, access_level: "UNLISTED", confirm: true, confirmation_token: bp.confirmation_token, confirm_title: "wrong" })).error?.code === "CONFIRMATION_INVALID", "wrong title refused");
  const done = await tool("publish_book", { book_id: bookId, access_level: "UNLISTED", confirm: true, confirmation_token: bp.confirmation_token, confirm_title: `Verify Book ${run}` });
  ok(done.published === true && done.access_level === "UNLISTED", `publish_book confirm (${done.error?.code ?? "ok"})`);
  const tree = await anonTree(bookId);
  const steps = (tree?.phases ?? []).flatMap((p) => p.steps);
  ok(steps.length === 1 && steps[0].markdown.startsWith("# Install Docker"), "anonymous reader: the UNLISTED book opens by link with its published step");
  const listed = (await http(`${HOST}/api/database/records/books?id=eq.${bookId}&select=id`, { headers: { Authorization: `Bearer ${ANON}` } })).json;
  ok(Array.isArray(listed) && listed.length === 0, "UNLISTED: not listed for anonymous visitors");
  const pub = (await http(`${HOST}/api/database/records/books?id=eq.${bookId}&select=published_at,publication_status`, { headers: adminH })).json?.[0];
  ok(pub?.publication_status === "PUBLISHED" && pub?.published_at, "published_at set on first publication");
  const bp2 = await tool("publish_book", { book_id: bookId, access_level: "PUBLIC" });
  const done2 = await tool("publish_book", { book_id: bookId, access_level: "PUBLIC", confirm: true, confirmation_token: bp2.confirmation_token, confirm_title: `Verify Book ${run}` });
  const listed2 = (await http(`${HOST}/api/database/records/books?id=eq.${bookId}&select=id`, { headers: { Authorization: `Bearer ${ANON}` } })).json;
  ok(done2.published === true && listed2?.length === 1, "switching to PUBLIC lists the book");
} catch (e) {
  fail++; console.log(`FAIL exception ${String(e?.message ?? e).slice(0, 160)}`);
} finally {
  if (bookId) await http(`${HOST}/api/database/records/books?id=eq.${bookId}`, { method: "DELETE", headers: adminH });
  if (user) await http(`${HOST}/api/database/records/users?id=eq.${user.id}`, { method: "DELETE", headers: adminH });
  if (user) { const d = await http(`${HOST}/api/auth/users`, { method: "DELETE", headers: adminH, body: JSON.stringify({ userIds: [user.id] }) }); console.log(`cleanup: book deleted, user delete HTTP ${d.status}`); }
  console.log(`RESULT ${pass} pass, ${fail} fail`);
}
