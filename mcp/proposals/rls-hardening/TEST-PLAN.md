# Preflight, exposure verification and the eight-test plan (separate InsForge project only)

Nothing here has been run against InsForge. Everything marked **[prod-safe]** is a GET-only dedicated CLI command; everything marked **[test only]** must never be pointed at production. Keep outputs out of chat unless piped through `node mcp/tools/redact.mjs`.

## 0. Safeguards (do these first, every session)
1. Use a dedicated folder for the test project (e.g. `D:\Project\devbook-rls-test`) that contains no copy of production `.env.local` or `.insforge/project.json`. Never run `link`, `db import`, `db query` or `functions deploy` from `D:\Project\devbook`.
2. Before any command in the test folder: `EXPECTED_TEST_APPKEY=<test app key> node <repo>/mcp/proposals/rls-hardening/preflight/guard.mjs` (PowerShell: `$env:EXPECTED_TEST_APPKEY="..."; node ...`). It reads only `.insforge/project.json`, prints only the app key, and stops unless that key equals the one you named and is not `6ktij8hk`. Verified on fixtures: production folder, wrong key, missing link, bad JSON and missing env var all stop (exit 2).
3. `npx @insforge/cli current` must show the test project name. `exposure-check.mjs` additionally refuses a URL containing `6ktij8hk`.
4. The SQL migrations are applied only with `db import` from the test folder, one file at a time, after the guard passes.
5. `db query` executes ANY SQL (it is not read-only; `--unrestricted` only widens system-table access). Therefore use `preflight/run-readonly.mjs` for catalog queries: it allows only single SELECT/WITH/SHOW statements, rejects write/DDL/privilege keywords and shell metacharacters (7 negative cases tested), is a dry run unless `--exec`, and runs the guard first.

## 1. Facts about this backend that shape the checks
- The SDK does not talk to PostgREST directly. `from(t)` becomes `/api/database/records/<t>` and `rpc(fn)` becomes `/api/database/rpc/<fn>` on the InsForge API host (SDK 1.5.2 source). A function or view is "exposed" only if InsForge's proxy forwards it to PostgREST, so native PostgreSQL results prove nothing about exposure. Only a call through the test project's API does.
- `bucket.getPublicUrl(key)` is pure string building: `{baseUrl}/api/storage/buckets/book-assets/objects/{key}` (SDK source, comment: "resolves only if the bucket is public; for private objects use createSignedUrl"). So using `getPublicUrl` in the app proves nothing about the bucket; the bucket's `public` flag does. For a public bucket `createSignedUrl` returns the same long-lived URL; for a private bucket it returns an expiring URL (default 1 h, max 7 d).
- `storage buckets` and `metadata` call `GET /api/storage/buckets` and `GET /api/metadata`; both print each bucket's `public` flag (read-only).

