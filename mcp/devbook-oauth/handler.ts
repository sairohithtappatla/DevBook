// DevBook OAuth: lets MCP clients (ChatGPT, Claude, Cursor, ...) connect to DevBook with a "Connect DevBook" consent screen
// instead of a pasted token. One InsForge Edge Function file. OAuth 2.1 profile used by the MCP authorization spec:
//   - authorization server metadata (RFC 8414) and protected resource metadata (RFC 9728)
//   - dynamic client registration (RFC 7591), public clients only: no client secrets, PKCE S256 required
//   - authorization code + refresh token grants; refresh tokens rotate, a replayed one revokes the whole connection
//   - access tokens are ordinary DevBook MCP tokens (`dbk_...`, 1 hour) checked by the devbook-mcp function as before
// The consent screen itself is the website page /oauth/authorize (it issues the one-time code through the database
// function mcp_oauth_issue_code as the signed-in user). This function never sees user passwords or website sessions.
//
// Routes (paths as the platform passes them: the function slug is stripped from sub-paths):
//   GET  /.well-known/oauth-authorization-server
//   GET  /.well-known/oauth-protected-resource[/mcp]
//   POST /register
//   POST /token
// Public URLs come from DEVBOOK_PUBLIC_ORIGIN (the website origin that proxies /mcp, /oauth/* and /.well-known/* here).
// Only hashes of codes and tokens are stored (sql/003_mcp_oauth.sql). Tokens and codes never appear in logs.
import { createAdminClient } from "npm:@insforge/sdk@1.5.2";

export const SCOPES = ["read", "draft", "publish"] as const;
export const ACCESS_TTL_SECONDS = 3600;
export const REFRESH_TTL_SECONDS = 60 * 24 * 3600;
const MAX_BODY_BYTES = 16 * 1024;

export type RpcResult = { data: unknown; error: unknown };
export type OAuthDeps = {
  origin: string; // e.g. https://devbook.rohith.engineer (no trailing slash)
  rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult>;
  randomBytes(n: number): Uint8Array;
  log(line: string): void;
};

// ------------------------------------------------------------------------------------------------ encoding helpers
export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

