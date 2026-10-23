// End-to-end check of "Connect DevBook" (OAuth) and Settings → MCP Connect against the TEST project only.
// Runs the real flow an MCP client performs: discovery from the MCP 401 -> metadata -> dynamic registration -> consent
// (database function as the signed-in user, exactly what /oauth/authorize calls) -> token exchange with PKCE -> MCP calls ->
// refresh rotation -> replay detection -> disconnect; plus personal tokens and the privilege boundaries of sql/003.
//
// TEST only: HOST must be the TEST project (393cz2pc). Keys come from the environment and are never printed:
//   ANON  = TEST anon key, ADMIN = TEST API key (used only to toggle email verification for two throwaway users, to delete
//           them afterwards, and to remove the registered test clients).
// Email verification is switched off only while the two users register and is restored in a finally block (re-read and
// printed). The website origin in the metadata (http://localhost:5173) is mapped to the function URLs, as the Vite dev
// proxy would do.
//   HOST=https://393cz2pc.ap-southeast.insforge.app FN=https://393cz2pc.function2.insforge.app node mcp/tools/oauth-flow-verify.mjs
import crypto from "node:crypto";

const { HOST, FN, ANON, ADMIN } = process.env;
const die = (m) => { console.error(`STOP: ${m}`); process.exit(2); };
if (!/^https:\/\/393cz2pc\.[a-z0-9-]+\.insforge\.app$/.test(HOST ?? "")) die("HOST must be the TEST project (393cz2pc)");
if (FN !== "https://393cz2pc.function2.insforge.app") die("FN must be the TEST functions host");
if (!ANON || !ADMIN) die("ANON and ADMIN must be set (TEST keys)");

const ORIGIN = "http://localhost:5173";
const viaProxy = (url) => {
  const map = [
    ["/mcp", "/devbook-mcp"],
    ["/.well-known/oauth-protected-resource/mcp", "/devbook-oauth/.well-known/oauth-protected-resource/mcp"],
    ["/.well-known/oauth-authorization-server", "/devbook-oauth/.well-known/oauth-authorization-server"],
    ["/oauth/token", "/devbook-oauth/token"],
    ["/oauth/register", "/devbook-oauth/register"],
  ];
  for (const [from, to] of map) if (url === ORIGIN + from) return FN + to;
  throw new Error(`unexpected URL ${url}`);
};

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${m}`); };
const b64url = (b) => Buffer.from(b).toString("base64url");
const sha256hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
const run = crypto.randomBytes(3).toString("hex");

async function http(url, { method = "GET", headers = {}, body } = {}) {
  const r = await fetch(url, { method, headers, body });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? text); } catch { /* not json */ }
  return { status: r.status, headers: r.headers, json, text };
}
const rpc = (token, fn, args = {}) => http(`${HOST}/api/database/rpc/${fn}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
const mcp = (token, method, params = {}) => http(viaProxy(`${ORIGIN}/mcp`), { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
const form = (o) => new URLSearchParams(o).toString();
const token = (tokenUrl, o) => http(tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form(o) });
const pkce = () => { const verifier = b64url(crypto.randomBytes(32)); return { verifier, challenge: b64url(crypto.createHash("sha256").update(verifier).digest()) }; };

// ---------------------------------------------------------------- throwaway users (verification off only while registering)
const adminH = { Authorization: `Bearer ${ADMIN}`, "content-type": "application/json" };
const getVerification = async () => (await http(`${HOST}/api/auth/config`, { headers: adminH })).json?.requireEmailVerification;
const users = {};
const clientIds = [];
const original = await getVerification();
if (original !== true && original !== false) die("cannot read the auth config");
try {
  if (original) await http(`${HOST}/api/auth/config`, { method: "PUT", headers: adminH, body: JSON.stringify({ requireEmailVerification: false }) });
  for (const who of ["alice", "bob"]) {
    const pw = `Oa!${crypto.randomBytes(15).toString("base64url")}9z`;
    const r = await http(`${HOST}/api/auth/users?client_type=server`, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ email: `oauth-${run}-${who}@example.invalid`, password: pw, name: `oauth ${who}` }) });
    if (!r.json?.accessToken) die(`could not register ${who} (HTTP ${r.status})`);
    users[who] = { id: r.json.user.id, jwt: r.json.accessToken };
  }
} finally {
  if (original) await http(`${HOST}/api/auth/config`, { method: "PUT", headers: adminH, body: JSON.stringify({ requireEmailVerification: true }) });
  console.log(`email verification restored: requireEmailVerification=${await getVerification()} (original ${original})`);
}

