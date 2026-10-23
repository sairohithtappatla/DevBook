// Shared logic for "MCP Connect": personal tokens generated in the browser and the OAuth consent page.
// Kept free of React and of the InsForge client so it can be unit-tested.

export type McpScope = "read" | "draft" | "publish";
export const MCP_SCOPES: McpScope[] = ["read", "draft", "publish"];

export const SCOPE_INFO: Record<McpScope, { title: string; description: string; required?: boolean }> = {
  read: { title: "Read your books", description: "Books you are a member of, their structure and step content, including drafts where your role allows.", required: true },
  draft: { title: "Create and edit drafts", description: "Add phases and draft steps and change draft text. Readers never see drafts." },
  publish: { title: "Publish steps", description: "Make a step's text visible to readers (books you own only, always after a confirmation)." },
};

export function normalizeScopes(list: readonly string[]): McpScope[] {
  const set = new Set(list.filter((s): s is McpScope => (MCP_SCOPES as string[]).includes(s)));
  if (set.size > 0) set.add("read"); // every other scope builds on reading
  return MCP_SCOPES.filter((s) => set.has(s));
}

// ------------------------------------------------------------------------------------------------ tokens
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
export const TOKEN_RE = /^dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/;

// Same format as mcp/tools/mcp-token.mjs and the OAuth access tokens. Only {prefix, hash} leave the browser.
export async function generatePersonalToken(): Promise<{ token: string; prefix: string; hash: string }> {
  const prefix = b64url(crypto.getRandomValues(new Uint8Array(6))).slice(0, 8);
  const token = `dbk_${prefix}_${b64url(crypto.getRandomValues(new Uint8Array(32)))}`;
  if (!TOKEN_RE.test(token)) throw new Error("token format");
  return { token, prefix, hash: await sha256Hex(token) };
}

export const LABEL_RE = /^[A-Za-z0-9 ._-]{1,80}$/;

// ------------------------------------------------------------------------------------------------ OAuth consent request
export type AuthorizeRequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scopes: McpScope[];
  resource: string | null;
};
export type ParsedAuthorize =
  | { ok: true; request: AuthorizeRequest }
  // redirectable = the client and redirect URI look valid, so the error may be sent back to the app (after the server
  // confirmed the redirect URI is registered); otherwise it is shown on the page only.
  | { ok: false; error: string; description: string; redirectable: boolean; partial?: { clientId: string; redirectUri: string; state: string | null } };

export function mcpResourceUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp`;
}

export function parseAuthorizeRequest(search: string, origin: string): ParsedAuthorize {
  const q = new URLSearchParams(search);
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const state = q.get("state");
  if (!/^dbc_[A-Za-z0-9_-]{22}$/.test(clientId)) {
    return { ok: false, error: "invalid_request", description: "This link does not name a known app (client_id is missing or malformed).", redirectable: false };
  }
  if (!redirectUri || redirectUri.length > 2000) {
    return { ok: false, error: "invalid_request", description: "This link has no redirect address.", redirectable: false };
  }
  const partial = { clientId, redirectUri, state };
  if (q.get("response_type") !== "code") {
    return { ok: false, error: "unsupported_response_type", description: "Only the authorization code flow is supported.", redirectable: true, partial };
  }
  const challenge = q.get("code_challenge") ?? "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return { ok: false, error: "invalid_request", description: "The app must use PKCE with S256.", redirectable: true, partial };
  }
  const resource = q.get("resource");
  if (resource !== null && resource.replace(/\/+$/, "") !== mcpResourceUrl(origin)) {
    return { ok: false, error: "invalid_target", description: "The app asked for access to something other than DevBook's MCP server.", redirectable: true, partial };
  }
  const requested = (q.get("scope") ?? "").split(/\s+/).filter(Boolean);
  // no scope = everything DevBook offers; unknown scopes are ignored (the user picks on the consent screen anyway)
  const scopes = requested.length === 0 ? [...MCP_SCOPES] : normalizeScopes(requested);
  if (scopes.length === 0) {
    return { ok: false, error: "invalid_scope", description: "The app asked only for permissions DevBook does not have.", redirectable: true, partial };
  }
  return { ok: true, request: { clientId, redirectUri, state, codeChallenge: challenge, scopes, resource } };
}

// Appends OAuth response parameters to the registered redirect URI, keeping any query it already has (RFC 6749 §3.1.2).
export function buildRedirect(redirectUri: string, params: Record<string, string | null>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
  return u.toString();
}

export function redirectHost(redirectUri: string): string {
  try {
    const u = new URL(redirectUri);
    return u.host || `${u.protocol}//`;
  } catch {
    return redirectUri;
  }
}

// ------------------------------------------------------------------------------------------------ sign-in hand-off
// The consent page sends signed-out users to /login; after signing in they come back here.
const RETURN_KEY = "devbook_oauth_return";
export function rememberOAuthReturn(pathAndQuery: string): void {
  try { if (pathAndQuery.startsWith("/oauth/authorize?")) sessionStorage.setItem(RETURN_KEY, pathAndQuery); } catch { /* storage unavailable */ }
}
export function takeOAuthReturn(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith("/oauth/authorize?") ? v : null;
  } catch {
    return null;
  }
}
