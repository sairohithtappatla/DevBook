# DevBook MCP: Phase 2 Design for Approval

## Updates from the live schema (2026-10-18). These override anything below that disagrees.

Source: your `db tables|policies|triggers|indexes`, schema export, anonymous probe and count queries.

1. **No steps migration is needed for concurrency (verified).** `steps.updated_at` exists and `trigger_audit_metadata()` sets it to `now()` on every update (it overrides whatever the client sends), so compare-and-set on `updated_at` works and also detects the browser editor's autosaves. `steps.revision` exists but is **never changed** (all 106 rows are `1`), so it is not usable without a trigger. Plan: CAS on `updated_at`, carrying the value as the exact string the API returned (never through a JS `Date`, which would drop microseconds; the `+` in the offset must be URL-encoded; both are tested on the disposable backend). Optional later hardening: a tiny `BEFORE UPDATE` trigger that increments the existing `revision` column, which avoids timestamp-equality pitfalls. That needs your approval.
2. **Positions are unique** (`steps (phase_id, position)`, `phases (book_id, position)`). So tools **append only** (position = max + 1, one retry on a unique-violation); `create_phase`'s `after_phase_id` is dropped. A concurrent create now fails loudly instead of producing duplicates.
3. **Authorization (bodies read).** `can_edit_book(book, uid)` = member with role OWNER or EDITOR; it does not check `deleted_at`, so the tools also require `books.deleted_at is null`. Writes call `can_edit_book` through RPC with the token's user id. **Reads must not use `can_read_book`**: it returns TRUE for every PUBLIC/UNLISTED book, which would let the MCP list other authors' books. MCP reads are limited to books where the token's user has a `book_members` row. Use the exact enum values from Step D, not the frontend's type names.
4. **Audit columns.** On INSERT `trigger_audit_metadata()` keeps an explicit `created_by`/`updated_by`, so the admin path can set them. On UPDATE it forces `updated_by := auth.uid()`; with an admin credential that is NULL (assumption: admin requests carry no user id), so MCP edits would show `updated_by = NULL`. Options: (A) accept it and rely on our own audit log lines, or (B) mint a short-lived JWT for the token's user (needs the project's JWT secret in the function) and use a user-scoped client, which fixes attribution and lets RLS enforce everything. B is stronger but concentrates a powerful secret; unverified, needs a probe.
5. **Two exposures at the API level, both pre-existing (verified from function bodies and code):**
   - **E1, book level:** `can_read_book` ignores `publication_status`. The app creates every new book as `DRAFT` + `access_level: "PUBLIC"` (MyBooksPage), so a new draft book, with all its steps, is readable by anyone holding the anon key until it is made private. Production data is unaffected today (all 5 books are PUBLISHED/PUBLIC). Smallest fix: change `can_read_book` so non-members additionally need `publication_status = 'PUBLISHED'` (members unaffected). It is a core function used by every policy, so it needs the disposable backend and your approval; exact SQL to follow.
   - **E2, step level:** within a PUBLISHED book, `select_steps` exposes each step's whole `content`, including draft `markdown`, and `fill_steps_search_vector` builds `search_vector` from the **draft** text (`content->>'markdown'`), so drafts are also searchable by anyone who can read the book. Today there are no pending unpublished edits, so nothing is exposed now; a new MCP draft chapter in your published DBMS book would be, exactly as editor drafts already are. The reader-fix patch hides drafts on the website only. Real fixes need your decision: a sanitized reader view plus restricting `select_steps` to editors, or storing drafts outside `steps.content`.
   Suggested order: read-only MCP tools first (unaffected); fix E1 and E2 before enabling draft writes on published books.
   **Update after decisions D-a to D-f:** the hardening is now specified in `mcp/proposals/rls-hardening/` (draft viewers OWNER/EDITOR/REVIEWER; archived hidden from non-members; UNLISTED = link-only via `reader_book_tree`, with discoverability separate from permission to read). Tested in a disposable PostgreSQL: 0 mismatches after the change versus 33 before, rollback exact. It also found a pre-existing recursion in `can_manage_members` and the `FOLLOWERS` write bug. Not applied anywhere; PostgREST exposure still needs the separate test project.
