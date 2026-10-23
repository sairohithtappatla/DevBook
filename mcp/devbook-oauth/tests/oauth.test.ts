// Unit tests for the DevBook OAuth function. The database functions of sql/003_mcp_oauth.sql are emulated in memory with
// the same rules (single-use codes, PKCE, rotation, replay revokes the grant); the real SQL is exercised against the TEST
// project by mcp/tools/oauth-flow-verify.mjs.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import {
  ACCESS_TTL_SECONDS, authorizationServerMetadata, b64url, createOAuthHandler, pkceChallenge, protectedResourceMetadata,
  sha256Hex, validateRedirectUri, validateRegistration, type OAuthDeps,
} from "../handler.ts";

const ORIGIN = "https://devbook.example";
type Code = { client_id: string; redirect_uri: string; challenge: string; scopes: string[]; used: boolean; grant: string | null; expired: boolean };
type Grant = { client_id: string; scopes: string[]; revoked: boolean };

function fakeDb() {
  const clients = new Map<string, { name: string; redirect_uris: string[] }>();
  const codes = new Map<string, Code>();
  const grants = new Map<string, Grant>();
  const refresh = new Map<string, { grant: string; used: boolean }>();
  const access = new Map<string, { grant: string; revoked: boolean }>();
  let n = 0, registrationsAllowed = true, failNext = false;
  const revokeGrant = (g: string) => {
    const gr = grants.get(g); if (gr) gr.revoked = true;
    for (const a of access.values()) if (a.grant === g) a.revoked = true;
    for (const r of refresh.values()) if (r.grant === g) r.used = true;
  };
  const rpc = async (fn: string, a: Record<string, unknown>) => {
    if (failNext) { failNext = false; return { data: null, error: { message: "boom" } }; }
    if (fn === "mcp_oauth_register_client") {
      if (!registrationsAllowed) return { data: false, error: null };
      clients.set(a.p_client_id as string, { name: a.p_client_name as string, redirect_uris: a.p_redirect_uris as string[] });
      return { data: true, error: null };
    }
    if (fn === "mcp_oauth_exchange_code") {
      const c = codes.get(a.p_code_hash as string);
      if (!c) return { data: null, error: null };
      if (c.used) { if (c.grant) revokeGrant(c.grant); return { data: null, error: null }; }
      c.used = true;
      if (c.expired || c.client_id !== a.p_client_id || c.redirect_uri !== a.p_redirect_uri || c.challenge !== a.p_challenge) return { data: null, error: null };
      const g = `g${++n}`;
      grants.set(g, { client_id: c.client_id, scopes: c.scopes, revoked: false });
      access.set(a.p_access_hash as string, { grant: g, revoked: false });
      refresh.set(a.p_refresh_hash as string, { grant: g, used: false });
      c.grant = g;
      return { data: { scopes: c.scopes, resource: null }, error: null };
    }
    if (fn === "mcp_oauth_refresh") {
      const r = refresh.get(a.p_refresh_hash as string);
      if (!r) return { data: null, error: null };
      const g = grants.get(r.grant)!;
      if (g.client_id !== a.p_client_id) return { data: null, error: null };
      if (r.used) { revokeGrant(r.grant); return { data: null, error: null }; }
      if (g.revoked) return { data: null, error: null };
      r.used = true;
      access.set(a.p_access_hash as string, { grant: r.grant, revoked: false });
      refresh.set(a.p_new_refresh_hash as string, { grant: r.grant, used: false });
      return { data: { scopes: g.scopes }, error: null };
    }
    throw new Error(`unexpected rpc ${fn}`);
  };
  return {
    clients, codes, grants, access, refresh, rpc,
    blockRegistrations: () => { registrationsAllowed = false; },
    failNextRpc: () => { failNext = true; },
    // what the consent page does through mcp_oauth_issue_code
    async issueCode(clientId: string, redirectUri: string, challenge: string, scopes: string[], o: { expired?: boolean } = {}) {
      const code = `dbo_${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
      codes.set(await sha256Hex(code), { client_id: clientId, redirect_uri: redirectUri, challenge, scopes, used: false, grant: null, expired: !!o.expired });
      return code;
    },
  };
}

function setup() {
  const db = fakeDb();
  const logs: string[] = [];
  const deps: OAuthDeps = { origin: ORIGIN, rpc: db.rpc, randomBytes: (k) => crypto.getRandomValues(new Uint8Array(k)), log: (l) => logs.push(l) };
  return { db, logs, handler: createOAuthHandler(() => deps) };
}
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const post = (path: string, body: string, ct = "application/x-www-form-urlencoded", extra: Record<string, string> = {}) =>
  new Request(`https://fn.internal${path}`, { method: "POST", headers: { "content-type": ct, ...extra }, body });

async function register(h: (r: Request) => Promise<Response>, redirect = "https://client.example/callback") {
  const r = await h(post("/register", JSON.stringify({ client_name: "Test Client", redirect_uris: [redirect] }), "application/json"));
  assertEquals(r.status, 201);
  return await r.json();
}
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: await pkceChallenge(verifier) };
}

// ---------------------------------------------------------------- metadata
Deno.test("metadata: authorization server metadata advertises PKCE S256, public clients and the website endpoints", async () => {
  const { handler } = setup();
  const r = await handler(new Request("https://fn.internal/.well-known/oauth-authorization-server"));
  assertEquals(r.status, 200);
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
  const m = await r.json();
  assertEquals(m, authorizationServerMetadata(ORIGIN));
  assertEquals(m.issuer, ORIGIN);
  assertEquals(m.authorization_endpoint, `${ORIGIN}/oauth/authorize`);
  assertEquals(m.code_challenge_methods_supported, ["S256"]);
  assertEquals(m.token_endpoint_auth_methods_supported, ["none"]);
});
Deno.test("metadata: protected resource metadata names the /mcp resource and this authorization server (both paths)", async () => {
  const { handler } = setup();
  for (const p of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
    const m = await (await handler(new Request(`https://fn.internal${p}`))).json();
    assertEquals(m, protectedResourceMetadata(ORIGIN));
    assertEquals(m.resource, `${ORIGIN}/mcp`);
    assertEquals(m.authorization_servers, [ORIGIN]);
  }
});
Deno.test("http: CORS preflight, unknown paths and wrong methods", async () => {
  const { handler } = setup();
  const o = await handler(new Request("https://fn.internal/token", { method: "OPTIONS" }));
  assertEquals(o.status, 204);
  assertEquals(o.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assertEquals((await handler(new Request("https://fn.internal/nope"))).status, 404);
  assertEquals((await handler(new Request("https://fn.internal/token"))).status, 405);
  assertEquals((await handler(new Request("https://fn.internal/register"))).status, 405);
});

// ---------------------------------------------------------------- registration
Deno.test("redirect URIs: https, loopback http and app schemes only; no fragments, credentials or dangerous schemes", () => {
  for (const ok of ["https://chatgpt.com/connector_platform_oauth_redirect", "https://claude.ai/api/mcp/auth_callback", "http://localhost:33418/callback", "http://127.0.0.1:6274/oauth/callback", "cursor://anysphere.cursor-retrieval/oauth/callback", "vscode://vscode.github-authentication/did-authenticate"]) {
    assertEquals(validateRedirectUri(ok), ok, ok);
  }
  for (const bad of ["http://evil.example/cb", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "https://a.example/cb#frag", "https://user:pw@a.example/cb", "not a url", "", "https://a.example/c b", 42, null]) {
    assertEquals(validateRedirectUri(bad), null, String(bad));
  }
});
Deno.test("registration: valid metadata is stored and echoed as a public client; names are cleaned", async () => {
  const { handler, db } = setup();
  const r = await handler(post("/register", JSON.stringify({ client_name: "  Claude\u0007 Desktop ", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "client_secret_post" }), "application/json"));
  assertEquals(r.status, 201);
  assertEquals(r.headers.get("cache-control"), "no-store");
  const b = await r.json();
  assertMatch(b.client_id, /^dbc_[A-Za-z0-9_-]{22}$/);
  assertEquals(b.client_name, "Claude Desktop");
  assertEquals(b.token_endpoint_auth_method, "none");
  assertEquals(b.client_secret, undefined);
  assertEquals(db.clients.get(b.client_id)?.redirect_uris, ["https://claude.ai/api/mcp/auth_callback"]);
});
Deno.test("registration: invalid requests are refused with RFC 7591 errors", async () => {
  const { handler } = setup();
  const cases: [unknown, string][] = [
    [{}, "invalid_redirect_uri"],
    [{ redirect_uris: [] }, "invalid_redirect_uri"],
    [{ redirect_uris: ["http://evil.example/cb"] }, "invalid_redirect_uri"],
    [{ redirect_uris: Array(11).fill("https://a.example/cb") }, "invalid_redirect_uri"],
    [{ redirect_uris: ["https://a.example/cb"], grant_types: ["implicit"] }, "invalid_client_metadata"],
    [{ redirect_uris: ["https://a.example/cb"], response_types: ["token"] }, "invalid_client_metadata"],
    [[1, 2], "invalid_client_metadata"],
  ];
  for (const [body, err] of cases) {
    const r = await handler(post("/register", JSON.stringify(body), "application/json"));
    assertEquals(r.status, 400, JSON.stringify(body));
    assertEquals((await r.json()).error, err, JSON.stringify(body));
  }
  assertEquals((await handler(post("/register", "not json", "application/json"))).status, 400);
  assertEquals((await handler(post("/register", "x".repeat(20000), "application/json"))).status, 400);
});
Deno.test("registration: rate limit and backend errors are reported without details", async () => {
  const { handler, db } = setup();
  db.blockRegistrations();
  const r = await handler(post("/register", JSON.stringify({ redirect_uris: ["https://a.example/cb"] }), "application/json"));
  assertEquals(r.status, 429);
  const s = setup();
  s.db.failNextRpc();
  const r2 = await s.handler(post("/register", JSON.stringify({ redirect_uris: ["https://a.example/cb"] }), "application/json"));
  assertEquals(r2.status, 503);
  assertEquals((await r2.json()).error, "temporarily_unavailable");
});

// ---------------------------------------------------------------- authorization code grant
Deno.test("token: a valid code + PKCE verifier returns a DevBook MCP access token and a refresh token", async () => {
  const { handler, db, logs } = setup();
  const c = await register(handler);
  const { verifier, challenge } = await pkce();
  const code = await db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read", "draft"]);
  const r = await handler(post("/token", form({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", client_id: c.client_id, code_verifier: verifier, resource: `${ORIGIN}/mcp` })));
  assertEquals(r.status, 200);
  assertEquals(r.headers.get("cache-control"), "no-store");
  const t = await r.json();
  assertMatch(t.access_token, /^dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);
  assertMatch(t.refresh_token, /^dbr_[A-Za-z0-9_-]{43}$/);
  assertEquals(t.token_type, "Bearer");
  assertEquals(t.expires_in, ACCESS_TTL_SECONDS);
  assertEquals(t.scope, "read draft");
  assert(db.access.has(await sha256Hex(t.access_token)), "only the hash is stored");
  for (const l of logs) { assert(!l.includes(t.access_token) && !l.includes(t.refresh_token) && !l.includes(code), "no secrets in logs"); }
});
Deno.test("token: JSON bodies and client_id in HTTP Basic are accepted", async () => {
  const { handler, db } = setup();
  const c = await register(handler);
  const { verifier, challenge } = await pkce();
  const code = await db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read"]);
  const r = await handler(post("/token", JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", code_verifier: verifier }), "application/json", { authorization: `Basic ${btoa(`${c.client_id}:`)}` }));
  assertEquals(r.status, 200);
});
Deno.test("token: wrong verifier, client, redirect URI, expired or unknown codes are invalid_grant, and the code is burnt", async () => {
  const { handler, db } = setup();
  const c = await register(handler);
  const other = await register(handler, "https://other.example/cb");
  const { verifier, challenge } = await pkce();
  const redirect = "https://client.example/callback";
  const attempts: [Record<string, string>, string][] = [];
  const mk = async (o: { expired?: boolean } = {}) => db.issueCode(c.client_id, redirect, challenge, ["read"], o);
  attempts.push([{ code: await mk(), code_verifier: b64url(crypto.getRandomValues(new Uint8Array(32))), redirect_uri: redirect, client_id: c.client_id }, "wrong verifier"]);
  attempts.push([{ code: await mk(), code_verifier: verifier, redirect_uri: redirect, client_id: other.client_id }, "other client"]);
  attempts.push([{ code: await mk(), code_verifier: verifier, redirect_uri: "https://client.example/other", client_id: c.client_id }, "other redirect"]);
  attempts.push([{ code: await mk({ expired: true }), code_verifier: verifier, redirect_uri: redirect, client_id: c.client_id }, "expired"]);
  attempts.push([{ code: `dbo_${"0".repeat(64)}`, code_verifier: verifier, redirect_uri: redirect, client_id: c.client_id }, "unknown"]);
  for (const [p, why] of attempts) {
    const r = await handler(post("/token", form({ grant_type: "authorization_code", ...p })));
    assertEquals(r.status, 400, why);
    assertEquals((await r.json()).error, "invalid_grant", why);
    // a retry with the right values must not work either: the first attempt burnt the code
    if (why !== "unknown") {
      const retry = await handler(post("/token", form({ grant_type: "authorization_code", code: p.code, code_verifier: verifier, redirect_uri: redirect, client_id: c.client_id })));
      assertEquals(retry.status, 400, `${why} retry`);
    }
  }
});
Deno.test("token: reusing a code revokes the connection that code created", async () => {
  const { handler, db } = setup();
  const c = await register(handler);
  const { verifier, challenge } = await pkce();
  const code = await db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read"]);
  const p = form({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", client_id: c.client_id, code_verifier: verifier });
  const first = await (await handler(post("/token", p))).json();
  assertEquals((await handler(post("/token", p))).status, 400);
  assertEquals(db.access.get(await sha256Hex(first.access_token))?.revoked, true);
});
Deno.test("token: malformed requests", async () => {
  const { handler, db } = setup();
  const c = await register(handler);
  const { challenge } = await pkce();
  const code = await db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read"]);
  const base = { grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", client_id: c.client_id };
  assertEquals((await (await handler(post("/token", form({ ...base, client_id: "nope", code_verifier: "x".repeat(43) })))).json()).error, "invalid_client");
  assertEquals((await (await handler(post("/token", form(base)))).json()).error, "invalid_request"); // no PKCE verifier
  assertEquals((await (await handler(post("/token", form({ ...base, code_verifier: "short" })))).json()).error, "invalid_request");
  assertEquals((await (await handler(post("/token", form({ ...base, code_verifier: "x".repeat(43), resource: "https://evil.example/mcp" })))).json()).error, "invalid_target");
  assertEquals((await (await handler(post("/token", form({ ...base, grant_type: "password" })))).json()).error, "unsupported_grant_type");
  assertEquals((await (await handler(post("/token", form({ ...base, grant_type: "client_credentials" })))).json()).error, "unsupported_grant_type");
});

// ---------------------------------------------------------------- refresh grant
async function connected() {
  const s = setup();
  const c = await register(s.handler);
  const { verifier, challenge } = await pkce();
  const code = await s.db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read", "draft", "publish"]);
  const t = await (await s.handler(post("/token", form({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", client_id: c.client_id, code_verifier: verifier })))).json();
  return { ...s, c, t };
}
Deno.test("refresh: rotates the refresh token and issues a new access token with the granted scopes", async () => {
  const { handler, c, t } = await connected();
  const r = await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: c.client_id })));
  assertEquals(r.status, 200);
  const n = await r.json();
  assert(n.access_token !== t.access_token && n.refresh_token !== t.refresh_token);
  assertEquals(n.scope, "read draft publish");
});
Deno.test("refresh: replaying a used refresh token revokes the whole connection (both token chains die)", async () => {
  const { handler, db, c, t } = await connected();
  const n = await (await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: c.client_id })))).json();
  const replay = await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: c.client_id })));
  assertEquals(replay.status, 400);
  assertEquals((await replay.json()).error, "invalid_grant");
  assertEquals(db.access.get(await sha256Hex(n.access_token))?.revoked, true);
  const afterRevoke = await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: n.refresh_token, client_id: c.client_id })));
  assertEquals(afterRevoke.status, 400);
});
Deno.test("refresh: another client's id, malformed or unknown refresh tokens are refused", async () => {
  const { handler, c, t } = await connected();
  const other = await register(handler, "https://other.example/cb");
  assertEquals((await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: other.client_id })))).status, 400);
  assertEquals((await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: "dbr_short", client_id: c.client_id })))).status, 400);
  assertEquals((await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: `dbr_${"A".repeat(43)}`, client_id: c.client_id })))).status, 400);
  // the legitimate client can still refresh: the failed attempts above did not consume its token
  assertEquals((await handler(post("/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: c.client_id })))).status, 200);
});
Deno.test("errors: a backend failure during token exchange is 503 temporarily_unavailable, not a token or a stack", async () => {
  const { handler, db } = setup();
  const c = await register(handler);
  const { verifier, challenge } = await pkce();
  const code = await db.issueCode(c.client_id, "https://client.example/callback", challenge, ["read"]);
  db.failNextRpc();
  const r = await handler(post("/token", form({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/callback", client_id: c.client_id, code_verifier: verifier })));
  assertEquals(r.status, 503);
  assertEquals(await r.json(), { error: "temporarily_unavailable", error_description: "try again later" });
});
Deno.test("registration: validateRegistration defaults the name and drops non-https client_uri", () => {
  const v = validateRegistration({ redirect_uris: ["https://a.example/cb", "https://a.example/cb"], client_uri: "http://a.example" });
  assert(v.ok);
  if (v.ok) {
    assertEquals(v.value.client_name, "MCP client");
    assertEquals(v.value.client_uri, null);
    assertEquals(v.value.redirect_uris, ["https://a.example/cb"]);
  }
});