try {
  const A = users.alice.jwt, B = users.bob.jwt;

  // ---------------------------------------------------------------- discovery, exactly as an MCP client does it
  const unauth = await mcp(null, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } });
  const challenge = unauth.headers.get("www-authenticate") ?? "";
  const prmUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
  ok(unauth.status === 401 && prmUrl === `${ORIGIN}/.well-known/oauth-protected-resource/mcp`, "MCP 401 advertises the protected resource metadata");
  const prm = (await http(viaProxy(prmUrl))).json;
  ok(prm?.resource === `${ORIGIN}/mcp` && prm?.authorization_servers?.[0] === ORIGIN, "resource metadata names /mcp and the DevBook authorization server");
  const asm = (await http(viaProxy(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`))).json;
  ok(asm?.issuer === ORIGIN && asm?.code_challenge_methods_supported?.includes("S256") && asm?.registration_endpoint === `${ORIGIN}/oauth/register`, "authorization server metadata: issuer, PKCE S256, registration");
  const tokenUrl = viaProxy(asm.token_endpoint);

  // ---------------------------------------------------------------- dynamic client registration
  const redirect = "http://127.0.0.1:53682/callback";
  const reg = await http(viaProxy(asm.registration_endpoint), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: `Verify ${run}`, redirect_uris: [redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }) });
  const clientId = reg.json?.client_id; if (clientId) clientIds.push(clientId);
  ok(reg.status === 201 && /^dbc_/.test(clientId ?? "") && !reg.json.client_secret, "registration returns a public client_id and no secret");
  const evil = await http(viaProxy(asm.registration_endpoint), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["http://evil.example/cb"] }) });
  ok(evil.status === 400 && evil.json?.error === "invalid_redirect_uri", "registration refuses a non-loopback http redirect");

  // ---------------------------------------------------------------- consent page functions (as Alice)
  const info = await rpc(A, "mcp_oauth_client_info", { p_client_id: clientId, p_redirect_uri: redirect });
  ok(info.status === 200 && info.json?.client_name === `Verify ${run}` && info.json?.redirect_ok === true, "consent: client info with redirect_ok=true");
  ok((await rpc(A, "mcp_oauth_client_info", { p_client_id: clientId, p_redirect_uri: "http://127.0.0.1:1/other" })).json?.redirect_ok === false, "consent: unregistered redirect -> redirect_ok=false");
  ok((await rpc(A, "mcp_oauth_client_info", { p_client_id: `dbc_${"A".repeat(22)}`, p_redirect_uri: redirect })).json === null, "consent: unknown client -> null");
  ok((await rpc(ANON, "mcp_oauth_client_info", { p_client_id: clientId, p_redirect_uri: redirect })).status >= 400, "consent: anonymous callers are refused");
  const p1 = pkce();
  ok((await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: "http://127.0.0.1:1/other", p_code_challenge: p1.challenge, p_scopes: ["read"], p_resource: null })).status >= 400, "issue_code refuses an unregistered redirect");
  ok((await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: p1.challenge, p_scopes: ["draft"], p_resource: null })).status >= 400, "issue_code refuses scopes without read");
  ok((await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: "short", p_scopes: ["read"], p_resource: null })).status >= 400, "issue_code requires a PKCE challenge");
  const code1 = (await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: p1.challenge, p_scopes: ["read", "draft"], p_resource: `${ORIGIN}/mcp` })).json;
  ok(/^dbo_[0-9a-f]{64}$/.test(code1 ?? ""), "consent 'Allow' issues a one-time code");

  // ---------------------------------------------------------------- token exchange + MCP
  const bad = await token(tokenUrl, { grant_type: "authorization_code", code: code1, redirect_uri: redirect, client_id: clientId, code_verifier: pkce().verifier });
  ok(bad.status === 400 && bad.json?.error === "invalid_grant", "wrong PKCE verifier -> invalid_grant");
  const burnt = await token(tokenUrl, { grant_type: "authorization_code", code: code1, redirect_uri: redirect, client_id: clientId, code_verifier: p1.verifier });
  ok(burnt.status === 400, "the code is burnt by the failed attempt (single use)");

  const p2 = pkce();
  const code2 = (await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: p2.challenge, p_scopes: ["read", "draft"], p_resource: `${ORIGIN}/mcp` })).json;
  const t1 = await token(tokenUrl, { grant_type: "authorization_code", code: code2, redirect_uri: redirect, client_id: clientId, code_verifier: p2.verifier, resource: `${ORIGIN}/mcp` });
  const scopeSet = (s) => (s ?? "").split(" ").sort().join(" ");
  ok(t1.status === 200 && /^dbk_/.test(t1.json?.access_token ?? "") && /^dbr_/.test(t1.json?.refresh_token ?? "") && scopeSet(t1.json?.scope) === "draft read", `token exchange returns access + refresh tokens (scope "${t1.json?.scope}")`);
  ok(t1.headers.get("cache-control") === "no-store", "token response is not cacheable");
  const init = await mcp(t1.json.access_token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } });
  ok(init.status === 200 && init.json?.result?.serverInfo?.name === "devbook-mcp", "MCP accepts the OAuth access token (initialize)");
  const tl = await mcp(t1.json.access_token, "tools/list");
  ok(tl.status === 200 && Array.isArray(tl.json?.result?.tools) && tl.json.result.tools.some((t) => t.name === "search_books"), `MCP tools/list works (${tl.json?.result?.tools?.length} tools)`);

  // replaying the code revokes what it issued
  const replay = await token(tokenUrl, { grant_type: "authorization_code", code: code2, redirect_uri: redirect, client_id: clientId, code_verifier: p2.verifier });
  ok(replay.status === 400, "code replay -> invalid_grant");
  ok((await mcp(t1.json.access_token, "tools/list")).status === 401, "code replay revoked the access token issued from it");

  // ---------------------------------------------------------------- refresh rotation + replay detection
  const p3 = pkce();
  const code3 = (await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: p3.challenge, p_scopes: ["read", "draft", "publish"], p_resource: null })).json;
  const t3 = (await token(tokenUrl, { grant_type: "authorization_code", code: code3, redirect_uri: redirect, client_id: clientId, code_verifier: p3.verifier })).json;
  const r1 = await token(tokenUrl, { grant_type: "refresh_token", refresh_token: t3.refresh_token, client_id: clientId });
  ok(r1.status === 200 && r1.json.refresh_token !== t3.refresh_token && r1.json.access_token !== t3.access_token, "refresh rotates both tokens");
  ok((await mcp(r1.json.access_token, "tools/list")).status === 200, "the refreshed access token works");
  const conns1 = (await rpc(A, "mcp_my_connections")).json;
  const app = conns1?.apps?.find((x) => x.client_name === `Verify ${run}`);
  ok(conns1?.apps?.length === 1 && app?.scopes?.join(",") === "draft,publish,read", "Settings lists exactly the one active connection (revoked ones hidden)");
  ok(((await rpc(B, "mcp_my_connections")).json?.apps ?? []).length === 0, "another user does not see Alice's connections");
  ok((await rpc(B, "mcp_revoke_app", { p_grant_id: app.id })).json === false, "another user cannot disconnect Alice's app");
  const rReplay = await token(tokenUrl, { grant_type: "refresh_token", refresh_token: t3.refresh_token, client_id: clientId });
  ok(rReplay.status === 400 && rReplay.json?.error === "invalid_grant", "replayed refresh token -> invalid_grant");
  ok((await mcp(r1.json.access_token, "tools/list")).status === 401, "refresh replay revoked the whole connection");
  ok((await token(tokenUrl, { grant_type: "refresh_token", refresh_token: r1.json.refresh_token, client_id: clientId })).status === 400, "the newest refresh token is dead too");

  // ---------------------------------------------------------------- disconnect from Settings
  const p4 = pkce();
  const code4 = (await rpc(A, "mcp_oauth_issue_code", { p_client_id: clientId, p_redirect_uri: redirect, p_code_challenge: p4.challenge, p_scopes: ["read"], p_resource: null })).json;
  const t4 = (await token(tokenUrl, { grant_type: "authorization_code", code: code4, redirect_uri: redirect, client_id: clientId, code_verifier: p4.verifier })).json;
  ok(t4.scope === "read", "user-chosen permissions are honoured (read only)");
  const conns2 = (await rpc(A, "mcp_my_connections")).json;
  const app4 = conns2.apps.find((x) => x.scopes.join(",") === "read");
  ok((await rpc(A, "mcp_revoke_app", { p_grant_id: app4.id })).json === true, "Settings: Disconnect");
  ok((await mcp(t4.access_token, "tools/list")).status === 401, "disconnected app's access token stops working immediately");
  ok((await token(tokenUrl, { grant_type: "refresh_token", refresh_token: t4.refresh_token, client_id: clientId })).status === 400, "disconnected app cannot refresh");

  // ---------------------------------------------------------------- personal tokens from Settings
  const prefix = b64url(crypto.randomBytes(6)).slice(0, 8);
  const pat = `dbk_${prefix}_${b64url(crypto.randomBytes(32))}`;
  const created = await rpc(A, "mcp_create_personal_token", { p_label: "verify laptop", p_prefix: prefix, p_hash: sha256hex(pat), p_scopes: ["read", "draft"], p_days: 30 });
  ok(created.status === 200 && typeof created.json === "string", "Settings: create personal token (server receives only the hash)");
  ok((await mcp(pat, "tools/list")).status === 200, "personal token works with the MCP");
  const listed = (await rpc(A, "mcp_my_connections")).json.tokens;
  ok(listed.length === 1 && listed[0].prefix === prefix && !JSON.stringify(listed).includes(sha256hex(pat)), "Settings lists the token by prefix, never the hash");
  ok((await rpc(A, "mcp_create_personal_token", { p_label: "x", p_prefix: prefix, p_hash: sha256hex(`${pat}x`), p_scopes: ["publish"], p_days: 30 })).status >= 400, "create refuses scopes without read");
  ok((await rpc(A, "mcp_create_personal_token", { p_label: "bad;label", p_prefix: prefix, p_hash: sha256hex(`${pat}y`), p_scopes: ["read"], p_days: 30 })).status >= 400, "create refuses unsafe labels");
  ok((await rpc(A, "mcp_create_personal_token", { p_label: "long", p_prefix: prefix, p_hash: sha256hex(`${pat}z`), p_scopes: ["read"], p_days: 400 })).status >= 400, "create refuses lifetimes over 365 days");
  ok((await rpc(B, "mcp_revoke_personal_token", { p_id: created.json })).json === false, "another user cannot revoke Alice's token");
  ok((await rpc(A, "mcp_revoke_personal_token", { p_id: created.json })).json === true, "Settings: revoke personal token");
  ok((await mcp(pat, "tools/list")).status === 401, "revoked personal token stops working immediately");

  // ---------------------------------------------------------------- privilege boundaries
  for (const t of [["anon", ANON], ["signed-in", B]]) {
    // full, correctly named arguments: a 404 here would only mean "wrong signature", so expect a permission error (401/403)
    const h64 = "0".repeat(64);
    const calls = {
      mcp_oauth_exchange_code: { p_code_hash: h64, p_client_id: `dbc_${"A".repeat(22)}`, p_redirect_uri: redirect, p_challenge: "A".repeat(43), p_access_prefix: "AAAAAAAA", p_access_hash: h64, p_access_ttl_seconds: 60, p_refresh_hash: h64, p_refresh_ttl_seconds: 60 },
      mcp_oauth_refresh: { p_refresh_hash: h64, p_client_id: `dbc_${"A".repeat(22)}`, p_access_prefix: "AAAAAAAA", p_access_hash: h64, p_access_ttl_seconds: 60, p_new_refresh_hash: h64, p_refresh_ttl_seconds: 60 },
      mcp_oauth_register_client: { p_client_id: `dbc_${"B".repeat(22)}`, p_client_name: "x", p_client_uri: null, p_redirect_uris: ["https://a.example/cb"] },
      mcp_revoke_grant_internal: { p_grant_id: "00000000-0000-0000-0000-000000000000" },
      mcp_sha256_hex: { p: "x" },
      mcp_require_user: {},
    };
    for (const [fn, args] of Object.entries(calls)) {
      const r = await rpc(t[1], fn, args);
      ok(r.status === 401 || r.status === 403, `${t[0]} cannot call ${fn} (HTTP ${r.status})`);
    }
    for (const tbl of ["mcp_oauth_clients", "mcp_oauth_grants", "mcp_oauth_codes", "mcp_oauth_refresh_tokens", "mcp_tokens"]) {
      const r = await http(`${HOST}/api/database/records/${tbl}?select=*&limit=1`, { headers: { Authorization: `Bearer ${t[1]}` } });
      ok(r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `${t[0]} cannot read ${tbl} (HTTP ${r.status})`);
    }
  }
  ok((await rpc(ANON, "mcp_my_connections")).status >= 400, "anonymous callers cannot list connections");
} catch (e) {
  fail++; console.log(`FAIL exception ${String(e?.message ?? e).slice(0, 160)}`);
} finally {
  // cleanup: test clients (grants, codes, tokens cascade) and the two users
  for (const id of clientIds) await http(`${HOST}/api/database/records/mcp_oauth_clients?client_id=eq.${id}`, { method: "DELETE", headers: adminH });
  const ids = Object.values(users).map((u) => u.id);
  if (ids.length) {
    const d = await http(`${HOST}/api/auth/users`, { method: "DELETE", headers: adminH, body: JSON.stringify({ userIds: ids }) });
    console.log(`cleanup: deleted ${clientIds.length} test client(s); delete users HTTP ${d.status}`);
  }
  console.log(`RESULT ${pass} pass, ${fail} fail`);
}
