# Phase 2A: Verification Checklist (revised)

Legend: **VERIFIED** (evidence named) · **OPEN** (you run something) · **BLOCKED** (cannot be checked from the cloud container).
Nothing here has been run against your live InsForge project: the cloud container cannot resolve `*.insforge.app` or `docs.insforge.dev`.

## 0. Rules for running anything

1. **Run only the commands in section 1, verbatim.** Everything in section 1 was checked against the installed CLI source (`@insforge/cli@0.2.8`).
2. Do **not** run: `db connection-string` (prints the DB password), `db export` without `--no-data` (dumps rows), `db import`, `db migrations up`, `secrets get`, `metadata`, `db query --unrestricted`, or `cat` on `.env.local`, `.insforge/project.json`, `.mcp.json`.
3. `db query "<sql>"` is a **raw SQL executor** (`POST /api/database/advance/rawsql`); it is not a read-only mode. It is safe here only because each statement I give you is a single `SELECT` aggregate. Never edit them into anything else.
4. The `db tables|indexes|policies|triggers` commands call `GET` endpoints, so they cannot modify anything (verified in CLI source).
5. Pipe output through `node mcp/tools/redact.mjs` (masks `ik_…`/`uak_…`/`dbk_…` keys, JWTs, `postgres://…`, `Bearer …`, and `password|secret|token|api_key|anon_key|authorization = value`). It is best effort: **read the output yourself before pasting**. Table and policy output can contain business logic. Never paste passwords, keys, tokens, connection strings, or `.env` contents.
6. Commands work in bash, PowerShell, and cmd (Node-based, no `sed`). Run from the repo root.

## 0b. Authenticating the CLI without putting a key on a command line

Verified against `@insforge/cli@0.2.8` source and confirmed by your own run:

```powershell
npx @insforge/cli login                       # browser OAuth; stores ~/.insforge/credentials.json
npx @insforge/cli list                        # prints your organizations and projects with their IDs (IDs are not secrets)
npx @insforge/cli link --org-id <ORG_ID> --project-id <PROJECT_ID>
npx @insforge/cli current                     # confirms the linked project (key is stripped from this output)
```
- **`link` with no arguments only installs global agent skills; it does not link a project** (its own description says "no args: installs agent skills only"; the CLI README is out of date). An earlier version of this checklist wrongly called it interactive.
- `link --org-id … --project-id …` signs in through your existing browser login, fetches the project's key from the platform, and writes it to `.insforge/project.json` in the current folder. That folder is git-ignored; never print or paste the file.
- Every project command (`docs`, `functions`, `db …`) then sends that stored key to your backend, which is why `docs` fails with "not linked" before this step.
- Do **not** use `link --api-base-url … --api-key …` or `login --user-api-key …`: both put a secret on the command line.

**Done by you (2026-10-18):** logged in; `list` shows org `Personal Org`, project `devbook`, region `ap-southeast`, AppKey `6ktij8hk`; `link --org-id … --project-id …` succeeded; `.insforge/project.json` is git-ignored (`git check-ignore` printed it); `current` shows OSS host `https://6ktij8hk.ap-southeast.insforge.app`; `docs functions typescript` returned the official functions page. **VERIFIED.**

## 1. Commands (all read-only)

