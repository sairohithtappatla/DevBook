# DevBook MCP: Feasibility Report (Phase 1) and Proposed Design (Phase 2)

Status: **proposal, awaiting approval. No production code, migrations, or deployments exist.**
Evidence labels: **[V]** verified (source named), **[A]** assumption, **[U]** unresolved / needs a local command.

---

## 1. Verified facts

### 1.1 Repository

| # | Fact | Evidence |
|---|------|----------|
| V1 | Frontend talks to InsForge directly with `@insforge/sdk` (anon key + user session). No custom REST layer exists. | `src/lib/insforge.ts`, `src/services/db.ts` |
| V2 | Tables touched by the app: `users`, `books`, `phases`, `steps`, `attachments`, `book_members`, `book_progress`, `step_progress`, `user_followers`. | `db.ts` |
| V3 | `books`: `publication_status` (DRAFT/PUBLISHED/ARCHIVED), `access_level` (PUBLIC/FOLLOWERS/SELECTED/PRIVATE), `slug`, `tags`, `created_by`, `deleted_at`, optional `created_at`/`updated_at`. | `db.ts` types + queries |
| V4 | `phases`: `book_id`, `title`, `position`. `steps`: `phase_id`, `title`, `position`, JSON `content`. | `db.ts` |
| V5 | `steps.content` JSON keys: `slug`, `markdown` (draft), `publishedMarkdown`, `description`, `status` (Published/Draft/Archived), `difficulty`, `estimatedTime`, `visibility`. | `db.ts` `DBStep`, editor |
| V6 | Draft and published text are already separate keys. Draft edits do not need a schema change. | V5 |
| V7 | Editor publish is **whole-book**: loops every step, sets `publishedMarkdown = markdown`, `status = "Published"`, then sets book `PUBLISHED`. MCP must not call this path. | `BookEditorPage.tsx` `confirmPublish` |
| V8 | Editor autosave rewrites the **entire** `content` object from client state (preserving `publishedMarkdown`) with a plain `update ... eq(id)`. No version check. | `BookEditorPage.tsx` ~L288 |
| V9 | `updateStep` is `update(updates).eq("id")`. `updates.content` replaces the whole JSON column. | `db.ts` |
| V10 | Ownership is `books.created_by`. `createBook` does not insert an OWNER row into `book_members`. Editor/viewer roles exist in `book_members`. | `db.ts` |
| V11 | No migrations, SQL, RLS policies, or `.env*` files in the repo. Schema/RLS cannot be audited from the repo. | `git ls-files` |

### 1.2 Draft leak (investigated, confirmed from code)

- `getBookStructure(bookId, isReaderView=true)` returns `publishedMarkdown` **only if it is `!== undefined`**, otherwise falls back to the draft `markdown` (`db.ts` ~L211-218). **[V]**
- `BookReaderPage` calls it with `true`, maps every step with `content: s.markdown`, and applies **no step-status filter** and no book `publication_status` gate (only a label mapping). **[V]**
- Consequence: any step without `publishedMarkdown` is rendered to readers with its draft text. That includes steps created by the editor's own "add step" today (it writes no `publishedMarkdown`) and any step MCP would create. Whether a non-owner can actually fetch those rows depends on RLS **[U]**.
- A naive fix ("hide steps with no `publishedMarkdown`") could hide legitimately published steps in older/seeded books that predate the field **[A]**. Needs the data query in section 5 before choosing the rule.

### 1.3 Official documentation consulted