6. **`mcp_tokens` is still needed**; its FK to `auth.users(id)` matches how `public.users` is keyed. Follow the existing style: RLS enabled with no policy for `public`.
7. **Unused by the app**: `book_revisions` (per-book history), `book_access`, `book_invitations`, and `books.revision`/`version`. Out of scope for v1 unless you want MCP to create book revisions.

---


Supersedes sections 4-9 of `context/mcp-feasibility-and-design.md` where they differ. **Nothing in this document has been applied.** No table exists, no policy changed, nothing deployed or committed.
Labels: **[V]** verified (source), **[A]** assumption, **[U]** unknown until you return the checks in `context/mcp-phase2a-verification-checklist.md`.

---

## 1. Authentication

### 1.1 What each client can do today

| Client | Static bearer token | OAuth | Source |
|--------|--------------------|-------|--------|
| Claude Code | **Yes**: `claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"`. Setting `Authorization` yourself disables the OAuth fallback. | Yes (DCR/CIMD, loopback redirect) | **[V]** code.claude.com/docs/en/mcp |
| claude.ai, Desktop, mobile | Only via "Request headers": **beta, limited organizations**, entered by an organization Owner, immutable after creation | Yes: DCR or CIMD by default, PKCE S256, callback `https://claude.ai/api/mcp/auth_callback` | **[V]** claude.com/docs/connectors/custom/remote-mcp and /building/authentication |
| ChatGPT | **Not found in any source** | OAuth and "no authentication" described | **[A]** search snippets; OpenAI domains unreachable |
| Gemini, Grok | not researched | not researched | **[U]** |
| MCP Inspector, scripts | yes (custom headers) | - | **[A]** |

Conclusion: a personal access token (PAT) is a valid first release for Claude Code and any header-capable client, and for claude.ai only if your account has the beta (checklist C5). **ChatGPT, and claude.ai without the beta, need OAuth.** The design below makes OAuth an addition behind the same verifier interface, not a rewrite.

### 1.2 Verifier interface (stable across PAT and OAuth)

```ts
type Principal = { userId: string; tokenId: string; scopes: ("read" | "draft" | "publish")[]; kind: "pat" | "oauth" };
type TokenVerifier = (bearer: string) => Promise<Principal | null>;
```
Every tool receives only a `Principal`. No tool accepts a user id, and every query is constrained by `principal.userId`.

### 1.3 `mcp_tokens` table (proposed SQL, not applied)

```sql
create table public.mcp_tokens (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  kind          text        not null default 'pat' check (kind in ('pat')),
  token_prefix  text        not null check (token_prefix ~ '^[A-Za-z0-9_-]{8}$'),
  token_hash    bytea       not null unique check (octet_length(token_hash) = 32),
  label         text        not null check (char_length(label) between 1 and 80),
  scopes        text[]      not null default array['read','draft']
                            check (cardinality(scopes) > 0 and scopes <@ array['read','draft','publish']),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '90 days'),
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  constraint mcp_tokens_expiry_after_create check (expires_at > created_at)
);
create index mcp_tokens_user_active_idx on public.mcp_tokens (user_id) where revoked_at is null;

alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_tokens from anon, authenticated;
-- No policies: the browser (anon/authenticated) can neither read nor write this table.
```
Notes
- `auth.users(id)` as the FK target follows the project's InsForge instructions in `AGENTS.md` **[V]**.
- I deliberately do **not** use `FORCE ROW LEVEL SECURITY`: how InsForge's admin credential maps to a Postgres role is unverified **[U]**, and `FORCE` could lock out the very credential the function uses. Access is closed by `REVOKE` plus RLS with no policies. Stage 4 includes a throwaway-table test that proves the admin credential can read/write while an anon/authenticated session cannot, before the real table is created.
- Later stages extend `kind` (`oauth_access`, `oauth_refresh`, `auth_code`) and add `client_id`/`parent_id`/`code_challenge` via a separate migration.

### 1.4 Token format, hashing, lifecycle

