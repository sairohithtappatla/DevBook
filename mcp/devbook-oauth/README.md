# DevBook OAuth ("Connect DevBook")

Lets MCP clients (ChatGPT, Claude web/desktop, Claude Code, Cursor, VS Code) connect to DevBook with a sign-in and consent
screen instead of a pasted token. Users manage connections and personal tokens in **Settings → MCP Connect**.

## How a connection works
```
AI app ──POST /mcp (no token)──► 401  WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"
   ├─GET  /.well-known/oauth-protected-resource/mcp   → resource + authorization server (the website origin)
   ├─GET  /.well-known/oauth-authorization-server     → endpoints, PKCE S256, public clients
   ├─POST /oauth/register                             → client_id (dynamic client registration, no secret)
   ├─browser: /oauth/authorize?...                    → website consent page: sign in, pick permissions, Allow
   │                                                     (database function mcp_oauth_issue_code as the user → one-time code)
   ├─POST /oauth/token  (code + PKCE verifier)        → access token (dbk_…, 1 h) + refresh token (dbr_…, rotating, 60 days idle)
   └─POST /mcp  Authorization: Bearer dbk_…           → devbook-mcp, same checks as personal tokens
```
All of `/mcp`, `/.well-known/oauth-*` and `/oauth/token|register` are on the website origin and proxied to the InsForge
functions (`vercel.json` in production, the Vite dev proxy locally). `/oauth/authorize` and `/settings` are React routes.

## Pieces
| Piece | File |
|---|---|
| Tables + database functions (hash-only storage, RLS closed, browser vs service privileges) | `../devbook-mcp/sql/003_mcp_oauth.sql` (+ `003_rollback.sql`) |
| Edge function: metadata, registration, token endpoint | `handler.ts` (tests: `tests/oauth.test.ts`) |
| MCP 401 discovery header | `../devbook-mcp/handler.ts` (`resourceMetadataUrl`) |
| Consent page | `src/routes/oauth/OAuthConsentPage.tsx` |
| Settings → MCP Connect | `src/routes/settings/SettingsPage.tsx`, `src/components/settings/McpConnectPanel.tsx` |
| Shared parsing / token generation | `src/lib/mcp-connect.ts` (tests: `mcp/proposals/rls-hardening/frontend-tests/mcp-connect.test.ts`) |
| End-to-end check (TEST project only) | `mcp/tools/oauth-flow-verify.mjs` |

## Security rules
- PKCE S256 is mandatory; codes are single use, 120 s, bound to client, redirect URI and challenge. A reused code revokes
  the connection it created. A replayed refresh token revokes the whole connection.
- Redirect URIs: https, http only on loopback, or a private app scheme (cursor://…); exact match at authorize and token time.
  The consent page never redirects to an unregistered URI and shows where the user will be sent. App names are
  self-declared, so the page says so.
- Only SHA-256 hashes of codes, access and refresh tokens are stored. Personal tokens are generated in the browser; the server
  receives only prefix + hash. Tokens never appear in logs.
- Permissions: `read` (required), `draft`, `publish`; all ticked by default, the user can untick. Publishing remains
  owner-only with its two-step confirmation inside the MCP.
- Disconnecting an app or revoking a token takes effect on the next MCP request.

## Configuration
| Secret (InsForge project) | Value |
|---|---|
| `DEVBOOK_PUBLIC_ORIGIN` | website origin: `https://devbook.rohith.engineer` (production), `http://localhost:5173` (TEST, local dev) |
| `DEVBOOK_MCP_API_KEY` | service credential, already used by devbook-mcp |

Local testing against TEST: set `DEVBOOK_FUNCTIONS_ORIGIN=https://393cz2pc.function2.insforge.app` in your local env and run
`npm run dev`; the Vite proxy then serves the same routes as production.

## Not supported (on purpose)
Client secrets / confidential clients, implicit and password grants, OpenID Connect ID tokens, Client ID Metadata Documents
(dynamic registration is used instead).
