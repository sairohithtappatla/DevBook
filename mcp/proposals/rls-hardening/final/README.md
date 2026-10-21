# Final SQL proposal set (NOT applied anywhere)

Supersedes the first drafts in the parent folder (`../01_*.sql` … `../04_*.sql`, `../02-*.patch`). Those files are untouched. This folder holds the consolidated, tested set. **Nothing was applied to PRODUCTION.**

Evidence sources (label every claim with one of them):
- **[local]** disposable native PostgreSQL built from a reconstruction of the schema: first on 18.4, re-run on **15.18** (the InsForge version) in `LOCAL-CHECKS-RESULT-PG15.txt`, and again on 15.18 after the 2026-10-20 review (`LOCAL-CHECKS-RESULT-PG15-REVIEW.txt`). Local results do not prove InsForge behaviour.
- **[recorded]** results reported by a separate agent (Antigravity) on the InsForge TEST project `devbook-rls-test` (393cz2pc, PostgreSQL 15.18), 2026-10-19. Raw outputs are in the untracked `evidence/` folder at the repo root; they were spot-checked, not reproduced. 01, 02, 03, 04 applied in order with the expected results; reverse rollback and forward re-apply each gave 0 catalog differences; `rpc-contract-check.mjs` 78/78. 02b and 06 (added 2026-10-20) have NOT run on the TEST project yet.

## Files and order
| File | Purpose | Rollback |
|---|---|---|
| `01_access_predicates.sql` | `can_read_book` (permission; unpublished books are members-only), new `can_discover_book`, `can_view_drafts`, `can_manage_members` -> SECURITY DEFINER (recursion fix), explicit EXECUTE for the new predicates | `01_rollback.sql` |
| `02_reader_objects.sql` | additive: `reader_markdown`, `step_is_reader_visible`, `reader_step_json`, `reader_book_tree(target_book_id uuid, include_drafts boolean DEFAULT false)` (returns NULL for soft-deleted books), views `reader_steps` / `reader_book_step_counts` (skip soft-deleted books), grants | `02_rollback.sql` |
| `02b_legacy_step_freeze.sql` | **data fix (2026-10-20, finding S1)**: legacy steps without `publishedMarkdown` whose CURRENT text readers see (status `Published`, or no status in a PUBLISHED book) get `publishedMarkdown` = that text and status `Published`. Reader output unchanged; afterwards edits (browser autosave, MCP) stay drafts instead of going live. Backup table kept for the rollback. Size it first with preflight Q11 | `02b_rollback.sql` (restores the original keys where `publishedMarkdown` is still the frozen value) |
| `03_policy_switch.sql` | the behaviour change: draft text only for OWNER/EDITOR/REVIEWER, discoverability for lists, F1, F2, F3 | `03_rollback.sql` |
| `04_helper_guard.sql` | permission helpers answer only about the caller. **Treat as part of the 03 rollout**: without it any caller can ask whether user X owns/edits book Y through the API, if the API exposes the helpers (already true today for `can_edit_book`/`can_delete_book` if exposed; 01 would add `can_manage_members`). Alternative to 04: move the helpers to a private schema | `04_rollback.sql` |
| `05_optional_reset_my_book_progress.sql` | optional, independent: exact "reset my progress" | `05_rollback.sql` |
| `02c_optional_freeze_published_without_text.sql` | OPTIONAL, owner decision after preflight Q12: freezes steps marked `Published` without `publishedMarkdown` (the shape the editor autosave bug F21 creates; their text may be an unapproved draft). Skip it to let 07 hide them | `02c_rollback.sql` |
| `07_strict_reader_rule.sql` | **defense in depth for S1**: `reader_markdown` serves ONLY an explicit `publishedMarkdown` string (no fallback to `markdown`). Refuses to run while status-less legacy steps of PUBLISHED books are unfrozen (so it must follow 02b); hides `Published` steps without published text and reports their number | `07_rollback.sql` (restores the 02 rule verbatim) |
| `06_pin_trigger_search_path.sql` | independent (finding S2): `trigger_add_book_owner()` is SECURITY DEFINER without a pinned `search_path`; pins `public, pg_temp`, body unchanged | `06_rollback.sql` |
Apply 01 -> 02 -> 02b -> [02c only on decision] -> 07 -> (deploy the website with the reader patch AND the editor keep-published patch) -> 03 + 04 together [-> 05] [06 any time]. 02b and 07 must run before 03 and before MCP write tools are enabled. Roll back in reverse (07_rollback before 02b_rollback/02_rollback). Never apply 03 before the website with the reader patch is live: the old reader selects `steps` directly and every non-editor would see empty books. Roll back in reverse. Each file is one transaction. `check-04-drift.mjs` fails if 04 stops matching 01/02.