| Topic | Finding | Source |
|-------|---------|--------|
| Claude custom connectors | URL-based custom connectors work on Free (1 connector), Pro, Max, Team, Enterprise. | claude.com/docs/connectors/custom/remote-mcp **[V, fetched]** |
| Claude auth options | "Sign in now / when needed" (OAuth), or "No sign-in". OAuth client modes: Claude's published identity (Client ID Metadata Document), automatic Dynamic Client Registration, or your own client ID. | same page **[V]** |
| Claude static tokens | Fixed API key / bearer token via **Request headers** is **"in beta and available to a limited set of organizations"**. Cannot be changed after adding; remove and re-add. Value sent verbatim (must include `Bearer `). Max 4 headers. | same page **[V]** |
| ChatGPT auth | OAuth (static creds, CIMD, or DCR) and "No authentication" are described. No source found for a static bearer-token header. | search snippets only; OpenAI pages not fetchable from this container **[partially verified]** |
| ChatGPT plans | Sources conflict (Plus/Pro vs Business/Enterprise/Edu for full MCP connectors). | search snippets **[U]** |
| Claude Code | Accepts `--header` for HTTP MCP servers. | search snippet only **[A]** |
| InsForge Functions | Deno runtime; fetch, streaming responses, ESM imports; `jsr:`, `npm:`, esm.sh specifiers; no bundler or `node_modules`; per-function env vars/secrets (AES-256-GCM at rest); cloud deploys go to Deno Subhosting; intended for request/response and short jobs. | docs.insforge.dev search snippets **[partially verified]** |
| InsForge deploy | `npx @insforge/cli functions deploy <slug> --file ./handler.ts` (single file), `functions invoke`, `secrets add/list`, `logs function.logs`. | `@insforge/cli@0.2.8` README (npm) **[V]** |
| Function URL | `https://{appKey}.function2.insforge.app/{slug}`; fallback proxy path `/functions/{slug}` on the main domain. For this project `appKey=6ktij8hk`. | `@insforge/sdk@1.5.2` source **[V]** |
| Local test backend | CLI can run a full local InsForge in Docker incl. the edge-functions runtime (`insforge local ...`). Useful for tests without touching production. | CLI README **[V]**; Docker availability **[U]** |
| MCP SDKs | `@modelcontextprotocol/sdk` 1.32.1 (Node>=18, peers zod, @cfworker/json-schema); `@modelcontextprotocol/server` 2.3.1 (Node>=20). v2 documents a Web-Standard Streamable HTTP transport with stateless mode. | npm registry **[V]**; v2 docs via search snippet |

### 1.4 Experiment: MCP SDK on Deno (local only)

Ran a throwaway probe (not project code) with **Deno 2.9.6** on this container: `npm:@modelcontextprotocol/sdk@1.32.1` + `WebStandardStreamableHTTPServerTransport` in stateless mode with `enableJsonResponse: true`, a fresh server+transport per request, invoked in-process with `Request` objects.

Observed **[V]**:
- `initialize` -> 200, protocol `2025-06-18` negotiated, `tools` capability.
- `tools/list` -> JSON Schema generated from zod (`maxLength`, `required`, `additionalProperties:false`).
- `tools/call` valid -> 200 result; invalid argument type -> `isError:true` with a validation message.
- `GET` -> 200 (opens an SSE stream). Stateless servers should answer `405`; our wrapper must enforce POST-only.
- The `npm:` import pulled in dozens of transitive packages (express, etc.), which is a cold-start / size concern on a serverless host **[A]**.

**This does not prove it runs on InsForge's Deno Subhosting.** The Deno version, import permissions, deploy size cap, and cold-start time there are unverified.

---

## 2. Assumptions (not verified)

- A1: InsForge function code can read per-function secrets via `Deno.env.get` (docs snippet says per-function env vars exist; access API not seen).
- A2: A function can call the project's database with an admin/API key supplied as a secret, bypassing RLS (so authorization must be in our code).
- A3: PostgREST sits under the database API (CLI log source `postgREST.logs`), so a conditional update (`UPDATE ... WHERE id=? AND updated_at=?`) is expressible with `.eq()` filters and returns zero rows on mismatch.
- A4: `function2.insforge.app` URLs are reachable anonymously over HTTPS (so OAuth discovery and clients can reach them).
- A5: ChatGPT cannot send a static bearer header to a custom MCP connector.

## 3. Unresolved blockers

