# DevBook MCP server (local implementation, NOT deployed)

One Edge Function file, `handler.ts`: stateless Streamable HTTP MCP (official SDK 1.32.1, fresh server per request), personal access tokens, a service-side `Store`, 6 read tools, 4 draft tools and a 2-phase single-step `publish_draft`. Nothing here has run against InsForge. Everything marked **[U]** is unverified there.

## What was verified locally
`deno test` (31 tests): HTTP/auth handling, tool exposure, authorization matrix, draft isolation, validation, publishing, concurrency, rate limiting, log/secret canaries, and the real `Store` implementation running on a **disposable native PostgreSQL** with the final RLS/reader SQL (`tests/store-pg.test.ts`, through `tests/pg-db.ts`, a SQL emulation of the postgrest-js calls). Six deliberate code mutations (viewer may read drafts, CAS ignores the revision, no role check on writes, soft-deleted books visible, `update_draft` dropping other keys, publish ignoring changed content) were each caught by the tests. **Simulated:** PostgREST, InsForge's API layer, its auth, the service credential (a superuser here).

## Security model
| Concern | Implementation |
|---|---|
| Authentication | `Authorization: Bearer dbk_<8>_<43>` on EVERY request, including `initialize`/`tools/list`. SHA-256 of the token is looked up in `mcp_tokens` (`sql/001_mcp_tokens.sql`, hex text hash). Missing/malformed/unknown/expired/revoked/scope-less tokens get the identical 401 body. Tokens in query strings are ignored. Format is checked before any database call. A backend failure during lookup returns 503, never 200/401. Revocation takes effect on the next request (no cache). |
| Identity | The tool layer only receives a `Principal {userId, tokenId, scopes}`. No tool has a user-id parameter; every id the caller passes (book/phase/step) is resolved to its book and checked against that user's membership. |
| Authorization | The service credential bypasses RLS [A], so the code decides: user must be a **member** of the book (never public/other people's books), book not soft-deleted (invisible to everyone, owner included, like `getBook`). Draft text and revisions only for OWNER/EDITOR/REVIEWER; VIEWER gets the published text through the reader rule (same as `reader_markdown`) and cannot see draft-only steps at all. Writes: OWNER/EDITOR only, never on ARCHIVED books. Not-a-member and does-not-exist are the same `NOT_FOUND`. |
| Scopes and switches | `read`, `draft`, `publish` per token. Write tools exist only when `DEVBOOK_MCP_WRITE_TOOLS=true`; `publish_draft` only when additionally `DEVBOOK_MCP_PUBLISH_TOOL=true`, the token has `publish`, and `DEVBOOK_MCP_CONFIRM_KEY` is set. **All off by default.** Disabled tools are not listed and return `NOT_AVAILABLE`/`FORBIDDEN_SCOPE`. |
| Input | strict zod objects (unknown property = VALIDATION), UUIDs, length caps (title 200, description 500, Markdown 100 000, query 200, page 25), control characters rejected (Markdown keeps tab/CR/LF), body cap 256 KB (also for chunked bodies), POST only, browser `Origin` refused. Validation errors name fields and fixed problem phrases, never the rejected value. |
| Writes | Append-only positions (max+1, retry on the unique violation), idempotent `create_phase`/`create_draft`, compare-and-set on the trigger-maintained `steps.updated_at` (revision string passed through untouched, microseconds preserved), `update_draft` merges only `markdown` into the existing content (published text, status, slug, visibility, unknown keys untouched), new steps are `Draft` (hidden from readers by the reader rule). `publish_draft`: preview writes nothing and returns an HMAC token bound to user, step, revision and content hash (10 min); confirm needs the token, the exact title and an unchanged step; it sets only that step's `publishedMarkdown` and `status`. |
| Errors | Fixed messages per code. Backend/StoreError/unknown exceptions become `INTERNAL` with no text, no stack, no ids; the HTTP layer returns a generic 500/503. |
| Logs | One allowlisted JSON line per call (`tokenId, userId, tool, bookId, stepId, outcome, revisionBefore/After, contentSha256, ms`). Tokens, Markdown, titles, summaries and backend messages never reach it (canary tests). |
| Rate limit | per-token token bucket (60 reads/min, 20 writes/min), per isolate only [A]. |

## Known limits and untrusted-content warning
- Stored Markdown is **untrusted data** returned to an AI client (prompt injection). Tool descriptions say so; the client must not treat it as instructions. Books planted into a user's library were possible before fix F3 (final/03); apply F3 before exposing MCP to real accounts.
- No protection for unauthenticated floods beyond platform limits: each request with a well-formed token costs one lookup.
- The browser editor does not check revisions: an open editor tab can overwrite an MCP draft on its next autosave. Tool results say so.
- `updated_by` stays NULL on MCP edits (the audit trigger uses `auth.uid()`); `created_by` is set explicitly on inserts. Our audit log carries the user id. [A]
- Not in v1: delete, reorder, book create/update/publish/visibility, attachments, raw SQL, OAuth (ChatGPT/claude.ai without header support need it; `Principal` is the stable interface), `create_chapter`.

## Files
`handler.ts` (deployable), `sql/001_mcp_tokens.sql` + `sql/001_rollback.sql` (proposal, not applied), `tests/*`, `deno.json`, `../tools/mcp-token.mjs` (+ test: mints a token, prints only its hash as SQL).

## Deployment plan (NOT executed; test project first; every command after `preflight/guard.mjs` passed in the TEST folder)
1. Apply `sql/001_mcp_tokens.sql` to the test project.
2. Secrets (names are conventions [U]): `DEVBOOK_MCP_API_KEY` (service credential, bypasses RLS [A]), `DEVBOOK_MCP_CONFIRM_KEY` (32 random bytes, base64url). Env `INSFORGE_BASE_URL` is expected from the platform [U].
3. `npx @insforge/cli functions deploy devbook-mcp --file mcp/devbook-mcp/handler.ts --name "devbook-mcp" --description "DevBook MCP (test)"`; keep write flags off first.
4. Mint a token with `node mcp/tools/mcp-token.mjs --email <test user> --label "antigravity" --scopes read` and run the printed SQL.
5. Verify with the plan in `../proposals/rls-hardening/final/HANDOFF.md` section 6 (phase "MCP"), then enable `DEVBOOK_MCP_WRITE_TOOLS=true`, then publish.