## 2. Bucket configuration (task N4) - without secrets
[prod-safe] from the production-linked folder, read-only, after `npx @insforge/cli current`:
```
npx @insforge/cli storage buckets            # table: Bucket Name | Public (Yes/No)
npx @insforge/cli metadata                   # same flag plus object counts
npx @insforge/cli docs storage               # documentation only, to read what policies exist beyond the flag
```
Interpretation:
| Result | Meaning |
|---|---|
| `book-assets` Public = Yes | every `getPublicUrl` link is fetchable without login; neither RLS nor this proposal protects file bytes; draft attachments are reachable by anyone holding the URL |
| Public = No | the same URL needs authorization; the editor's embedded `getPublicUrl` links would fail for readers - the app would already be broken, so confirm in the UI |
| flag Yes/No but per-object rules in docs | read the docs output; do not assume |
Anonymous confirmation (one GET of one existing object; the URL comes from the editor UI, ideally a draft step's attachment; run only with your approval): `curl -s -o /dev/null -w "%{http_code}\n" "<object url>"` (PowerShell: `curl.exe -s -o NUL -w "%{http_code}" "<url>"`). 200 = anonymous access; 401/403 = protected; 404 = missing object (inconclusive).
[test only] `Q9` in `readonly-queries.sql` shows whether the backend keeps storage metadata tables with RLS. Changing the flag (`create-bucket --private`, dashboard) is a separate decision and would break images embedded in existing Markdown.

## 3. Function RPC exposure, view and function ownership (task 4)
Ownership and privileges (catalog, [test only] through `run-readonly.mjs`):
```
EXPECTED_TEST_APPKEY=<test app key> node mcp/proposals/rls-hardening/preflight/run-readonly.mjs            # dry run, prints the 10 statements
EXPECTED_TEST_APPKEY=<test app key> node mcp/proposals/rls-hardening/preflight/run-readonly.mjs --exec     # guard, then sends them
```
| Query | Proves | Pass criterion |
|---|---|---|
| Q1 | PG version, role names, which roles bypass RLS | roles `anon`, `authenticated` exist; record the version (sandbox 18.4) |
| Q2 | owner, `prosecdef`, `config` (search_path), ACL, anon/auth EXECUTE for the 14 functions | definers show `search_path=public, pg_temp`; anon/auth EXECUTE true for every helper and reader function |
| Q3 | do function owners bypass RLS | owner is superuser or BYPASSRLS (assumption A1). If not, definer helpers and owner-rights views read through RLS and the whole design must be reworked |
| Q4 | owner/RLS/FORCE/options/ACL of tables and views | `rls_on` true for all tables; `rls_forced` false (or owner is BYPASSRLS); `reader_steps` and `reader_book_step_counts` owned by the same BYPASSRLS owner, no `security_invoker` option; no INSERT/UPDATE on views for anon/authenticated |
| Q5 | CREATE on schema public | false for anon and authenticated (else search_path hijack of definers is possible) |
| Q6 | default privileges for new functions | informational; 01/02 grant EXECUTE explicitly either way (sandbox scenario with restrictive defaults passes with the grants and fails without) |
| Q7 | policies | after 03 equals `03_policy_switch.sql`; before, equals `03_rollback.sql` |
| Q8 | direct table privileges | informational (RLS is then the barrier) |
| Q9, Q10 | storage metadata, fixture size | informational |

API exposure ([test only], through the real API, anon key of the TEST project, test accounts):
```
CONFIRM_TEST_PROJECT=yes TEST_URL=https://<test-appkey>.<region>.insforge.app TEST_ANON_KEY=<test anon key> \
PROBE_BOOK_IDS=<unlisted id>,<draft id>,<public id> PROBE_USER_ID=<test owner uuid> \
[ACTOR_EMAIL=... ACTOR_PASSWORD=... ACTOR_ROLE=reader] node mcp/proposals/rls-hardening/exposure-check.mjs
```
Read each `rpc ...` line: `ERR` with not-found = the proxy does not expose that function; `ERR` permission = exposed but EXECUTE denied; `value=true` for an owner that is not the caller = membership oracle (expected before 04, must be `false` after 04); `ok rows=1` for `reader_book_tree` = exposure of the reader function and proof that the owner-rights path works through the API. `db rpc` in the CLI EXECUTES the function and is therefore not a read-only probe; use only in the test project.

## 4. Order of work in the test project
`guard` -> Q1-Q10 snapshot saved (this is the "before") -> seed fixtures via the test project's own auth (8 actors x 8 books, markers `DRAFT_SECRET`, `draft.pdf`) -> the eight tests below. Apply one SQL file at a time with `db import` from the test folder, re-running the guard before each.

## 5. The eight tests (each: action, pass criterion)
1. **Preconditions.** Q1-Q6. Pass: owners BYPASSRLS/superuser; no CREATE on `public` for anon/authenticated; `current_setting('role')` check: after step 04 is applied, TEST 6 shows whether the guard fires.
2. **Baseline reproduces the defects (validates the test itself).** Before any SQL: `exposure-check.mjs` as anon and as a viewer. Pass: draft markers and unlisted/draft/archived rows ARE returned (45 hits in the sandbox); as a VIEWER/EDITOR/REVIEWER, selecting `book_members` on a multi-book dataset shows whether `stack depth limit exceeded` (N1) occurs here. Either outcome is recorded; it settles the production-impact question for that dataset only.
3. **Steps 01 + 02 are additive.** Apply 01, 02. Pass: Q7 unchanged vs baseline; matrix results identical to test 2 except `can_read_book` now hides unpublished books from non-members; `reader_book_tree` and both views return rows through the API (A1); N1 error gone for non-owner members.
4. **Step 03 after the new frontend runs against the test project.** Pass: 8 actors x 8 books through real JWTs: zero mismatches against the approved rules, zero draft markers for anon/stranger/follower/selected/viewer in tables, `search_vector` FTS, `ilike` on `content->>markdown`, views and `reader_book_tree(include_drafts=true)`; owner/editor/reviewer do receive drafts with `include_drafts=true`.
5. **Unlisted, archived, enumeration.** Pass: the UNLISTED and ARCHIVED books appear for non-members in none of books, phases, steps, attachments, book_members, book_access, revisions, reader views, home, featured, profile, search; `reader_book_tree(<unlisted id>)` returns the published tree; a private id and a random id give the same NULL; archived stays hidden from non-members.
6. **Helper exposure and step 04.** `exposure-check.mjs` with `PROBE_USER_ID` before 04: record which helpers answer. Apply 04. Pass: every `value=` for a user that is not the caller is `false`; owner/editor flows of test 7 still work (proves the role-GUC assumption A7 and that policies are unaffected). If the guard does not fire, record it and decide separately (private schema).
7. **Application lifecycle.** As owner: create book, phase, step, attachment, member; edit draft; publish one step; reader sees only published text; counts, progress reset and attachment lists correct; a non-owner member reads `book_members` without error; visibility menu: set each of PUBLIC, UNLISTED, FOLLOWERS_ONLY, PRIVATE and confirm only `access_level` changed (title, slug and description untouched); open a SELECTED_USERS book and confirm it displays "Selected" and is not altered by opening the menu; force a failure (offline/blocked request) and confirm the badge returns to the previous value. The sandbox version of this lifecycle already passes on native PG 18.4.
8. **Storage and rollback.** Bucket flag and anonymous GET result recorded (section 2) against a draft step's attachment. Then apply `04_rollback`, `03_rollback`, `02_rollback`, `01_rollback` in this order. Pass: Q2 and Q7 output equal the saved "before" snapshot (function bodies, policies) and the test-2 matrix results are reproduced exactly.

Evidence to keep: the redacted outputs of Q1-Q10 before/after, each `exposure-check.mjs` run per actor, and the pass/fail line per test.