| ID | Blocker | Impact | Resolved by |
|----|---------|--------|-------------|
| B1 | Live schema, constraints, triggers, `steps.updated_at` existence | Decides whether optimistic concurrency needs a migration | Commands in section 5 |
| B2 | RLS policies on `books/phases/steps` | Decides real exposure of the draft leak and whether anon readers can see non-published books | Section 5 |
| B3 | Edge Function limits (timeout, body size, memory, bundle size, quotas) and free-tier cost | Cannot state limits or costs yet | `npx @insforge/cli docs functions` output, plus dashboard plan page |
| B4 | Whether the `npm:` MCP SDK deploys and runs on Subhosting | Hosting decision | A throwaway "hello MCP" deploy (needs your approval; see section 8) |
| B5 | ChatGPT custom-connector auth options and plan requirement | Decides whether OAuth is mandatory in v1 | OpenAI docs (blocked here); you can check in ChatGPT settings |
| B6 | Whether Claude "Request headers" beta is enabled on your account | Decides whether a bearer token works in claude.ai | Check the Add custom connector dialog |

---

## 4. Proposed architecture

```
AI client --HTTPS POST /mcp--> InsForge Edge Function "devbook-mcp" (Deno, stateless)
                                  1. authenticate(request) -> Principal {userId, scopes, tokenId}
                                  2. new McpServer + transport per request (no shared state)
                                  3. tool handler -> authorize(userId, book) -> DevBook service layer
                                  4. service layer -> InsForge DB (service credential from secret)
                                  5. audit log line -> function.logs
```

Layers, all in one function directory so a single-file deploy stays possible (bundle step if needed):
- `transport`: POST-only; 405 for GET/DELETE; body cap (256 KB); JSON responses, no SSE; `Origin` check against an allowlist (DNS-rebinding guard from the MCP spec).
- `auth`: `TokenVerifier` interface. v1 implementation = personal access token. v2 adds OAuth access tokens behind the **same interface** (`verify(bearer) -> Principal | null`).
- `authz`: `canRead(userId, bookId)`, `canEdit(userId, bookId)` = `books.created_by = userId` OR `book_members.role IN (OWNER, EDITOR)`. Runs before every DB read/write of book content. Never trusts client-supplied user ids.
- `service`: DB operations, content merge, optimistic concurrency, validation. Pure functions where possible so tests run without a network.
- `tools`: thin zod-validated adapters.

### 4.1 Hosting decision (conditional)

Primary: InsForge Edge Function, stateless Streamable HTTP. It is the only option that adds no second provider, and it is plausibly feasible **[A]** but not yet proven (B3, B4).
Gate: after approval, deploy a throwaway no-DB `hello-mcp` function and run initialize/tools-list/tools-call against it from a real client. Only if that fails, test a minimal hand-written JSON-RPC handler (also on InsForge). A second provider is considered only if both fail, and cost/limits will be shown first.

### 4.2 Authentication flow

Claude Code, MCP Inspector and other header-capable clients can use a token today. claude.ai supports it only with the limited beta (B6), and ChatGPT is assumed not to (A5, B5). So v1 is a token for your own use, but **full ChatGPT/Claude web support requires OAuth**.

**v1: personal access token (PAT)**
1. You mint a token locally: 32 random bytes, shown once, format `dbk_<base64url>`.
2. Only `sha256(token)` is stored. This needs one new table (approval required):
   `mcp_tokens(id uuid pk, user_id uuid not null references auth.users(id), token_hash text unique not null, label text, scopes text[] not null default '{read,write}', created_at, expires_at, revoked_at, last_used_at)`. RLS enabled with no policies, so only the service credential reads it. This is not a hardcoded user id: identity comes from the token row, and revocation = set `revoked_at` (or delete the row).
3. Request: `Authorization: Bearer dbk_...` -> constant-time hash lookup -> reject if missing/expired/revoked -> Principal.
4. Token minting: a small local CLI script (not an MCP tool, not an HTTP endpoint), using your CLI credentials. No secret ever passes through the AI client except the token itself, which you paste into the client's secret/header field.

**v2 (smallest viable OAuth, only if you need ChatGPT / claude.ai without the beta)**
The MCP server acts as resource server; a minimal authorization server is added in the same function:
- `GET /.well-known/oauth-protected-resource` (RFC 9728) and `GET /.well-known/oauth-authorization-server` (RFC 8414).
- Client identification: accept Client ID Metadata Documents and/or `POST /register` (DCR). Redirect URIs must be exact-matched against the registered/metadata values.
- `GET /authorize` (PKCE S256 mandatory): sends you to the existing DevBook login (InsForge session), shows a consent screen (client name, scopes), issues a one-time code bound to the PKCE challenge.
- `POST /token`: code + verifier -> short-lived access token + rotating refresh token, stored hashed in the same `mcp_tokens` table (add `kind`, `client_id`, `parent_id`).
- Needs: one login-bridge page in the DevBook SPA (new route; small frontend change, separate approval) and `WWW-Authenticate: Bearer resource_metadata=...` on 401.
This is the largest piece of risk; I recommend not starting it until the v1 token path is deployed and tested.

