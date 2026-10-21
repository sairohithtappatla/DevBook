# DevBook MCP: local completion and handoff to real-backend verification

## 0. Current state (updated 2026-10-20; supersedes the original state line and sections 2, 3 and 5 where they differ)
- Git: the work is COMMITTED on `v2` (734c856, cc35ac3, 9da7167 = `origin/v2`); `main` (production) is unchanged at 332a3ac; `src/` is unchanged on v2. The 2026-10-20 review changes are local and uncommitted until approved.
- TEST project `devbook-rls-test` (393cz2pc, **PostgreSQL 15.18**) **[recorded, Antigravity, 2026-10-19; raw outputs in the untracked `evidence/` folder]**: baseline loaded, original defects reproduced; 01, 02, 03, 04 applied with the expected results; reverse rollback restored the original catalog with 0 differences (and `01_rollback` before 02/03 fails safely with a dependency error); forward re-apply gave 0 differences; `rpc-contract-check.mjs` 78/78; MCP deployed with read tools, then write and publish tools, then the flags were switched OFF again; website patches verified on a scratch copy against the TEST project. Production: nothing applied.
- Not yet on the TEST project: `02b`, `06`, and the 2026-10-20 handler changes (owner-only publish, legacy freeze, jittered append retry, token-bound confirmation, metadata needs `publish` on visible steps, viewer phase filter).
- Corrections to statements made elsewhere: the backend is PostgreSQL **15.18** (not "18 devel"); MCP cold start is about **4 s** (3996 ms measured), not "<150 ms"; under the original code EDITORs could publish through MCP (now owner-only); the reader function is `reader_book_tree(target_book_id uuid, include_drafts boolean DEFAULT false)`; the write tools are `create_phase`, `create_draft`, `update_draft`, `update_step_metadata`, `publish_draft`.

Original state line (2026-10-18, historical): branch `v2` (= `origin/v2` = `main` at 332a3ac), working tree clean apart from untracked proposal files; native PostgreSQL results do not prove InsForge compatibility.

## 1. What was completed
| Area | Result | Where |
|---|---|---|
| Final SQL set (01-05 + rollbacks) | consolidated, with soft-delete rule, grant trim, F1 member/access/revision lists, F2 `get_book_id_for_step`, F3 `insert_books` hole | `mcp/proposals/rls-hardening/final/` |
| `can_manage_members` recursion | exact mechanism reproduced (non-owner member of a soft-deleted book), fixed by 01, documented | `final/README.md`, `final/sandbox/recursion.mjs` |
| MCP server | one-file Edge Function, 6 read + 4 draft + 1 publish tools, tokens, authz, safe errors, no secret in logs | `mcp/devbook-mcp/` |
| Tokens | `mcp_tokens` SQL + local token tool (prints only a hash as SQL) | `mcp/devbook-mcp/sql/`, `mcp/tools/mcp-token.mjs` |
| Website patches | verified COMBINED (access-level, then stacked reader) on v2's real `src/`; plain reader patch also still applies alone | `../frontend-*.patch`, `../verify-patch-order.sh` |
| Oracle | updated for the intentional behaviour (soft-deleted -> NULL for owner, F1) | `final/sandbox/run.mjs` |
| Safety of scripts | all PostgreSQL scripts refuse a non-local `PGHOST`; API scripts need `EXPECTED_TEST_APPKEY` = first label of an https URL and refuse the production key | see section 4 |
| One command for all local checks | `final/run-local-checks.sh` (27 checks) | `final/LOCAL-CHECKS-RESULT.txt` |

