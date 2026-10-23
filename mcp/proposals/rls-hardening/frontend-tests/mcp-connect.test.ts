// Unit tests for src/lib/mcp-connect.ts (consent request parsing, redirects, personal token generation, sign-in hand-off).
//   node t/build-test.mjs mcp-connect.test.ts out-mcp && node t/out-mcp/mcp-connect.test.js
import assert from "node:assert/strict";
import {
  buildRedirect, generatePersonalToken, mcpResourceUrl, normalizeScopes, parseAuthorizeRequest, redirectHost,
  rememberOAuthReturn, sha256Hex, takeOAuthReturn, TOKEN_RE,
} from "@/lib/mcp-connect";

const ORIGIN = "https://devbook.example";
const CID = "dbc_AAAAAAAAAAAAAAAAAAAAAA";
const CH = "B".repeat(43);
let n = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  n++;
  console.log(`  ok   ${name}`);
}
const q = (o: Record<string, string>) => "?" + new URLSearchParams(o).toString();
const valid = { response_type: "code", client_id: CID, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: CH, code_challenge_method: "S256", state: "xyz" };

await test("a complete request parses; no scope means all scopes", () => {
  const p = parseAuthorizeRequest(q(valid), ORIGIN);
  assert.ok(p.ok);
  if (p.ok) {
    assert.deepEqual(p.request.scopes, ["read", "draft", "publish"]);
    assert.equal(p.request.state, "xyz");
    assert.equal(p.request.resource, null);
  }
});
await test("requested scopes are normalized: unknown ignored, read always added", () => {
  const p = parseAuthorizeRequest(q({ ...valid, scope: "publish admin" }), ORIGIN);
  assert.ok(p.ok && p.request.scopes.join(",") === "read,publish");
  assert.deepEqual(normalizeScopes(["draft"]), ["read", "draft"]);
  assert.deepEqual(normalizeScopes(["x"]), []);
  const only = parseAuthorizeRequest(q({ ...valid, scope: "admin" }), ORIGIN);
  assert.ok(!only.ok && only.error === "invalid_scope" && only.redirectable);
});
await test("missing or malformed client_id / redirect_uri are shown on the page, never redirected", () => {
  for (const bad of [{ ...valid, client_id: "x" }, { ...valid, client_id: "" }, { ...valid, redirect_uri: "" }]) {
    const p = parseAuthorizeRequest(q(bad), ORIGIN);
    assert.ok(!p.ok && !p.redirectable);
  }
});
await test("PKCE S256 is mandatory; plain or missing challenges are refused", () => {
  for (const bad of [{ ...valid, code_challenge_method: "plain" }, { ...valid, code_challenge: "short" }, (() => { const { code_challenge_method: _m, ...r } = valid; return r; })()]) {
    const p = parseAuthorizeRequest(q(bad as Record<string, string>), ORIGIN);
    assert.ok(!p.ok && p.error === "invalid_request" && p.redirectable);
  }
});
await test("only response_type=code; resource must be this site's /mcp", () => {
  const t = parseAuthorizeRequest(q({ ...valid, response_type: "token" }), ORIGIN);
  assert.ok(!t.ok && t.error === "unsupported_response_type");
  const r = parseAuthorizeRequest(q({ ...valid, resource: "https://evil.example/mcp" }), ORIGIN);
  assert.ok(!r.ok && r.error === "invalid_target");
  const good = parseAuthorizeRequest(q({ ...valid, resource: `${ORIGIN}/mcp/` }), ORIGIN);
  assert.ok(good.ok);
  assert.equal(mcpResourceUrl(`${ORIGIN}/`), `${ORIGIN}/mcp`);
});
await test("buildRedirect keeps the registered query, encodes values and skips nulls", () => {
  const u = new URL(buildRedirect("https://app.example/cb?keep=1", { code: "dbo_1 2", state: null, iss: ORIGIN }));
  assert.equal(u.searchParams.get("keep"), "1");
  assert.equal(u.searchParams.get("code"), "dbo_1 2");
  assert.equal(u.searchParams.has("state"), false);
  assert.equal(u.searchParams.get("iss"), ORIGIN);
  assert.ok(buildRedirect("cursor://anysphere.cursor-retrieval/oauth/cb", { code: "c" }).startsWith("cursor://"));
});
await test("redirectHost shows the host for web apps", () => {
  assert.equal(redirectHost("https://chatgpt.com/connector_platform_oauth_redirect"), "chatgpt.com");
  assert.equal(redirectHost("http://127.0.0.1:33418/cb"), "127.0.0.1:33418");
});
await test("personal tokens: MCP format, random, and the hash is SHA-256 of the token", async () => {
  const a = await generatePersonalToken(), b = await generatePersonalToken();
  assert.match(a.token, TOKEN_RE);
  assert.equal(a.token.slice(4, 12), a.prefix);
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, await sha256Hex(a.token));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
});
await test("sign-in hand-off stores only consent URLs and is consumed once", () => {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  rememberOAuthReturn("/home");
  assert.equal(takeOAuthReturn(), null);
  rememberOAuthReturn("/oauth/authorize?client_id=x");
  assert.equal(takeOAuthReturn(), "/oauth/authorize?client_id=x");
  assert.equal(takeOAuthReturn(), null);
  store.set("devbook_oauth_return", "https://evil.example/");
  assert.equal(takeOAuthReturn(), null);
});
console.log(`mcp-connect tests: ${n} passed`);