---

## 5. Read-only commands for you to run locally (no secrets in output)

Run from the repo after `npx @insforge/cli login`/`link` (these are `SELECT`s and docs reads only). Paste the output; none of it should contain secrets, but skim before sharing. Tell me if any command name differs on your CLI version.

```bash
# B3: official function docs / limits as shipped with the CLI
npx @insforge/cli docs functions typescript
npx @insforge/cli docs instructions
npx @insforge/cli functions list --json

# B1: columns (needed: steps.updated_at, defaults, nullability, FKs)
npx @insforge/cli db query "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('books','phases','steps','book_members','users') order by table_name, ordinal_position"
npx @insforge/cli db query "select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and conrelid::regclass::text in ('books','phases','steps','book_members')"
npx @insforge/cli db query "select event_object_table, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where trigger_schema='public'"

# B2: RLS state and policies
npx @insforge/cli db query "select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname in ('books','phases','steps','book_members','attachments')"
npx @insforge/cli db query "select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename in ('books','phases','steps','book_members')"

# Draft-leak rule: how do existing steps look? (counts only, no content)
npx @insforge/cli db query "select b.publication_status, s.content->>'status' as step_status, (s.content ? 'publishedMarkdown') as has_published, count(*) from steps s join phases p on p.id=s.phase_id join books b on b.id=p.book_id group by 1,2,3 order by 1,2,3"
```

Also check in the UIs (answers B5/B6): in claude.ai Add custom connector, whether a **Request headers** section appears; in ChatGPT, which authentication options the connector dialog offers on your plan.

---

## 6. Data-integrity design

### 6.1 Draft-only writes
All create/update tools write only `content.markdown` (+ metadata keys) and never `publishedMarkdown`, never `status` of an already-Published step, and never `books.publication_status`/`access_level`. Implementation: read row -> `content = { ...existing, ...allowedChanges }` -> conditional write. Unknown keys are preserved. New steps are created with `status:"Draft"` and **no** `publishedMarkdown`.

### 6.2 Closing the draft leak (two options, pick after section 5 data)
- **Option R1 (recommended, tiny frontend change, 1 function):** in `getBookStructure` reader mode, include a step only if `publishedMarkdown !== undefined` OR `status === "Published"`, and always return `publishedMarkdown` (never the draft) when `status !== "Published"`. Adds a unit test. Drafts created by MCP (status Draft, no publishedMarkdown) become invisible to readers.
- **Option R2 (no frontend change):** MCP seeds nothing and relies on RLS only. Not recommended: the leak already exists for editor-created steps.
If RLS already prevents non-owners from reading unpublished books/steps, R1 is still cheap defence in depth. If the data query shows published steps lacking both fields, R1's rule must be adjusted first.

### 6.3 Optimistic concurrency
- **Revision token** = the step's `updated_at` (opaque string) if the column exists and a trigger maintains it on every update **[U, B1]**. Every read tool returns `revision`; every write tool requires `expected_revision`.
- Write = conditional update: `UPDATE steps SET ... WHERE id=:id AND updated_at=:expected` (via `.eq("updated_at", expected)`); zero rows -> `CONFLICT` with the current revision, no overwrite.
- Because the trigger fires on **any** update, MCP detects editor autosaves.
- If `updated_at` / trigger is missing: smallest migration = `alter table steps add column updated_at timestamptz not null default now();` plus a `before update` trigger setting `new.updated_at = now()`. Needs your approval; no data is rewritten.
- A content hash (sha256 of title+position+canonical content) is also returned for display/diffing but is not the CAS key, because PostgREST cannot compare a hash without a generated column and putting full Markdown in a filter would exceed URL limits.
- **Remaining gap:** the editor does not check versions, so an open editor tab with stale state can still overwrite an MCP draft on its next autosave. Mitigations: tool results tell you to reload the editor; optional follow-up (separate approval) is a ~5-line editor change adding the same `.eq("updated_at", loaded)` guard plus a conflict toast.