## 2. Exact files
Everything is new/untracked. Paths relative to `/home/user/DevBook`.
- `mcp/proposals/rls-hardening/final/`: `01_access_predicates.sql`, `01_rollback.sql`, `02_reader_objects.sql`, `02_rollback.sql`, `03_policy_switch.sql`, `03_rollback.sql`, `04_helper_guard.sql`, `04_rollback.sql`, `05_optional_reset_my_book_progress.sql`, `05_rollback.sql`, `README.md`, `HANDOFF.md`, `LOCAL-CHECKS-RESULT.txt`, `run-local-checks.sh`, `check-04-drift.mjs`, `sandbox/{schema.sql,run.mjs,recursion.mjs,insert-books.mjs}`.
- `mcp/devbook-mcp/`: `handler.ts`, `deno.json`, `README.md`, `sql/001_mcp_tokens.sql`, `sql/001_rollback.sql`, `tests/{handler.test.ts,store-pg.test.ts,fake-store.ts,pg-db.ts}`.
- `mcp/tools/`: `mcp-token.mjs`, `mcp-token.test.mjs`.
- `mcp/proposals/rls-hardening/` (round 3/4 files, earlier this branch of work): `02-trim-grants.patch`, `02-tree-hide-soft-deleted.patch`, `02-tree-hide-soft-deleted.revert.sql`, `frontend-reader-integration.patch`, `frontend-reader-integration.after-access-level.patch`, `verify-patch-order.sh`, `rpc-contract-check.mjs`, `rpc-expectations.mjs`, `rpc-expectations.test.mjs`, `FOLLOWUP-REPORT.md`, `READER-INTEGRATION.md`, `sandbox/{lifecycle,softdelete,progress-reset,grants-report}.mjs`, `frontend-tests/*` (incl. regenerated fixtures).
- Existing proposal files **edited this session** (all untracked files of mine): the nine PostgreSQL scripts (`sandbox/run.mjs`, `lifecycle.mjs`, `softdelete.mjs`, `progress-reset.mjs`, `grants-report.mjs`, `frontend-tests/generate-fixtures.mjs`, `generate-softdelete-fixtures.mjs`, `final/sandbox/*`) gained the local-PGHOST guard; `exposure-check.mjs` and `rpc-contract-check.mjs` gained the second lock and lazy SDK import; `progress-reset.mjs` reads `05_*.sql` when present; `frontend-tests/fixtures/reader-fixtures.json` and `softdelete-fixtures.json` were regenerated from the final SQL (only timestamps changed).
- `context/mcp-feasibility-and-design.md` was restored as an untracked copy (it lived in a commit on the old session branch; switching to `v2` removed it from the tree). `context/progress-tracker.md` was NOT updated (nothing was applied).
- Windows note: on a CRLF checkout, apply the website patches with `git apply --ignore-whitespace`; `mcp/.gitattributes` forces LF for scripts, patches, SQL and sources inside `mcp/`; `check-04-drift.mjs` tolerates CRLF. Local AGENTS.md copies can differ from the committed one (the committed v2/main copy still contains the original project rules): check `git diff AGENTS.md` on your machine.
- Superseded claims in older reports: see `final/README.md` (recursion is not "data dependent"; baseline mismatches 35 not 33; reader_markdown grant must stay).