| # | Command | What it retrieves | Why |
|---|---------|-------------------|-----|
| C1 | `npx @insforge/cli current` | Which user/org/project the CLI is linked to (skim for your email before pasting) | Confirms we target the DevBook project |
| C2 | `npx @insforge/cli docs functions typescript \| node mcp/tools/redact.mjs` | Official InsForge function docs served by your backend (`GET /api/docs/functions/typescript`) | Handler export contract, runtime limits, secrets access (F1-F3) |
| C3 | `npx @insforge/cli functions list --json \| node mcp/tools/redact.mjs` | Existing edge functions (slug, name, status) | Confirm no name clash with `hello-mcp` / `devbook-mcp` |
| C4 | `npx @insforge/cli db tables --json \| node mcp/tools/redact.mjs` | Table list | D1 |
| C5 | `npx @insforge/cli db indexes --json \| node mcp/tools/redact.mjs` | Indexes | D3 |
| C6 | `npx @insforge/cli db policies --json \| node mcp/tools/redact.mjs` | All RLS policies (name, command, roles, predicate) | D5, D6, ownership/collaborator rules |
| C7 | `npx @insforge/cli db triggers --json \| node mcp/tools/redact.mjs` | Triggers | D4 (does anything maintain `updated_at`?) |
| C8 | `npx @insforge/cli db export --no-data --tables books,phases,steps,book_members,attachments,users --output devbook-schema.sql` | **Schema only** (no rows): columns, types, defaults, constraints | D1, D2, D4: is there `steps.updated_at`? |
| C8b | `node -e "const s=require('fs').readFileSync('devbook-schema.sql','utf8');console.log('INSERT/COPY lines:',(s.match(/^(INSERT|COPY)/gim)\|\|[]).length)"` | Counts data lines in the file | **Must print 0** before you share anything. If not 0, delete the file and tell me. |
| C8c | `node mcp/tools/redact.mjs devbook-schema.sql` | Masked schema text to paste | Then delete `devbook-schema.sql` |
| C9 | `node --env-file=.env.local mcp/tools/anon-read-probe.mjs` (needs `npm ci` once) | **Counts only** of what an anonymous visitor can read from `books`/`steps` and how many steps expose non-published text. Uses only your public anon key already shipped in the website bundle; `--env-file` loads the file but nothing prints it. `.env.local` is git-ignored. | R3: is the draft leak real at the data layer? |
| C10 | `npx @insforge/cli db query "select b.publication_status, s.content->>'status' as step_status, (s.content ? 'publishedMarkdown') as has_published, count(*) as n from steps s join phases p on p.id=s.phase_id join books b on b.id=p.book_id group by 1,2,3 order by 1,2,3"` | One aggregate `SELECT`, no text, no ids. Counts of step states per book state. | Feeds the approved reader rule (below). Look at three things: rows with **empty `step_status` and `has_published = false`** (the legacy rows that show only if their book is `PUBLISHED`); rows with an **unexpected status spelling** (for example lowercase `published`), which the rule hides; and any **`Archived`** rows |
| C11 | `npx @insforge/cli db query "select role, count(*) as n from book_members group by role"` | Collaborator role counts | Whether collaborators are actually used |
| C12 | `npx @insforge/cli db query "select count(*) filter (where created_by is null) as books_without_owner, count(*) as books from books"` | Two counts | Ownership completeness |

If C10-C12 are rejected by the restricted SQL mode, say so; do **not** retry with `--unrestricted`.

Copy-paste block (identical to the table; pipes unescaped):

```bash
npx @insforge/cli current
npx @insforge/cli docs functions typescript > functions-docs.txt
npx @insforge/cli functions list --json | node mcp/tools/redact.mjs
npx @insforge/cli db tables --json | node mcp/tools/redact.mjs
npx @insforge/cli db indexes --json | node mcp/tools/redact.mjs
npx @insforge/cli db policies --json | node mcp/tools/redact.mjs
npx @insforge/cli db triggers --json | node mcp/tools/redact.mjs
npx @insforge/cli db export --no-data --tables books,phases,steps,book_members,attachments,users --output devbook-schema.sql
node -e "const s=require('fs').readFileSync('devbook-schema.sql','utf8');console.log('INSERT/COPY lines:',(s.match(/^(INSERT|COPY)/gim)||[]).length)"
node mcp/tools/redact.mjs devbook-schema.sql
node --env-file=.env.local mcp/tools/anon-read-probe.mjs
npx @insforge/cli db query "select b.publication_status, s.content->>'status' as step_status, (s.content ? 'publishedMarkdown') as has_published, count(*) as n from steps s join phases p on p.id=s.phase_id join books b on b.id=p.book_id group by 1,2,3 order by 1,2,3"
npx @insforge/cli db query "select role, count(*) as n from book_members group by role"
npx @insforge/cli db query "select count(*) filter (where created_by is null) as books_without_owner, count(*) as books from books"
```