## Decisions encoded (D-a..D-d from you, plus three new ones to confirm)
| Rule | Where |
|---|---|
| D-a draft text: OWNER, EDITOR, REVIEWER; VIEWER and non-members published text only | `can_view_drafts`, `select_steps`, `reader_book_tree` |
| D-b archived/draft books hidden from non-members, members keep role-based access | `can_read_book` (members first, then PUBLISHED required) |
| D-c UNLISTED = link only: readable via `reader_book_tree(id)`, never listed to non-members | `can_read_book` vs `can_discover_book` |
| D-d sanitized reader views/function, no editor rewrite | `reader_*` objects |
| Soft-deleted books: hidden by the reader function and views for EVERYONE, owner included (exactly like `DBService.getBook`); base tables still let the owner read them (restore tooling) | `reader_book_tree`, `reader_steps` |
| **F1 (new, confirm)** member, access and revision lists only for OWNER/EDITOR/REVIEWER. The app reads `book_members` only in the editor's collaborator panel; nothing reads `book_access`/`book_revisions` | `select_members/access/revisions` |
| **F2 (new)** `get_book_id_for_step` is SECURITY DEFINER but returns the book id only to callers who may read that book (the old invoker version had that property implicitly) | 03 |
| **F3 (new, pre-existing hole)** `insert_books` requires `created_by` = the caller. Before, any logged-in user could create a book owned by another user (`trigger_add_book_owner` trusts `created_by`) | 03 |
| Progress reset | client clears the ids returned by `reader_book_tree(book, true)`; rows of steps that are no longer visible and of books the user lost access to stay (RLS hides them from the user, harmless to others). Exact fix = optional 05 |
| Attachments | rows follow the step rule (draft viewers, or the step is reader-visible for a discoverable book). File bytes **[recorded, A12 REFUTED for non-members]**: bucket `book-assets` is private with no object-level rules; anonymous requests get 401, but ANY authenticated user who knows an object key can download it. Keys are `${stepId}/${Date.now()}.${ext}`. The website's `getPublicUrl` links therefore 401 for logged-out readers (probably already so on production, unverified there). Not fixed by this SQL set: needs signed URLs or a download function (separate decision) |

## can_manage_members() recursion: exact mechanism (reproduced, `sandbox/recursion.mjs`)
`modify_members` is FOR ALL, so it also filters SELECT, and calls `can_manage_members`, an INVOKER function that selects `book_members` and so re-applies the same policies. RLS ORs permissive policies; `select_members` (`can_read_book`, SECURITY DEFINER) normally answers TRUE first and the OR stops. It recurses when `select_members` is FALSE for a row the caller can scan: a **non-owner member of a book they cannot read**, which in the original rules means a **soft-deleted** book. Then every query that scans that row fails with SQLSTATE 54001 `stack depth limit exceeded`, whatever the dataset size; the owner never fails; the datasets in earlier reports only looked "data dependent" because they did or did not contain such a row. Fix: 01 makes the function SECURITY DEFINER with a pinned `search_path` (same body). Required grant: EXECUTE for anon/authenticated (default PUBLIC execute already covers it). Side effects: it now bypasses RLS like `can_edit_book`, so any caller could ask "is user X the owner of book Y" (closed by 04, which also guards it); the only soft-deleted-book member pattern is not present in production (5 books, 5 OWNER rows), so the bug is **dormant there, production impact unconfirmed**. After 03 nothing recurses either: the new select policies use definer helpers.

## Security review of the SQL as written
| Item | Verdict |
|---|---|
| `SECURITY DEFINER` functions (`can_read_book`, `can_discover_book`, `can_view_drafts`, `can_manage_members`, `step_is_reader_visible`, `reader_book_tree`, `get_book_id_for_step`, plus existing `can_edit_book`, `can_delete_book`) | all pin `search_path = public, pg_temp` (pg_temp last); all objects referenced are schema-qualified or resolve in `public`/`pg_catalog` first; no dynamic SQL; no caller-controlled identity except the helpers' `req_user_id` (guarded by 04). Residual risk only if `authenticated` could CREATE in `public` (query Q5) |
| `reader_book_tree` | uses `auth.uid()` only; `include_drafts=true` is ANDed with `can_view_drafts`; NULL for missing, unreadable and soft-deleted books (indistinguishable); exposes only listed fields (`CONFIRMED` against recorded output); creator row `id,name,avatar_url,bio` (no e-mail) is visible to any reader of the book, bypassing the `users` policy |
| Views `reader_steps`, `reader_book_step_counts` | owner-rights views (no `security_invoker`); function calls inside them are checked against the CALLER (verified), so `reader_markdown` must stay executable; content limited to six keys, no `search_vector`, no audit columns |
| Grants | `reader_step_json` NOT executable by PUBLIC/anon/authenticated (only called inside the definer function). Everything else keeps default PUBLIC execute like the existing helpers; explicit grants to anon/authenticated make restrictive-default backends work (tested). Not revoking PUBLIC elsewhere is deliberate: InsForge may use other roles |
| Ownership assumptions | definer functions and views must be owned by a role that bypasses RLS (A1). Unverified on InsForge: Q3 in the plan |
| Privilege escalation / bypass | none found: write policies unchanged except F3 (stricter); helpers return booleans/ids only; 04 closes the "probe another user's membership" oracle (32-34 hits per actor -> 0); F2 closes the "step id -> book id" lookup for unreadable books |
| Search | `steps.search_vector` is built from DRAFT text. After 03 the base table is readable only by draft viewers, and the reader views have no search column, so unpublished text cannot be found by readers. A future public search must use published text (not built) |
| Pre-existing, unchanged, listed for the record | `select_followers USING (true)` (follow graph public); `users` policy shows authors of any PUBLIC book (even unpublished ones); `book_progress`/`step_progress` policies unchanged |
| Behaviour change to accept | UNLISTED books open only through `reader_book_tree`, not through the base tables; the website must use the reader patch before 03 goes live |

