# Final SQL proposal set (NOT applied anywhere)

Supersedes the first drafts in the parent folder (`../01_*.sql` … `../04_*.sql`, `../02-*.patch`). Those files are untouched. This folder holds the consolidated, tested set. **Nothing was applied to any database.** All behaviour below was observed on a disposable native PostgreSQL 18.4 built from a reconstruction of your schema; it does not prove how InsForge's roles, `auth.uid()`, grants, ownership or API exposure behave (see HANDOFF.md section 5).

## Files and order
| File | Purpose | Rollback |
|---|---|---|
| `01_access_predicates.sql` | `can_read_book` (permission; unpublished books are members-only), new `can_discover_book`, `can_view_drafts`, `can_manage_members` -> SECURITY DEFINER (recursion fix), explicit EXECUTE for the new predicates | `01_rollback.sql` |
| `02_reader_objects.sql` | additive: `reader_markdown`, `step_is_reader_visible`, `reader_step_json`, `reader_book_tree` (returns NULL for soft-deleted books), views `reader_steps` / `reader_book_step_counts` (skip soft-deleted books), grants | `02_rollback.sql` |
| `03_policy_switch.sql` | the behaviour change: draft text only for OWNER/EDITOR/REVIEWER, discoverability for lists, F1, F2, F3 | `03_rollback.sql` |
| `04_helper_guard.sql` | permission helpers answer only about the caller. **Treat as part of the 03 rollout**: without it any caller can ask whether user X owns/edits book Y through the API, if the API exposes the helpers (already true today for `can_edit_book`/`can_delete_book` if exposed; 01 would add `can_manage_members`). Alternative to 04: move the helpers to a private schema | `04_rollback.sql` |
| `05_optional_reset_my_book_progress.sql` | optional, independent: exact "reset my progress" | `05_rollback.sql` |
Apply 01 -> 02 -> (deploy the website with the reader patch) -> 03 + 04 together [-> 05]. Never apply 03 before the website with the reader patch is live: the old reader selects `steps` directly and every non-editor would see empty books. Roll back in reverse. Each file is one transaction. `check-04-drift.mjs` fails if 04 stops matching 01/02.

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
| Attachments | rows follow the step rule (draft viewers, or the step is reader-visible for a discoverable book). File bytes: bucket `book-assets` is reported private; whether every object endpoint enforces that, and how the website's `getPublicUrl` links in Markdown behave, is UNVERIFIED (HANDOFF 5) |

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