`devbook-schema.sql` is a schema-only file; delete it after pasting. In PowerShell, if the `->>` or `?` in the SQL strings is mangled, wrap each SQL string in single quotes instead of double quotes.

## 2. What each checklist item needs

| ID | Item | Status | Source of answer |
|----|------|--------|------------------|
| D1 | Tables, columns, types | **VERIFIED (live export, 2026-10-18)** | 12 tables incl. `book_access`, `book_invitations`, `book_revisions` (unused by the app). `steps` has `type` (enum, default `MARKDOWN`), `content jsonb`, `position`, **`revision integer NOT NULL DEFAULT 1`**, `updated_at`, `created_by`, `updated_by`, `search_vector`. |
| D2 | Constraints | **VERIFIED** | **Unique `(phase_id, position)` on `steps`; unique `(book_id, position)` on `phases`**; unique `lower(slug)` on live books; FKs cascade from books -> phases -> steps. No unique on phase title or step slug. |
| D3 | Indexes | **VERIFIED** | Present for all FKs, plus GIN search vectors on books and steps. |
| D4 | `steps.updated_at` exists and is maintained | **VERIFIED** | `trigger_audit_metadata()` (BEFORE UPDATE) sets `NEW.updated_at := now()` and `NEW.updated_by := auth.uid()` on every update, overriding client values. Data agrees: 106/106 steps have `updated_at > created_at`. **`steps.revision` is never bumped**: all 106 rows are still `1`. |
| D5 | RLS enabled per table | **VERIFIED** | Enabled on books, phases, steps, book_members, attachments, users (export). |
| D6 | Policies and their functions | **VERIFIED (bodies read)** | `can_edit_book`: member with role OWNER or EDITOR. `can_manage_members`/`can_delete_book`: OWNER. `can_read_book`: soft-deleted -> OWNER only; `access_level` PUBLIC or UNLISTED -> **anyone**; else any member; FOLLOWERS_ONLY -> follower of the owner; SELECTED_USERS -> `book_access` row. **It never looks at `publication_status`.** |
| D7 | Grants | OPEN | Not exposed by the dedicated commands; infer from C6/C9. Raw catalog queries are not offered because restricted SQL mode may block system tables and `--unrestricted` is excluded by rule 2. |
| R1 | Reader falls back to draft when `publishedMarkdown` undefined | **VERIFIED** | `src/services/db.ts` (original L211-218); reproduced: old expression returned `"SECRET DRAFT"` |
| R2 | Reader page has no book `publication_status` gate and no step-status filter | **VERIFIED** | `BookReaderPage.tsx` |
| R3 | What anonymous clients can fetch | **VERIFIED (probe)** | Anonymous sees 5 books (all PUBLISHED/PUBLIC) and all 106 steps **including full `content.markdown`**. `select_steps` is row-level on the book only, so draft text is as readable as published text. |
| A1 | App auth is InsForge (email/OTP, Google, GitHub) with SDK session | **VERIFIED** | `auth.service.ts` |
| A2 | Ownership is `books.created_by`; `book_members` has OWNER/EDITOR/VIEWER; `createBook` inserts no member row | **VERIFIED** (code) | `db.ts` |
| A3 | Ownership/collaborator rules enforced by RLS | **VERIFIED** | As D6. `trigger_add_book_owner` (SECURITY DEFINER) inserts the OWNER row from `NEW.created_by` on every book insert. |
| A4 | SDK offers `createAdminClient({apiKey})` and `createClient({accessToken})` (RLS applies as that user) | **VERIFIED** | `@insforge/sdk@1.5.2` README |
| A5 | Function can build a user-scoped client | **VERIFIED (documented pattern)** | Docs example 2: read the caller's `Authorization: Bearer <jwt>`, `createClient({ baseUrl, edgeFunctionToken: jwt })`, then `client.auth.getCurrentUser()`; RLS applies. (`edgeFunctionToken` is a deprecated alias of `accessToken` per the SDK README.) Needs an InsForge user JWT from the caller; not usable with a static PAT. |
| F1 | Handler export contract | **VERIFIED** | Official docs (your `docs functions typescript` output): TypeScript, `export default async function (req: Request): Promise<Response>`, static `npm:` imports. The `@insforge/mcp` package's `module.exports` text is stale. |
| F2 | Timeout, body, memory, bundle, streaming limits | **OPEN: not in the docs page you pasted** | dashboard / other docs pages; the probe measures body-size and cold-start behaviour only |
| F3 | Env/secrets inside a function | PARTIAL | Docs examples read `Deno.env.get('INSFORGE_BASE_URL')` and `Deno.env.get('ANON_KEY')`. How a *custom* secret from `secrets add` reaches a function, and whether any admin/service key is injected, is not in the docs excerpt: **OPEN** (probe-able later with a harmless secret). |
| F4 | Does the function URL require platform authentication | OPEN | `verify.mjs` after deploy |
| F5 | Free-tier quota / cost | PARTIAL | See section 4 |
| F6 | Function logs | **VERIFIED** | `npx @insforge/cli logs function.logs` (CLI README) |
| F7 | Deploy mechanism | **VERIFIED** | CLI source: `POST /api/functions {slug,name,description,code}` or `PUT /api/functions/{slug}`; response has deployment status, URL, build logs |
| F9 | `npm:` static imports work for the platform's own SDK | **VERIFIED (docs examples)**; the MCP SDK and its dependency tree on the hosted runtime: OPEN | probe |
| F8 | `fetch-docs` MCP tool reads docs from your backend (`/api/docs/...`), not bundled | **VERIFIED** | `@insforge/mcp` source; hence blocked here |
| H1 | MCP SDK 1.32.1, stateless, JSON mode, local Deno 2.9.6 | **VERIFIED locally** | `deno task test` 15/15; `verify.mjs` 13/13 on a local server |
| H2 | Same on InsForge hosted runtime | OPEN | `hello-mcp` deploy |