## 3. Commands and actual results (this container, disposable PostgreSQL 18.4 on 127.0.0.1:54329)
```
PG_MODULE=<node_modules with pg> PGPORT=54329 DENO=<deno 2.9.6> DENO_DIR=<cache> \
FE_NODE_MODULES=<website node_modules> PARSER_DIR=<node_modules with libpg-query> \
bash mcp/proposals/rls-hardening/final/run-local-checks.sh
```
Result: **27 PASS, 0 FAIL, 0 SKIP** (full table in `LOCAL-CHECKS-RESULT.txt`). Key numbers:
- RLS matrix, 8 actors x 8 books: original policies 35 mismatches against the approved rules and 45 draft-text hits for non-draft actors; final set **0 mismatches, 0 hits** (272 checks); after rolling back 04,03,02,01 the behaviour, all public function bodies/ACLs, policies and views equal the baseline.
- Adversarial: helper membership oracle 32-34 hits per actor without 04, **0 with 04**; the unlisted book appears in no table/view for anon/stranger/follower; `get_book_id_for_step` of a private book's step returns NULL to non-members.
- Recursion: original fails for non-owner members of a soft-deleted book with SQLSTATE 54001 (editor and viewer; any dataset size), owner never; 01 alone and final both fine.
- F3: spoofed `created_by` accepted by the original policy (victim became OWNER), refused by the final set; normal insert and `created_by = self` still pass.
- MCP: 31 Deno tests (23 in-memory, 8 on real tables); `deno check` and lint clean; 6/6 deliberate code mutations caught; token tool 5/5; RPC expectations 4/4.
- Website, combined patches on v2's `src/`: `tsc -b` clean, `vite build` OK, oxlint 36 -> 36, 17 data-layer + 4 page + 5 soft-delete + optimistic-rollback tests pass.
- Mutation check of the SQL suite: removing the soft-delete check or opening `select_steps` fails the matrix; making VIEWER a draft role is only caught when 01 and 04 are edited together, which is why `check-04-drift.mjs` exists.
Skipped/failed: none in the script. **Not run anywhere:** any InsForge call, browser test, Deno deploy, `rpc-contract-check.mjs`, `exposure-check.mjs`, `guard.mjs --exec`.

## 4. Can a test script hit production by accident? (reviewed)
| Script | Reaches | Protection |
|---|---|---|
| `sandbox/*.mjs`, `final/sandbox/*.mjs`, `frontend-tests/generate-*.mjs` | PostgreSQL named by `PGHOST` (they CREATE/DROP databases) | refuse anything but 127.0.0.1/localhost/::1 (tested with a remote host) |
| `devbook-mcp/tests/store-pg.test.ts` | PostgreSQL | hard-coded 127.0.0.1; Deno `--allow-net=127.0.0.1` |
| `exposure-check.mjs`, `rpc-contract-check.mjs` | an InsForge project (SDK; sign-in + RPC reads) | need `CONFIRM_TEST_PROJECT=yes`, `EXPECTED_TEST_APPKEY` equal to the first label of an https `TEST_URL`, refuse `6ktij8hk` (tested) |
| `preflight/guard.mjs`, `run-readonly.mjs --exec` | the project linked in the CURRENT folder | guard stops unless the folder's app key equals `EXPECTED_TEST_APPKEY` and is not production (tested on fixtures) |
| `mcp/tools/mcp-token.mjs` | nothing (prints SQL) | no network code |
| `mcp/tools/anon-read-probe.mjs` | production, by design | read-only SELECTs with the website's public anon key, only when YOU run it with `--env-file`; it is not part of any test suite |
| `hello-mcp/verify.mjs` | the URL you pass | no DB, no secrets |
| the MCP handler itself | the project named by `INSFORGE_BASE_URL` of the function | deployed only by you; deploy from the TEST folder after the guard |
Residual risk: the CLI uses whatever project is linked in the current folder (admin key) and its read-only commands still send a usage record to that project; keep a separate folder per project.

## 5. Assumptions
Status after the TEST project run **[recorded, 2026-10-19]**:
| # | Status |
|---|---|
| A1, A2, A3, A7, A8 (definer/owner bypass, `auth.uid()`, roles, RPC/view exposure, response envelope) | confirmed in practice: 01-04 behaved as designed through the API and `rpc-contract-check.mjs` passed 78/78 |
| A6 PostgreSQL version | **15.18** |
| A9 service credential reads/writes `mcp_tokens`, anon/authenticated cannot | confirmed |
| A10 secrets and URL of a deployed function | confirmed; URL pattern `https://<app_key>.function2.insforge.app/<slug>` |
| A12 storage | **REFUTED for non-members**: private bucket, anonymous 401, but any authenticated user who knows an object key can download it (no object-level rules); `getPublicUrl` links 401 when logged out |
| A15 per-isolate rate limiting | **UNVERIFIED**: the test sent 200 sequential requests at ~2 s each, below the 60/min refill, so it could not trigger; do not rely on it (platform-level limits needed) |
| A16 `npm:` imports resolve on hosted functions | confirmed; cold start ~4 s |
| Parallel appends | 10 parallel `create_draft` gave 4 successes and 6 `INTERNAL` with the original 3-attempt retry (no data corruption); fixed locally 2026-10-20 (8 attempts, jittered backoff, `BUSY` instead of `INTERNAL`), not yet re-run on TEST |