- **Format**: `dbk_` + 8-char random id + `_` + 43-char base64url of 32 CSPRNG bytes (256 bits). Total ≤ 64 chars; anything not matching `^dbk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$` is rejected before any database call.
- **Hash**: SHA-256 over the full token string, stored as 32 bytes. A salted/slow KDF (bcrypt/argon2) is for low-entropy passwords; a 256-bit random secret cannot be brute-forced from its hash, and a fast hash keeps per-request lookup cheap. Lookup is a unique-index equality on `token_hash`.
- **Raw tokens are never stored** anywhere on the server side: not in the table, logs, secrets, or tool output.
- **Creation** (stage 4, local script `mcp/tools/mcp-token.mjs`, not yet written): run by you on your machine with your own CLI login. It generates the token with `crypto.randomBytes`, prints it **once** to the terminal (never to a file), and inserts only prefix, hash, label, scopes, expiry through `npx @insforge/cli db query`. The user is resolved from your account email by the script, never hardcoded; all interpolated values are validated against strict patterns (hex hash, UUID, `[A-Za-z0-9 ._-]` label) before the SQL string is built.
- **Default scopes** `read,draft`. `publish` is opt-in per token, so a token without `publish` can never call `publish_draft` even if the AI tries.
- **Expiry**: 90 days default, hard maximum 365; expired tokens fail the same way as unknown ones.
- **Revocation**: script sets `revoked_at = now()` by prefix or id. Effective on the next request (no cache; the table is read on every call, one indexed lookup).
- **Rotation**: mint a new token, update the client, revoke the old one (overlap allowed). **Recovery**: a lost token is revoked and re-minted; the root of trust is your own InsForge CLI/dashboard admin access.
- **`last_used_at`** is updated at most once per 5 minutes per token to avoid a write per request.
- **Display once / storage on the client side**: claude.ai stores header values and doesn't show them again **[V]**; Claude Code stores the header in its local config in plain text, so use `${VAR}` expansion from an environment variable where possible **[V]** (documented for `headers`).

### 1.5 Request handling and failure behaviour