### 6.4 Duplicates and retries
- `create_phase`: normalized (trim, case-fold, collapse spaces) title must not already exist in the book; if it does, return the existing phase with `created:false` (idempotent).
- `create_draft`/`create_chapter`: slug derived from title; unique within the book. Same slug + same content hash -> return existing (`created:false`); same slug + different content -> `DUPLICATE` error telling the AI to use `update_draft`.
- `position` = max+1 within the parent. There is no known unique constraint **[U]**, so concurrent creates could tie; acceptable and documented.

### 6.5 Publishing a single step (`publish_draft`)
- Two phases. Call 1 (`confirm:false`, default): returns a diff (draft vs currently published), validation warnings, the book's current `publication_status`, and a `confirmation_token` = HMAC(secret, stepId + revision + sha256(markdown), 10-minute expiry).
- Call 2 (`confirm:true`, `confirmation_token`, `confirm_title` equal to the exact step title): re-reads the step, rejects if revision/hash changed, then conditionally writes **only** `content.publishedMarkdown = content.markdown` and `content.status = "Published"` for **that step**.
- Never touches other steps, `books.publication_status`, or `access_level`. If the book is not PUBLISHED the response says the step is published but the book is still not publicly visible.
- Honest limit: the server cannot prove a human consented, because an AI client can call both phases. Mitigations: tool annotations (`destructiveHint:true`, `readOnlyHint:false`) so clients prompt, the title echo, and the token tying the confirm to exactly what was previewed. Do not enable `auto-approve` for this tool.
- Mermaid/MDX validation (the editor runs it in the browser before publish) cannot run in the function; publish returns lightweight checks only (balanced code fences, size).

---

## 7. Tool schemas (all zod-validated, `additionalProperties:false`, UUIDs checked, strings trimmed and length-capped)

Limits: title <= 200 chars; description <= 500; markdown <= 100,000 chars; search query <= 200; <= 50 results per page.

Read-only (`readOnlyHint:true`)

| Tool | Input | Output |
|------|-------|--------|
| `search_books` | `query?`, `limit<=25`, `cursor?` | `[{book_id, title, slug, tags, publication_status, access_level, updated_at}]` of books the principal can read (own or member) |
| `get_book_metadata` | `book_id` | metadata + counts of phases/steps/drafts/published |
| `get_book_structure` | `book_id` | phases and steps: ids, titles, positions, slug, status, `has_unpublished_changes`, `revision`; no Markdown bodies |
| `get_step_content` | `step_id`, `include_published?` | `markdown`, optional `publishedMarkdown`, metadata, `revision`, `content_hash` |
| `search_content` | `query`, `book_id?`, `limit<=25` | matching steps with title and a <=200-char snippet (case-insensitive substring over titles, slugs, descriptions, and Markdown; no SQL passthrough) |
| `get_publication_status` | `book_id` or `step_id` | book status, step status, whether draft differs from published |

Write (draft-only; `readOnlyHint:false`, `destructiveHint:false`, `idempotentHint` where true)

| Tool | Input | Notes |
|------|-------|-------|
| `create_phase` | `book_id`, `title`, `after_phase_id?` | idempotent by normalized title |
| `create_draft` | `phase_id`, `title`, `markdown`, `description?`, `difficulty?`, `estimated_minutes?` | creates a Draft step, no `publishedMarkdown` |
| `create_chapter` | `book_id`, `phase_id` or `phase_title` with `create_phase_if_missing:true` (explicit), `title`, `markdown`, metadata | wraps the two above; phase is created only when the flag is true |
| `update_draft` | `step_id`, `expected_revision`, `markdown`, `change_summary` | replaces the draft Markdown only; caller must have read the step (revision proves it) |
| `update_step_metadata` | `step_id`, `expected_revision`, any of `title`, `description`, `difficulty`, `estimated_minutes` | renaming a step keeps its slug unless `regenerate_slug:true`, because slugs are reader URLs |