Original list (2026-10-18, before the TEST project run):
A1 definer functions/views run as a role that bypasses RLS · A2 `auth.uid()` reads the JWT subject, NULL for anon · A3 database roles `anon`/`authenticated` exist and table grants are as modelled · A4 production DDL of `book_access`, `user_followers`, `step_progress`, `book_progress`, `book_revisions` (sandbox reconstructs them, incl. `ON DELETE CASCADE`) · A5 enum values · A6 PostgreSQL version · A7 `/api/database/rpc/<fn>` and `/records/<view>` forward functions/views; the API sets Postgres `role` to anon/authenticated (04 depends on it; if not, 04 is inert) · A8 RPC response envelope: jsonb returned as `data`, NULL as `null`, error shape/status for unknown or forbidden functions · A9 the service credential bypasses RLS and can read/write `mcp_tokens` while anon/authenticated cannot · A10 how a deployed function obtains `INSFORGE_BASE_URL`, secrets, and which hostname/path it is served on · A11 `steps.updated_at` trigger-maintained (verified from your export) and microsecond strings round-trip through the API filter · A12 bucket `book-assets`: your CLI output says Public: No; whether every object endpoint rejects anonymous and unauthorized users, how the website's `getPublicUrl` links in Markdown render for readers, whether authenticated non-members can list/download draft attachments · A13 sign-up/e-mail verification flow for creating the 5 test users · A14 a soft-deleted book can be set through the API by an owner (to seed the DELETED case) · A15 per-isolate rate limiting is acceptable · A16 the hosted functions runtime resolves the `npm:` imports of `handler.ts` (MCP SDK 1.32.1, zod 3.25.76, zod-to-json-schema 3.24.6, @insforge/sdk 1.5.2) within its bundle-size and cold-start limits (only the earlier echo probe ran on Deno locally; deploy that probe or the read-only handler first).

## 6. Verification plan for Antigravity (separate InsForge TEST project ONLY)
Rules for the agent: work only in the test project; never use or request production credentials; read-only queries unless a step says "apply"; apply one SQL file at a time, save before/after evidence; stop at the first mismatch and report instead of fixing; never print keys or tokens.

**Phase 0 - identity of the target.** (1) Confirm the connected project's app key/URL is NOT `6ktij8hk` (compare with the project metadata the MCP exposes). (2) State the project name and Postgres version (`select version()`). Stop if it could be production.

**Phase 1 - catalog preflight (read-only).** Run `mcp/proposals/rls-hardening/preflight/readonly-queries.sql` Q1-Q10 and save the output as the "before" snapshot (also `pg_get_functiondef` of every public function, all policies, `pg_default_acl`). Also: `select pg_get_functiondef('auth.uid()'::regprocedure)` (answers A2) and roles with `rolbypassrls`/`rolsuper` (A1, A3). Expected: roles `anon`, `authenticated` exist; function owners bypass RLS; `has_schema_privilege('authenticated','public','CREATE')` is false.

**Phase 2 - schema parity.** Export DDL of the five reconstructed tables, enums and triggers (`trigger_audit_metadata`, `trigger_add_book_owner`) and diff against `final/sandbox/schema.sql`. Record every difference (A4/A5). Stop if foreign keys or the `updated_at` trigger differ materially.

**Phase 3 - identity and API plumbing (test-only helper).** Create `public.__whoami()` (SECURITY INVOKER, returns `auth.uid()`, `current_user`, `current_setting('role', true)`, `current_setting('request.jwt.claims', true)`), call it through the API (a) with the anon key, (b) signed in as the owner test user; expected: anon -> NULL uid and role `anon`; signed in -> the user's id and `authenticated`. Record whether `GET`/`POST /api/database/rpc/__whoami` work and the exact response/error shape (A7, A8). Drop the helper afterwards.