## 2c. Live results you ran (2026-10-18)

| Finding | Value |
|---------|-------|
| Books | 5, all `PUBLISHED/PUBLIC`, all owned (5 OWNER rows in `book_members`, 0 books without owner) |
| Steps | 106 visible to anon: 105 `Published` + `publishedMarkdown`, 1 `Published` without it, 0 draft, 0 missing status, 0 archived |
| `steps.revision`, `steps.updated_at` | exist; maintenance behaviour unknown until function bodies are read |
| Positions | unique per parent: `(phase_id, position)` and `(book_id, position)` |
| Unused by the app | `book_revisions`, `book_access`, `book_invitations`, all `revision` columns |

### Step C results (you ran these)
`steps.revision` = 1 for all 106 rows; 106/106 steps edited after creation; `book_revisions` is empty; function bodies read (see D4, D6). **Step C is done.**

### Step C (original commands, kept for reference)
```powershell
npx @insforge/cli db functions --json | node mcp/tools/redact.mjs
npx @insforge/cli db query "select revision, count(*) as n from steps group by revision order by 1"
npx @insforge/cli db query "select count(*) filter (where updated_at > created_at) as steps_edited_after_create, count(*) as steps from steps"
npx @insforge/cli db query "select count(*) as book_revisions from book_revisions"
Remove-Item $env:TEMP\devbook-schema.sql
```
`db functions` is a GET and returns each function's name, full definition and kind. The three `db query` lines are single `SELECT` aggregates (counts only). The last line deletes the temp schema file.

### Step D (next, read-only, one query)
```powershell
npx @insforge/cli db query "select 'access_level' as enum_name, string_agg(e::text, ', ' order by e) as allowed_values from unnest(enum_range(null::access_level)) e union all select 'publication_status', string_agg(e::text, ', ' order by e) from unnest(enum_range(null::publication_status)) e union all select 'book_role', string_agg(e::text, ', ' order by e) from unnest(enum_range(null::book_role)) e"
```
A single `SELECT` that lists the allowed values of three enums (no table data). Why: the DB functions use `FOLLOWERS_ONLY`/`SELECTED_USERS`/`UNLISTED`, while the editor writes `"FOLLOWERS"` (BookEditorPage L776); if `FOLLOWERS` is not a valid value, choosing "Followers" visibility in the editor fails. The MCP tools must use the exact enum values. If the CLI rejects the query (restricted mode), say so; do not retry with `--unrestricted`.