Publishing (`destructiveHint:true`)

| Tool | Input | Notes |
|------|-------|-------|
| `publish_draft` | `step_id`, `confirm` (default false), `confirmation_token?`, `confirm_title?` | section 6.5 |

Not implemented in v1: any delete, reorder, book create/update/publish, visibility change, attachment write, raw SQL, arbitrary table access.

Error model: MCP tool results with `isError:true` and a stable code in `structuredContent`: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` (also used for unauthorized books, to avoid existence leaks), `VALIDATION`, `CONFLICT` (includes current revision), `DUPLICATE`, `TOO_LARGE`, `RATE_LIMITED`, `CONFIRMATION_REQUIRED`, `INTERNAL`. Internal errors never include stack traces or credentials.

---

## 8. Security controls

- Server-side authN/Z on every call (section 4); service credential only in a platform secret; never in responses, logs, or the repo; `.env.example` lists names only.
- Token: hashed at rest, constant-time compare, expiry (default 90 days), instant revocation, `last_used_at`. Tokens never logged.
- Strict input validation; body cap 256 KB (also enforce `Content-Length` before parsing); per-call timeout (e.g. 20 s) and DB call count bound.
- Rate limiting: best-effort in-memory per isolate, plus a coarse per-token cap using `last_used_at`-style counters only if the table is approved. True global limits need shared state **[U]**; document as best-effort.
- Audit log: one structured JSON line per tool call (time, token id, user id, tool, book/step ids, outcome, revision before/after, content hash; never Markdown bodies), readable via `function.logs`.
- `Origin` allowlist, HTTPS only (platform-provided), no CORS wildcard.
- Prompt-injection posture: tool results that contain user Markdown are returned as data; write tools never act on instructions inside content; publish needs the two-phase confirm.
- Retries: creation idempotent (6.4); updates safe via CAS (a retried update with a stale revision returns `CONFLICT`, never a double write).

## 9. Test plan

Automated (Deno test; fake in-memory DB implementing the service interface, plus protocol tests through the real SDK transport):
1. Protocol: initialize/version negotiation, `tools/list` schemas, unknown tool, bad JSON, wrong method, GET -> 405, oversize body -> 413.
2. Auth: missing/invalid/expired/revoked token; token for user B cannot read or write user A's book (every tool); member roles (VIEWER cannot write, EDITOR can); unauthorized book returns `NOT_FOUND`.
3. Integrity: draft updates never change `publishedMarkdown`, `status` of published steps, book `publication_status`, or unknown content keys; metadata updates preserve Markdown; Markdown round-trips byte for byte; unrelated steps untouched.
4. Concurrency: stale `expected_revision` -> `CONFLICT` and no write; interleaved editor write is detected; retried identical `create_*` returns the same record.
5. Publish: preview makes no writes; wrong/expired token, changed content, wrong title are rejected; success changes only the target step; book status unchanged; other steps unchanged.
6. Validation: sizes, UUIDs, empty titles, duplicate phase/slug, tool-argument fuzz.
7. Reader (if R1 approved): Draft step without `publishedMarkdown` is not returned in reader mode; Published steps with and without `publishedMarkdown` still are.
Integration (only against a disposable target; never production): `insforge local` Docker instance if Docker is available **[U]**, or a separate throwaway InsForge project.
Manual end-to-end checklist: your 8 scenarios from the brief, run against a disposable/test book first, with before/after reads proving published content is unchanged.

## 10. Costs and limits (open)

Edge Function quotas, execution time, request size, and the plan's price are **not verified** (B3). I will report them from the CLI docs output before any deployment. No second provider is proposed.

## 11. Approvals requested

1. Add table `mcp_tokens` (section 4.2) (migration).
2. Confirm or add `steps.updated_at` + trigger (section 6.3) (migration, only if B1 shows it is missing).
3. Reader leak fix R1 (one frontend function + test).
4. Optional editor conflict guard (separate, can wait).
5. A throwaway `hello-mcp` deployment to test the runtime (no DB access, no secrets), to resolve B4.
6. Folder layout for the function (`mcp/` at repo root) and a Deno-test setup that does not touch the Vite build.