// ------------------------------------------------------------------------------------------------ metadata
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/settings`,
  };
}
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "DevBook",
    resource_documentation: `${origin}/settings`,
  };
}

// ------------------------------------------------------------------------------------------------ registration
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:", "mailto:", "tel:", "sms:"]);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

// https anywhere; http only on loopback (native apps, RFC 8252 §7.3); private-use schemes for desktop apps (cursor://...).
export function validateRedirectUri(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return null;
  // deno-lint-ignore no-control-regex
  if (/[\u0000- \u007f]/.test(raw)) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.hash !== "" || raw.includes("#")) return null;
  if (u.username !== "" || u.password !== "") return null;
  if (u.protocol === "https:") return u.hostname ? raw : null;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname) ? raw : null;
  if (BLOCKED_SCHEMES.has(u.protocol)) return null;
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) ? raw : null;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length === 0 ? null : s.slice(0, max);
}

export type Registration = { client_name: string; client_uri: string | null; redirect_uris: string[] };
export function validateRegistration(body: unknown): { ok: true; value: Registration } | { ok: false; error: string; description: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "invalid_client_metadata", description: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.redirect_uris) || b.redirect_uris.length < 1 || b.redirect_uris.length > 10) {
    return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris must list 1-10 URIs" };
  }
  const uris: string[] = [];
  for (const r of b.redirect_uris) {
    const ok = validateRedirectUri(r);
    if (!ok) return { ok: false, error: "invalid_redirect_uri", description: "redirect URIs must be https, http on localhost, or an app scheme, without a fragment" };
    if (!uris.includes(ok)) uris.push(ok);
  }
  if (b.grant_types !== undefined && !(Array.isArray(b.grant_types) && b.grant_types.includes("authorization_code") && b.grant_types.every((g) => g === "authorization_code" || g === "refresh_token"))) {
    return { ok: false, error: "invalid_client_metadata", description: "grant_types must be authorization_code and optionally refresh_token" };
  }
  if (b.response_types !== undefined && !(Array.isArray(b.response_types) && b.response_types.length === 1 && b.response_types[0] === "code")) {
    return { ok: false, error: "invalid_client_metadata", description: "response_types must be [\"code\"]" };
  }
  let clientUri: string | null = null;
  if (typeof b.client_uri === "string" && b.client_uri.length <= 500) {
    try { if (new URL(b.client_uri).protocol === "https:") clientUri = b.client_uri; } catch { /* dropped */ }
  }
  return { ok: true, value: { client_name: cleanText(b.client_name, 100) ?? "MCP client", client_uri: clientUri, redirect_uris: uris } };
}

// ------------------------------------------------------------------------------------------------ token requests
const CLIENT_ID_RE = /^dbc_[A-Za-z0-9_-]{22}$/;
const CODE_RE = /^dbo_[0-9a-f]{64}$/;
const REFRESH_RE = /^dbr_[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export function newAccessToken(deps: OAuthDeps): { token: string; prefix: string } {
  const prefix = b64url(deps.randomBytes(6)).slice(0, 8);
  return { token: `dbk_${prefix}_${b64url(deps.randomBytes(32))}`, prefix };
}
export function newRefreshToken(deps: OAuthDeps): string {
  return `dbr_${b64url(deps.randomBytes(32))}`;
}
export function newClientId(deps: OAuthDeps): string {
  return `dbc_${b64url(deps.randomBytes(16))}`;
}

function normalizeResource(r: string): string {
  return r.endsWith("/") ? r.slice(0, -1) : r;
}

// ------------------------------------------------------------------------------------------------ HTTP
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-max-age": "86400",
};
function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-content-type-options": "nosniff", ...CORS, ...extra },
  });
}
const NO_STORE = { "cache-control": "no-store", pragma: "no-cache" };
function oauthError(status: number, error: string, description: string): Response {
  return json(status, { error, error_description: description }, NO_STORE);
}

async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return null;
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > MAX_BODY_BYTES) return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return null; }
}

// Token requests are form-encoded per RFC 6749; JSON is accepted too because some clients send it.
async function readParams(req: Request): Promise<Record<string, string> | null> {
  const text = await readBody(req);
  if (text === null) return null;
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const out: Record<string, string> = {};
  if (ct.startsWith("application/json")) {
    let o: unknown;
    try { o = JSON.parse(text); } catch { return null; }
    if (typeof o !== "object" || o === null || Array.isArray(o)) return null;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  } else {
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  }
  // public clients may still send client_id in HTTP Basic (with an empty secret)
  const basic = /^Basic ([A-Za-z0-9+/=]+)$/.exec(req.headers.get("authorization") ?? "");
  if (basic && !out.client_id) {
    try {
      const id = decodeURIComponent(atob(basic[1]).split(":")[0] ?? "");
      if (id) out.client_id = id;
    } catch { /* ignored */ }
  }
  return out;
}

async function handleRegister(deps: OAuthDeps, req: Request): Promise<Response> {
  const text = await readBody(req);
  if (text === null) return oauthError(400, "invalid_client_metadata", "body too large or not UTF-8");
  let body: unknown;
  try { body = JSON.parse(text); } catch { return oauthError(400, "invalid_client_metadata", "body must be JSON"); }
  const v = validateRegistration(body);
  if (!v.ok) return oauthError(400, v.error, v.description);
  const clientId = newClientId(deps);
  const r = await deps.rpc("mcp_oauth_register_client", {
    p_client_id: clientId, p_client_name: v.value.client_name, p_client_uri: v.value.client_uri, p_redirect_uris: v.value.redirect_uris,
  });
  if (r.error) { deps.log(JSON.stringify({ event: "register", outcome: "BACKEND" })); return oauthError(503, "temporarily_unavailable", "try again later"); }
  if (r.data !== true) { deps.log(JSON.stringify({ event: "register", outcome: "RATE_LIMITED" })); return oauthError(429, "temporarily_unavailable", "too many registrations; try again later"); }
  deps.log(JSON.stringify({ event: "register", outcome: "ok", clientId }));
  return json(201, {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: v.value.client_name,
    ...(v.value.client_uri ? { client_uri: v.value.client_uri } : {}),
    redirect_uris: v.value.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, NO_STORE);
}

function issueTokens(scopes: unknown, access: { token: string }, refresh: string): Response {
  const list = Array.isArray(scopes) ? scopes.filter((s): s is string => typeof s === "string") : [];
  return json(200, {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    scope: list.join(" "),
  }, NO_STORE);
}

async function handleToken(deps: OAuthDeps, req: Request): Promise<Response> {
  const p = await readParams(req);
  if (!p) return oauthError(400, "invalid_request", "body must be form-encoded (or JSON) and at most 16 KB");
  const clientId = p.client_id ?? "";
  if (!CLIENT_ID_RE.test(clientId)) return oauthError(401, "invalid_client", "unknown client_id");

  if (p.grant_type === "authorization_code") {
    if (!CODE_RE.test(p.code ?? "")) return oauthError(400, "invalid_grant", "authorization code is invalid, expired or already used");
    if (!VERIFIER_RE.test(p.code_verifier ?? "")) return oauthError(400, "invalid_request", "code_verifier (PKCE) is required");
    if (typeof p.redirect_uri !== "string" || p.redirect_uri.length === 0 || p.redirect_uri.length > 2000) return oauthError(400, "invalid_request", "redirect_uri is required");
    if (p.resource !== undefined && normalizeResource(p.resource) !== `${deps.origin}/mcp`) return oauthError(400, "invalid_target", "unknown resource");
    const access = newAccessToken(deps), refresh = newRefreshToken(deps);
    const r = await deps.rpc("mcp_oauth_exchange_code", {
      p_code_hash: await sha256Hex(p.code as string), p_client_id: clientId, p_redirect_uri: p.redirect_uri,
      p_challenge: await pkceChallenge(p.code_verifier as string), p_access_prefix: access.prefix, p_access_hash: await sha256Hex(access.token),
      p_access_ttl_seconds: ACCESS_TTL_SECONDS, p_refresh_hash: await sha256Hex(refresh), p_refresh_ttl_seconds: REFRESH_TTL_SECONDS,
    });
    if (r.error) { deps.log(JSON.stringify({ event: "token", grant: "authorization_code", outcome: "BACKEND" })); return oauthError(503, "temporarily_unavailable", "try again later"); }
    const data = r.data as { scopes?: unknown } | null;
    if (!data || !Array.isArray(data.scopes)) { deps.log(JSON.stringify({ event: "token", grant: "authorization_code", outcome: "INVALID_GRANT", clientId })); return oauthError(400, "invalid_grant", "authorization code is invalid, expired or already used"); }
    deps.log(JSON.stringify({ event: "token", grant: "authorization_code", outcome: "ok", clientId, tokenPrefix: access.prefix }));
    return issueTokens(data.scopes, access, refresh);
  }

  if (p.grant_type === "refresh_token") {
    if (!REFRESH_RE.test(p.refresh_token ?? "")) return oauthError(400, "invalid_grant", "refresh token is invalid, expired or revoked");
    const access = newAccessToken(deps), refresh = newRefreshToken(deps);
    const r = await deps.rpc("mcp_oauth_refresh", {
      p_refresh_hash: await sha256Hex(p.refresh_token as string), p_client_id: clientId, p_access_prefix: access.prefix,
      p_access_hash: await sha256Hex(access.token), p_access_ttl_seconds: ACCESS_TTL_SECONDS,
      p_new_refresh_hash: await sha256Hex(refresh), p_refresh_ttl_seconds: REFRESH_TTL_SECONDS,
    });
    if (r.error) { deps.log(JSON.stringify({ event: "token", grant: "refresh_token", outcome: "BACKEND" })); return oauthError(503, "temporarily_unavailable", "try again later"); }
    const data = r.data as { scopes?: unknown } | null;
    if (!data || !Array.isArray(data.scopes)) { deps.log(JSON.stringify({ event: "token", grant: "refresh_token", outcome: "INVALID_GRANT", clientId })); return oauthError(400, "invalid_grant", "refresh token is invalid, expired or revoked"); }
    deps.log(JSON.stringify({ event: "token", grant: "refresh_token", outcome: "ok", clientId, tokenPrefix: access.prefix }));
    return issueTokens(data.scopes, access, refresh);
  }

  return oauthError(400, "unsupported_grant_type", "use authorization_code or refresh_token");
}

export function createOAuthHandler(getDeps: () => OAuthDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      let deps: OAuthDeps;
      try { deps = getDeps(); } catch { return oauthError(503, "temporarily_unavailable", "service is not configured"); }
      const path = new URL(req.url).pathname.replace(/\/+$/, "");
      if (req.method === "GET" && path.endsWith("/.well-known/oauth-authorization-server")) {
        return json(200, authorizationServerMetadata(deps.origin), { "cache-control": "public, max-age=300" });
      }
      if (req.method === "GET" && (path.endsWith("/.well-known/oauth-protected-resource") || path.endsWith("/.well-known/oauth-protected-resource/mcp"))) {
        return json(200, protectedResourceMetadata(deps.origin), { "cache-control": "public, max-age=300" });
      }
      if (path.endsWith("/register")) {
        if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "POST" });
        return await handleRegister(deps, req);
      }
      if (path.endsWith("/token")) {
        if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "POST" });
        return await handleToken(deps, req);
      }
      return json(404, { error: "not_found" });
    } catch (err) {
      console.error("[devbook-oauth] unhandled", err instanceof Error ? err.name : "unknown"); // class name only
      return oauthError(500, "server_error", "internal error");
    }
  };
}

// ------------------------------------------------------------------------------------------------ production wiring
// Secrets: INSFORGE_BASE_URL (platform), DEVBOOK_MCP_API_KEY (service credential, shared with devbook-mcp),
// DEVBOOK_PUBLIC_ORIGIN (website origin, e.g. https://devbook.rohith.engineer).
let cached: OAuthDeps | null = null;
export function depsFromEnv(env: { get(name: string): string | undefined } = Deno.env): OAuthDeps {
  if (cached) return cached;
  const baseUrl = env.get("INSFORGE_BASE_URL"), apiKey = env.get("DEVBOOK_MCP_API_KEY");
  const origin = (env.get("DEVBOOK_PUBLIC_ORIGIN") ?? "").replace(/\/+$/, "");
  if (!baseUrl || !apiKey || !/^https?:\/\/[^/]+$/.test(origin)) throw new Error("not configured");
  const db = createAdminClient({ baseUrl, apiKey }).database;
  cached = {
    origin,
    rpc: async (fn, args) => { const r = await db.rpc(fn, args); return { data: r.data, error: r.error }; },
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    log: (line) => console.log(line),
  };
  return cached;
}

const handler = createOAuthHandler(() => depsFromEnv());
export default handler;