1. `POST` only; size/Origin/content-type checks as in the probe.
2. No `Authorization: Bearer` header -> `401`, `WWW-Authenticate: Bearer realm="devbook-mcp"`, body `{"error":"unauthorized"}`. Tokens in query strings are never read (also required by Claude's guidance **[V]**).
3. Unknown, malformed, expired, revoked, and user-deleted tokens all return the identical `401` body; the reason (and token `id` if known, never the secret) goes only to the audit log.
4. Insufficient scope -> `403`, `WWW-Authenticate: Bearer error="insufficient_scope", scope="draft"`.
5. Rate limit exceeded -> `429` with `Retry-After`.
6. Notifications and `initialize`/`tools/list` also require a valid token (nothing is anonymous).

### 1.6 Secrets, rate limiting, audit logging

- **Service credential**: a function secret holding the privileged InsForge credential (the exact mechanism, including whether one is injected automatically, is **[U]**, checklist F3). It is read once per isolate from the environment, never logged, never returned. Authorization is enforced in our code before every query (section 3) because this credential bypasses RLS **[A]**.
- **Confirmation HMAC key** for publishing: a second function secret, random 32 bytes.
- **Rate limiting**: best-effort per-token token bucket held in isolate memory (e.g. 60 reads/min, 20 writes/min). Isolates are not shared, so this bounds a single instance only; a global limit needs shared state, which would be a later DB-backed counter. **[A]** documented as best effort, not a guarantee.
- **Audit log**: one JSON line per call to the function log (readable with `logs function.logs` **[V]**): time, `tokenId`, `userId`, tool, `bookId`/`stepId`, outcome code, revision before/after, SHA-256 of written content, duration. A logger that only accepts those allowlisted fields; `Authorization` header and bodies are never passed to it. Test: run a call with a canary token and assert the canary appears in no log line or response. Retention of function logs is **[U]**.

### 1.7 Smallest viable OAuth (stage 9; only if the verified client matrix requires it)

Requirements taken from Claude's authentication page **[V]**:

| Piece | Requirement | Plan |
|-------|-------------|------|
| 401 challenge | Unauthenticated request must get `401` with `WWW-Authenticate: Bearer resource_metadata="<https url>"`; a header on a 200 is ignored | MCP endpoint returns it; the metadata URL may be any HTTPS location, including under the function path |
| Protected resource metadata (RFC 9728) | `resource` must equal the MCP URL exactly; `authorization_servers[0]` is the only one used | JSON served by the function |
| Authorization server metadata | Issuer must serve RFC 8414 or OIDC discovery **at its `/.well-known/` paths**, reachable from Anthropic's egress | **Problem**: the function lives under a path prefix on `*.function2.insforge.app` **[A]**, which cannot serve `/.well-known/*` at the host root. **Smallest fix**: make `https://devbook.rohith.engineer` the issuer and add one rewrite in `vercel.json` sending `/.well-known/oauth-authorization-server` to the function (external rewrite **[A]**; the file currently rewrites everything to `index.html`). Needs your approval and a frontend config change. |
| Client identity | CIMD (Claude uses it only if metadata advertises `client_id_metadata_document_supported: true` **and** `token_endpoint_auth_methods_supported` contains `"none"`), else DCR (`registration_endpoint`) | Prefer CIMD: no client table; `client_id` is an HTTPS URL fetched and validated, restricted to an allowlist of known client-metadata hosts (SSRF control). DCR only if ChatGPT requires it. |
| Authorization endpoint | PKCE S256 mandatory; exact redirect URI match | Redirect allowlist: `https://claude.ai/api/mcp/auth_callback`, loopback `http://localhost/callback` and `http://127.0.0.1/callback` with port ignored, plus ChatGPT's URI once verified **[U]** |
| User login and consent | Authenticate the human | New SPA route on the existing site (reuses the InsForge login), shows client name, redirect host, scopes; function verifies the InsForge session JWT server-side and mints a short-lived single-use code. Needs a small frontend addition (approval). |
| Token endpoint | accepts `application/x-www-form-urlencoded`; `invalid_grant` on bad refresh; rotate refresh tokens; respond in under 10 s (30 s for refresh) | tokens stored hashed in `mcp_tokens` with new `kind`s |
| Scopes | from the 401 `scope` param or `scopes_supported` | `read`, `draft`, `publish` (consent screen shows them) |

The OAuth path issues the same `Principal`, so tools and tests do not change. If real InsForge user JWTs could be issued instead, the function could use `createClient({accessToken})` and let RLS enforce access **[V: SDK supports it]**, but whether the platform can mint such tokens for a third-party client is **[U]**, so this design does not depend on it.

---

## 2. Concurrency and drafts

### 2.1 Facts
- `steps.content` (JSON) is replaced wholesale by every write, and the editor autosave sends the full object from client memory with no version check **[V]**.
- Whether `steps.updated_at` or a trigger exists is **[U]** (checklist C7, C8).

### 2.2 Mechanism: compare-and-set on a revision counter
Preferred over a timestamp because it is strictly monotonic, immune to clock/precision/formatting issues in filters, and is forced by the database so no client can skip or spoof it. If C7/C8 show an existing, trigger-maintained `updated_at`, I will use that instead; I recommend the counter regardless and will explain the trade-off with your data in hand.

```sql
alter table public.steps add column if not exists revision bigint not null default 1;

create or replace function public.steps_bump_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  new.revision := old.revision;                        -- a client cannot set it
  if new is distinct from old then
    new.revision := old.revision + 1;
  end if;
  return new;
end $$;

create trigger steps_bump_revision before update on public.steps
for each row execute function public.steps_bump_revision();
```
- Existing rows get `revision = 1`. Existing browser-editor writes are unchanged (they do not send `revision`) but every one increments it, so MCP detects editor autosaves.
- Write path: `update steps set title=…, content=… where id = :id and revision = :expected returning *`. Zero rows -> `CONFLICT` with the current revision and no write. Atomic in PostgreSQL. Via the SDK this is `.update(...).eq("id", id).eq("revision", expected).select()` and checking the array length (not `.single()`, which errors on zero rows). That SDK behaviour is **[U]** until tested against a real backend (stage 6).
- Every read tool returns `revision` and a `content_hash`; every write requires `expected_revision`. A caller that never read the step cannot produce a valid revision, which enforces "retrieve before overwrite".
- **Remaining gap (stated plainly)**: the browser editor does not check revisions, so an open editor with stale state can overwrite an MCP draft on its next autosave. Mitigation now: tool results tell you to reload an open editor tab. Fix later (separate approval): a guard in the editor's save (`.eq("revision", loaded)` plus a conflict toast).
- **Merge rule**: `content' = { ...existing, markdown: newMarkdown }`; `publishedMarkdown`, `status`, `slug`, `visibility`, and unknown keys are carried over untouched; tests assert deep equality of all non-targeted keys.
- **Optional uniqueness (only after data check, not proposed to apply yet)**: unique `(book_id, lower(btrim(title)))` on `phases`, and unique `(phase_id, (content->>'slug'))` on `steps`, to close check-then-insert races for duplicates.

### 2.3 Duplicate and retry safety
- `create_phase`: normalized-title match inside the book returns the existing phase with `created:false`.
- `create_draft`: slug derived from title; same slug and identical content hash -> `created:false` with the existing step; same slug and different content -> `DUPLICATE` error that points to `update_draft`.
- `update_*`: a retried request after success fails with `CONFLICT` (revision moved) and can be reconciled by reading; it never double-applies.

---

## 3. Tools and authorization

Authorization (checked before any read or write of book content, in this order):
1. Principal exists and has the tool's scope (`read` / `draft` / `publish`).
2. Resolve the target book (from `book_id`, or via `phase_id` -> `book_id`, or `step_id` -> `phase_id` -> `book_id`) and require `deleted_at is null`.
3. `canRead` = `books.created_by = userId` OR a `book_members` row for the user (any role). `canEdit` = owner OR role `OWNER`/`EDITOR`. `VIEWER` cannot write.
4. Not authorized and not found are indistinguishable (`NOT_FOUND`) so book ids cannot be probed.
Rules derive from the code **[V]**; whether RLS agrees is **[U]** (checklist C6), and if the policies are stricter than this the stricter rule wins.

Global limits: title ≤ 200 chars, description ≤ 500, markdown ≤ 100,000 chars, query ≤ 200, page size ≤ 25, request body ≤ 256 KB. All inputs strict (`additionalProperties:false`), UUIDs validated, strings trimmed, control characters rejected except in Markdown.

| Tool | Scope | Input | Returns |
|------|-------|-------|---------|
| `search_books` | read | `query?`, `limit?`, `cursor?` | readable books: id, title, slug, tags, publication_status, access_level |
| `get_book_metadata` | read | `book_id` | metadata, counts of phases/steps/unpublished-changes |
| `get_book_structure` | read | `book_id` | phases and steps: ids, titles, positions, slug, step status, `has_unpublished_changes`, `revision`; no bodies |
| `get_step_content` | read | `step_id`, `include_published?` | `markdown`, optional `publishedMarkdown`, metadata, `revision`, `content_hash` |
| `search_content` | read | `query`, `book_id?`, `limit?` | steps with title and ≤200-char snippet; case-insensitive substring over title/slug/description/Markdown; no SQL passthrough |
| `get_publication_status` | read | `book_id` or `step_id` | book and step status; whether draft differs from published |
| `create_phase` | draft | `book_id`, `title` (appended at max position + 1) | phase, `created` |
| `create_draft` | draft | `phase_id`, `title`, `markdown`, `description?`, `difficulty?`, `estimated_minutes?` | step (Draft, no `publishedMarkdown`), `revision`, `created` |
| `create_chapter` | draft | `book_id`, (`phase_id` or `phase_title` + `create_phase_if_missing:true`), `title`, `markdown`, metadata | phase and step; phase is created only when the flag is explicitly true |
| `update_draft` | draft | `step_id`, `expected_revision`, `markdown`, `change_summary` | new `revision`, hash; never touches `publishedMarkdown` or `status` |
| `update_step_metadata` | draft | `step_id`, `expected_revision`, any of `title`, `description`, `difficulty`, `estimated_minutes` | new `revision`; slug unchanged unless `regenerate_slug:true` (slugs are reader URLs) |
| `publish_draft` | publish | `step_id`, `confirm?` (default false), `confirmation_token?`, `confirm_title?` | see section 4 |

Tool annotations: read tools `readOnlyHint:true`; draft tools `readOnlyHint:false, destructiveHint:false`; `publish_draft` `destructiveHint:true`. Error codes (in `structuredContent`, `isError:true`): `UNAUTHENTICATED`, `FORBIDDEN_SCOPE`, `NOT_FOUND`, `VALIDATION`, `CONFLICT` (with current revision), `DUPLICATE`, `TOO_LARGE`, `RATE_LIMITED`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_EXPIRED`, `INTERNAL`. No stack traces or credentials in any error.

Not in v1: any delete, reorder, book create/update/publish/visibility change, attachment write, raw SQL.

---

## 4. Single-step publishing (`publish_draft`)

1. **Preview** (`confirm:false`): re-reads the step, authorizes with `publish` scope and `canEdit`, returns the step identity, a bounded line diff (currently published vs draft), size, lightweight checks (balanced code fences, size), the book's `publication_status` and whether readers can currently see the book, and a `confirmation_token`. No writes.
2. **Token**: `base64url(payload).HMAC-SHA256(secret, payload)`; payload = `{sub:userId, step, rev, h:sha256(markdown), exp: now+10min}`. Stateless; a replay fails because the publish write itself bumps `revision`.
3. **Confirm** (`confirm:true`, token, `confirm_title` equal to the exact current title): re-authorizes, verifies HMAC, expiry, user, step, and re-reads the row; rejects if `revision` or hash changed (`CONFLICT`) or token expired (`CONFIRMATION_EXPIRED`).
4. **Write**: one conditional update (CAS on `revision`) setting only `content.publishedMarkdown = content.markdown` and `content.status = "Published"` for that step. It does not touch `books`, other steps, `access_level`, or `visibility`.
5. **Result**: states exactly what changed and, if the book is not `PUBLISHED`, that readers still cannot see it.
- **Honest limit**: the server cannot prove a human clicked anything; an AI client can call both phases back to back. Controls: separate `publish` scope on the token, `destructiveHint:true` so clients prompt, the title echo, and the token binding confirmation to the previewed content. Do not enable auto-approve for this tool.
- **Existing-schema check**: single-step publishing needs no schema change; the model already stores `publishedMarkdown` and `status` per step **[V]**. What it cannot do is run the editor's browser-side Mermaid/MDX validation; it says so in the preview.
- **Interaction with the reader fix**: after the fix, a published step in a book whose `publication_status` is not `PUBLISHED` is still reachable by direct URL, because the reader page has no book-status gate **[V]**. Whether RLS blocks that is **[U]** (checklist C6, C9). A book-level gate may need to be added to the reader proposal.

---

## 5. Test plan

Harness: Deno tests against a `Store` interface with an in-memory fake (fast, runs in CI/locally), plus a contract suite run against a **disposable** InsForge target (`npx @insforge/cli local …` Docker instance **[V: exists; Docker availability U]** or a throwaway project), never production.

| Group | Cases (each is a test; none implemented yet except where marked) |
|-------|------|
| Protocol/HTTP | initialize, negotiation, tools/list schemas, invalid args, unknown tool/method, 405/413/415/406/403, notifications, stateless (**implemented and run for the probe: 15 pass**) |
| Auth | missing/malformed/unknown/expired/revoked/user-deleted token -> identical 401; token never in logs or responses (canary); scope enforcement incl. `publish` absent |
| Authz | owner ok; EDITOR writes; VIEWER cannot write; stranger -> `NOT_FOUND` on every tool; soft-deleted book hidden; ids from another book rejected (phase/step belongs to different book) |
| Draft visibility | MCP-created step is invisible to the reader (**reader rule implemented and run: 9 pass in scratch copy**); end-to-end through the real reader query in the disposable target |
| Integrity | draft update leaves `publishedMarkdown`, `status`, `slug`, `visibility`, unknown keys, other steps, and book fields byte-identical; Markdown round-trips exactly |
| Concurrency | stale `expected_revision` -> `CONFLICT`, no write; simulated editor autosave between read and write is detected; two concurrent MCP updates -> exactly one succeeds; trigger forces revision and ignores client-supplied values |
| Duplicates/retries | create twice -> one record; same slug different content -> `DUPLICATE`; update retry -> `CONFLICT`, no double-apply |
| Validation | bad UUIDs, empty/over-long titles and Markdown, extra properties, control characters |
| Publish | preview writes nothing; wrong/expired/tampered token; changed content between preview and confirm; wrong title; token for another user/step; success changes only the target step; book row unchanged (deep compare); other steps unchanged; replay fails |
| Rate/size | oversize body, burst over bucket -> 429 |

---

## 6. Staged plan with approval checkpoints

| Stage | Work | Needs your approval | Rollback |
|-------|------|---------------------|----------|
| 0 (done) | Review probe, harden, reproduce tests; checklist; reader-fix proposal; this design | none | delete local files |
| 1 | You run the read-only checks (checklist section 1); I update findings | approval to run is already given for those exact commands | none |
| 2 | Deploy `hello-mcp`, verify, delete | **A1**: the exact deploy and cleanup commands in `mcp/hello-mcp/README.md` | `functions delete hello-mcp -y` |
| 3 | Apply reader fix (patch + test, optional `npm test` script); possible book-level gate | **A2**: apply to `src/`; **A3**: any RLS/view change (exact SQL after C6/C9 output) | `git revert`; SQL rollback script supplied with the SQL |
| 4 | Migration: `mcp_tokens`; `steps.revision` + trigger; admin-credential test on a throwaway table first | **A4**: exact SQL above (or adjusted by your data) | `drop trigger/function/column/table` script supplied |
| 5 | Deploy `devbook-mcp` read-only tools + PAT verifier; function secrets | **A5**: function deploy; **A6**: creating the service-credential and HMAC secrets (you create them locally; I never see values) | `functions delete`, `secrets update --active false` |
| 6 | Draft tools + concurrency, contract tests on disposable target | none beyond A5 (code only) | redeploy previous version |
| 7 | Client testing: Claude Code (header), MCP Inspector, claude.ai if beta (C5), ChatGPT after C7/C8 | **A7**: mint your first token (local script, you run it) | revoke token |
| 8 | `publish_draft` | **A8**: separate go-ahead after stage 6 is stable | disable tool, revoke `publish` tokens |
| 9 | OAuth (only if C5/C8 show it is needed) | **A9**: `vercel.json` rewrite, SPA consent route, schema extension, function deploy | revert rewrite, drop OAuth endpoints |
| any | Commit and push | **A10**: explicit, per commit | n/a |

## 7. Costs and limits

Edge Function timeout, memory, request-size, bundle-size, streaming limits: **[U]**, pending checklist C2. Pricing (search snippets only, not a live table): Free ~100,000 edge-function calls/month, free projects pause after 7 days without requests, Pro overage ~$0.01 per 1,000 calls. No second provider is proposed; one would be considered only if the hosted probe fails and a minimal hand-written JSON-RPC handler also fails on InsForge.

## 8. Unresolved items that can change this design
1. ~~Handler export format~~ **resolved** by the official docs: TypeScript, `export default async function (req: Request): Promise<Response>`, static `npm:` imports. Still open: whether the MCP SDK's dependency tree loads and runs on the hosted runtime (probe).
2. Whether the function URL requires platform authentication in front of our bearer check (probe).
3. How a custom secret (`secrets add`) and a privileged service credential reach the function. Docs show only `INSFORGE_BASE_URL` and `ANON_KEY` via `Deno.env.get`; no admin key is documented as injected. The documented alternative is a user-scoped client built from the caller's InsForge JWT (RLS applies), which a static PAT cannot supply.
4. RLS reality for anonymous and collaborator access (checklist C6, C9, C11).
5. Whether `steps.updated_at`/trigger already exist (C7, C8).
6. ChatGPT's connector authentication options and plan requirement; Gemini/Grok.
7. `/.well-known` routing for OAuth (rewrite assumption).