## Rollback review
`03_rollback` restores every touched policy (including `insert_books`) and `get_book_id_for_step` verbatim from your live export; `02_rollback` drops the reader objects (their ACL goes with them); `01_rollback` restores the original `can_read_book`/`can_manage_members` and drops the two new predicates; `04_rollback` restores the pre-04 bodies; `05_rollback` drops its function. **Verified** (`sandbox/run.mjs`, phase 3): after rolling back 04,03,02,01 the per-actor behaviour, every public function (body, ACL, SECURITY DEFINER flag), every policy and the list of views equal the baseline, and `grants-report.mjs` finds no leftover function or ACL drift. Not verified: rollback on InsForge (plan test 11). Order matters: `01_rollback` fails safely (dependency error) while 02/03 objects still exist.

## Expected-behaviour changes in the test oracle
`sandbox/run.mjs` here differs from `../sandbox/run.mjs` only in the intended behaviour: soft-deleted book trees are NULL for the owner too, reader views skip soft-deleted books, member/access lists need draft-viewer rights, catalog comparison covers all public functions/policies/views. Baseline now shows 35 mismatches (was 33) because the approved rules got stricter; the final set shows 0.

## Statements in earlier reports that this folder supersedes
- "`can_manage_members` recursion is data/plan dependent" -> deterministic: non-owner member of a soft-deleted book (above).
- Baseline "33 mismatches" -> 35 under the stricter approved rules (F1, soft-delete); final 0.
- "Remove both `reader_markdown` and `reader_step_json` grants" -> only `reader_step_json`; views need `reader_markdown` executable by the caller.
- The first-draft `03` let any reader list member/access/revision rows of discoverable books and left `insert_books` open; both are fixed here (F1, F3).
- `exposure-check.mjs` / `rpc-contract-check.mjs` previously only refused the production key; they now also require `EXPECTED_TEST_APPKEY`.

## Review of 2026-10-20 (Claude Code): findings, decisions, what changed
| # | Finding | Status |
|---|---|---|
| S1 | Legacy steps (no `publishedMarkdown`; status `Published`, or no status in a PUBLISHED book): `reader_markdown` serves the CURRENT `markdown`, so any later edit went live at once; browser autosave also hid status-less legacy steps after their first save. **[local]** reproduced | fixed in three layers: `02b` freezes the text readers see today; `07` makes the reader rule strict (only `publishedMarkdown`); the MCP refuses `update_draft` on such steps (`LEGACY_STEP`). `legacy-freeze.mjs` 23/23 on PG 15.18 |
| S2 | `trigger_add_book_owner` SECURITY DEFINER without `search_path` (pre-existing) | `06` |
| S3 | Step metadata (title, description, difficulty, estimatedTime) is not drafted: edits are visible at once | **decision: keep live**; the MCP requires the `publish` scope to change metadata of a reader-visible step |
| S4 | Titles of phases that only hold drafts are readable from the base table `phases` by anyone who can discover the book (the reader tree hides them) | open (accepted for now); the MCP no longer shows such phases to VIEWERs |
| S5 | `reader_steps` view has no `security_barrier` (theoretical: published text only) | open, low |
| S8 | The rollback texts of 01/03 were copied from production on 2026-10-18 and the TEST baseline was reconstructed: a production change since then would be overwritten by a rollback | runbook step: diff live definitions against the rollback texts before applying |
| - | EDITORs can already publish whole books, change visibility and soft-delete through the API (`update_books`, `modify_steps` use `can_edit_book`) | pre-existing, unchanged; MCP publishing is now **owner-only** (decision) |