**Phase 4 - seed.** Create users owner, editor, reviewer, viewer, stranger through the project's auth; seed the fixture described in `FOLLOWUP-REPORT.md` section 5 (PUB, EMPTY, UNL, DRAFTBOOK, DELETED) with memberships, one draft-only step, attachment rows `pub.pdf`/`draft.pdf`, plus one DELETED book with an editor and a viewer member (for the recursion case) and 2 uploaded dummy files in `book-assets` (no real content).

**Phase 5 - baseline (before any change).** Run `exposure-check.mjs` as anon and as viewer (env as documented in the script header, `EXPECTED_TEST_APPKEY` set). Expected (reproduces the known defects): draft Markdown and `search_vector` returned, DRAFT/UNLISTED books listable, helper RPC `can_edit_book(book, owner)` callable (record yes/no per helper), selecting `book_members` as the editor/viewer fails with the stack-depth error because of the soft-deleted book. Record everything; this validates the test itself and answers A7 for the helpers.

**Phase 6 - apply 01, then 02 (additive).** Apply `final/01_access_predicates.sql`, then `final/02_reader_objects.sql`. Check: Q2 flags (`reader_step_json` anon/auth EXECUTE false; `reader_markdown`, `reader_book_tree`, `step_is_reader_visible`, `can_discover_book`, `can_view_drafts` true); recursion gone (`book_members` readable by editor/viewer on the dataset with the DELETED book); `reader_book_tree` and both views return rows through the API for anon (A1, A7). Run `rpc-contract-check.mjs` only for the tree rows (draft-viewer rows still expect pre-03 base-table behaviour elsewhere).

**Phase 7 - apply 03.** Apply `final/03_policy_switch.sql`. Run `exposure-check.mjs` per actor (anon, stranger, viewer as readers; owner/editor/reviewer as draft-viewers) and `rpc-contract-check.mjs` for all 6 actors with `SOFT_DELETE_PATCH=yes`. Expected: zero draft markers for anon/stranger/viewer in every table, view, `search_vector` FTS, `ilike` on `content->>markdown`, and `include_drafts=true`; UNLISTED/DRAFT/ARCHIVED/DELETED books absent from all lists for non-members; `book_members`, `book_access`, `book_revisions` empty for viewers; owner/editor/reviewer see drafts via `include_drafts=true`; random id and inaccessible id both return `null`; `insert` of a book with someone else's `created_by` is refused, a normal insert works.

**Phase 8 - apply 04 and test the helpers.** Apply `final/04_helper_guard.sql`. Re-run the helper probes of `exposure-check.mjs` (`PROBE_USER_ID`= owner id): every `value=` for a non-caller id must be `false`; then repeat Phase 7 to prove policies and the app flows are unaffected (owner creates a phase/step, editor edits, viewer reads). If the guard does not fire (role GUC not set), record it and decide separately.

**Phase 9 - attachments and storage (read-only unless stated).** With `storage buckets` metadata and the seeded dummy files: (a) anonymous GET of the draft step's file URL and of the published step's file URL; (b) authenticated stranger GET; (c) authenticated viewer GET of the draft file; (d) authenticated bucket list as stranger; (e) a Markdown image link built with `getPublicUrl` opened logged-out. Expected for a private bucket: 401/403 for anonymous and non-members; record anything else as a finding, and report whether embedded images can render for readers (A12). Do not change the bucket flag.

**Phase 10 - website reader (test deployment or local dev against the test project).** Apply the patches in the documented order to a scratch copy (access-level, then `frontend-reader-integration.after-access-level.patch`), point `VITE_INSFORGE_URL`/anon key at the test project, and walk through: public reader page (published text only), unlisted link, owner preview with a draft step, empty book, soft-deleted book URL shows "Book not found", step counts on Home/My Books, progress mark + reset (record leftover rows), visibility menu for all five levels incl. forced failure rollback, SELECTED_USERS book not overwritten.