## 2b. Reader rule (approved by you; proposal only, not applied)

| # | Condition (first match wins) | Reader gets |
|---|------------------------------|-------------|
| 1 | `publishedMarkdown` is a string | `publishedMarkdown` |
| 2 | `status` is exactly `"Published"` | `markdown` |
| 3 | `status` is exactly `"Draft"` | `""` and hidden, whatever the book's status |
| 4 | `status` missing, `markdown` is a string, book `publication_status` is exactly `"PUBLISHED"` | `markdown` (legacy) |
| 5 | everything else | `""` and hidden |

Tests: 13/13 pass in a scratch copy of the repo (`mcp/proposals/reader-leak-fix/`). Full details and the "does not fix" list are in that folder's README. Items below are the assumptions the rule depends on and the checks that settle them:

| ID | Assumption | Status | Settled by |
|----|-----------|--------|------------|
| L1 | Seeded/legacy rows have a missing status | **RESOLVED: no such rows** | 105 steps `Published` with `publishedMarkdown`; 1 step `Published` without it; 0 with missing status. |
| L2 | Anonymous visitors can read `books.publication_status` | **VERIFIED** | The 5 published/public books are visible to anon. |
| L3 | No `Archived` steps | **VERIFIED** | None in production data. |
| L4 | The app never writes a missing status | **VERIFIED** (code) | parser L96, editor add-step L448, editor import L520 write `"Draft"`; publish L588 writes `"Published"` together with `publishedMarkdown` |
| L5 | RLS stops anonymous reads of draft text | **FALSE (confirmed)** | See R3. Today no pending unpublished edits exist (the one non-matching row is the legacy `Published` step), so nothing is exposed right now, but any future draft in a PUBLISHED/PUBLIC book is readable by anyone with the anon key. |

## 3. Client authentication

| ID | Finding | Status | Source |
|----|---------|--------|--------|
| C1 | claude.ai: URL-based custom connectors on Free (1), Pro, Max, Team, Enterprise | **VERIFIED** | claude.com/docs/connectors/custom/remote-mcp |
| C2 | Same auth stack for claude.ai, Desktop, mobile, Claude Code, Cowork | **VERIFIED** | claude.com/docs/connectors/building/authentication |
| C3 | OAuth 2.0: DCR and CIMD supported by default; PKCE S256 on every request; callback `https://claude.ai/api/mcp/auth_callback`; Claude Code uses loopback redirects (any port) | **VERIFIED** | same |
| C4 | Static header (`static_headers`) is **beta, limited organizations**; an organization **Owner** enters it; not editable after creation | **VERIFIED** | same |
| C5 | Is C4 enabled for your account | OPEN | You: Customize > Connectors > Add custom connector; does a **Request headers** section exist |
| C6 | Claude Code: `claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"`; setting `Authorization` yourself disables the OAuth fallback | **VERIFIED** | code.claude.com/docs/en/mcp |
| C7 | ChatGPT: OAuth and "no authentication" described; static bearer header not found anywhere | PARTIAL (search snippets; OpenAI domains unreachable) | treat static bearer as unsupported until you see it in the dialog |
| C8 | ChatGPT plan/role for full MCP connectors | CONFLICTING | You: Settings > Connectors > Advanced > Developer mode; note the auth options shown |
| C9 | Gemini, Grok | NOT RESEARCHED | no verified information; do not assume support |

## 4. Costs (not verified against a live pricing table)

From search snippets only (insforge.dev blog "Bigger Free Tier", June 2026; docs.insforge.dev/pricing): Free plan ~100,000 edge function calls/month; free projects are **paused after 7 days without requests** (relevant: an MCP server idle for a week would stop working); Pro edge function overage ~$0.01 per 1,000 calls. Sources disagree on other limits. Confirm in your dashboard's billing/plan page before relying on any number.

## 5. What I need back

C2 (and C1, C3-C7) output, the redacted schema (C8c), C9's JSON, C10-C12 results, the two UI observations (C5, C8). Anything you cannot or do not want to share, skip; I will mark the dependent item as still OPEN.