**Phase 11 - MCP function.** Apply `mcp/devbook-mcp/sql/001_mcp_tokens.sql`; check `anon`/`authenticated` cannot select/insert/update the table through the API while the service credential can (A9). Set secrets, deploy `handler.ts` (write flags OFF), mint a read-only token with `mcp-token.mjs`, run the SQL it prints. Test with an MCP client or curl-equivalent: 401 identical for missing/garbage/revoked/expired tokens; `tools/list` shows 6 tools; `search_books` returns only the token owner's member books; viewer token cannot read `Draft only step`; stranger token gets `NOT_FOUND` for the owner's ids; soft-deleted and other users' books unreachable; error bodies and `functions logs` contain no token/Markdown. Then enable `DEVBOOK_MCP_WRITE_TOOLS=true` and test `create_phase`, `create_draft`, `update_draft` (stale revision -> CONFLICT, a browser-editor save in between -> CONFLICT), `update_step_metadata`; confirm with `reader_book_tree` as anon that new drafts are invisible and published text is unchanged, and check `updated_by`/`created_by` of the rows. Finally enable the publish tool and test preview -> confirm (wrong title, changed content, expired token, other user's token, replay). Only after all pass may the token scopes be widened.

**Phase 12 - rollback.** Apply `05_rollback` (if used), `mcp 001_rollback`, `04_rollback`, `03_rollback`, `02_rollback`, `01_rollback` in that order. Re-run Q1-Q10 and the pg_get_functiondef/policy dump and diff with the Phase 1 snapshot: identical; re-run Phase 5 to confirm the baseline behaviour returns.

**Phase 13 - evidence.** Table of phase, check, expected, observed, pass/fail, with redacted outputs; list of every assumption A1-A15 as confirmed/refuted.

## 7. SQL migration and rollback files to review
In order: `final/01_access_predicates.sql` -> `02_reader_objects.sql` -> `03_policy_switch.sql` -> `04_helper_guard.sql` -> (`05_optional_reset_my_book_progress.sql`), and `mcp/devbook-mcp/sql/001_mcp_tokens.sql`; rollbacks `*_rollback.sql` in reverse. Review notes: `final/README.md` ("Security review of the SQL as written", "Rollback review"). Points to look at specifically: F1-F3 are new decisions; 04 duplicates seven function bodies (drift check exists); 03 changes `insert_books`; 05 and `mcp_tokens` are optional/separate.

## 8. What remains before production
**See `PRODUCTION-RUNBOOK.md` (2026-10-20) for the step-by-step go-live procedure.** Decisions taken 2026-10-20: MCP publishing owner-only; step metadata stays live (MCP needs the `publish` scope to change it on a visible step). Planned (not a final decision yet): MCP is not part of the first production rollout. The list below is the original one.
1. Your decisions: F1, F2, F3, archived-books-read-only for MCP, optional 05, hide-from-everyone rule for soft-deleted books, MCP token table and write/publish enablement.
2. Real-backend evidence for A1-A15 (section 6) with every phase green; especially API exposure of functions/views, role/GUC behaviour, service-credential privileges and the storage behaviour.
3. Browser-level test of the patched website (reader, editor visibility menu, progress, counts) against the test project.
4. Deploy order in production: 01, 02 -> website with both patches live -> 03 and 04 together (-> 05). Never 03 before the website.
5. Back up/snapshot policies and functions first (Phase 1 export doubles as the rollback reference).
6. Decide storage (private bucket needs signed URLs for images embedded in Markdown, or accept the current behaviour) and OAuth if claude.ai/ChatGPT clients must connect without custom headers.
7. Operational: token issuance/rotation procedure, log retention and review, platform-level rate limiting for unauthenticated floods, MCP write tools enabled only per token scope after Phase 11.
8. Update `context/progress-tracker.md` when anything is actually applied.
