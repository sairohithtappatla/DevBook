# Round 4: soft-delete, progress reset, patch order, grants, real-backend checklist (local proposals, NOT applied)

Nothing here touches `src/`, a branch, InsForge or production. Results come from a disposable native PostgreSQL 18.4, a stubbed InsForge client and `git apply` on throwaway copies. **They do not prove compatibility with real InsForge.** Labels: **[local]** verified here, **[A]** unverified assumption.

## 1. Soft-deleted books
**Existing behaviour.** `DBService.getBook`, `getBooks`, `getBookBySlug` all filter `deleted_at IS NULL`, for everyone including the owner; nothing in `src/` sets `deleted_at` or has a trash screen. In the SQL, `can_read_book` returns TRUE for the OWNER of a soft-deleted book (a restore-style rule that exists today). `reader_book_tree` trusts `can_read_book`, so the owner would receive a book the app hides. [local]: for every actor the tree equals NULL where `getBook` is empty EXCEPT owner x soft-deleted (4 cases: 2 books x 2 modes). Editors/reviewers/viewers/anon already get NULL.
**Smallest safe change: `02-tree-hide-soft-deleted.patch`** (6 lines inside `reader_book_tree`): after loading the book, `IF bk.deleted_at IS NOT NULL THEN RETURN NULL`. Nothing else changes: `can_read_book` keeps its owner rule, base-table policies, views and counts are untouched.
**Tests [local].** `sandbox/softdelete.mjs`: invariant "getBook empty => tree NULL" for 6 actors x 3 books x 2 modes. Without the patch `EXPECT=unpatched` PASS (exactly the 4 owner cases); with it `EXPECT=patched` PASS and the live published book stays visible to everyone; running the patched expectation on the unpatched SQL FAILS (the test detects the gap). Frontend: `frontend-tests/softdelete.test.ts`: with recorded output, anon/stranger/editor/owner get `null` and the real `BookReaderPage` shows "Book not found"; without the patch only the owner receives the book (documented).
**Rollback implications.** The patch is a body change of one function (`CREATE OR REPLACE` keeps owner and ACL). If `02` is not applied yet, simply do not apply the patch (it is order-independent with `02-trim-grants.patch`: identical file either order [local]). If the patched `02` was already applied, `02-tree-hide-soft-deleted.revert.sql` restores today's body (tested: afterwards the unpatched expectation holds). `02_rollback.sql` drops the function whichever body it has, so the rollback order is unchanged. Applying the patch changes one expectation of the existing matrix: the oracle in `sandbox/run.mjs` assumes "owner reads the tree of a soft-deleted book"; with the patch the run reports exactly 2 mismatches (`owner tree:b7` in both modes) and nothing else. Update that oracle line when the patch is adopted (not edited here).
Not changed on purpose: the views/counts still include an owner's soft-deleted books (invisible in the UI because the books list excludes them).

## 2. Progress reset: exactly which rows can remain
Existing `resetBookProgress`: select the book's phases, then steps (both under RLS), delete `step_progress` for those step ids, delete the `book_progress` row. The reader-tree version replaces the phase/step selects with ids from `reader_book_tree(book, true)`.
[local] results (viewer V; the table DDL/FKs in the sandbox are reconstructed [A]):
| Run | step_progress left behind | book_progress left behind |
|---|---|---|
| A. today's client + today's policies, reset PUB | none for PUB | none for PUB |
| B. today's client + new policies | **all** PUB rows (a non-draft reader's `steps` select is empty) -> the old client must not be kept after step 03 | PUB row removed |
| C. tree-ids client + new policies, reset PUB | rows of steps that are not visible to V: **unpublished-since** (no `publishedMarkdown`, status Draft) and **never-visible draft steps** (possible today only through the draft leak). They stay visible to V through the policy (book still readable) but cannot be tied to a book by the client | PUB removed |
| D. tree-ids client, books V can no longer read (access lost, ARCHIVED after progress) | all their rows: RLS (`modify_step_progress`, `modify_book_progress` require `can_read_book`) makes them invisible AND undeletable for V, with or without ids | stay |
| E. prototype server function (below) | none | none |
**What a client can and cannot do.** Client-side: only ids from the tree (done); no query can map the leftover rows to a book because `steps`/`phases` are hidden from non-draft readers and RLS blocks rows of unreadable books. A client cannot fix cases C (partially) or D. Server-side is required to be exact.
**Recommendation (not implemented as a migration).** A `SECURITY DEFINER` function `reset_my_book_progress(target_book_id uuid) returns integer` with `search_path = public, pg_temp`, no user-id parameter (`auth.uid()` only, raises when NULL), deleting only the caller's `step_progress` joined through `steps/phases` and the caller's `book_progress` row, EXECUTE revoked from PUBLIC and granted to `authenticated` only. Tested as a prototype inside the throwaway DB only (`sandbox/progress-reset.mjs`): deleted 3/1/1 rows for PUB/LOST/ARCH, nothing remained, anon denied. It also lets people clear progress for books they lost access to (arguably desirable) and touches only their own rows. Until it exists, the tree-ids client is the best client-side behaviour; the leftovers are the caller's own invisible rows and are harmless to other users. [A]: FK `ON DELETE CASCADE` from `step_progress.step_id` (rows disappear when a step is deleted) and the exact production DDL.

## 3. Reader patches: verified application order (`verify-patch-order.sh`, `git apply` on throwaway copies) [local]
| You want | Do |
|---|---|
| reader integration only | `git apply frontend-reader-integration.patch` |
| access-level fix only | `git apply frontend-access-level.patch` |
| **both** | `git apply frontend-access-level.patch` **then** `git apply frontend-reader-integration.after-access-level.patch` |
Everything else is refused atomically by `git apply` (no partial application): plain reader after access-level, stacked reader without access-level, plain then stacked, any patch applied twice, and access-level after the plain reader. So neither can silently overwrite the other. Warning: GNU `patch` with fuzz DID accept the plain reader patch after access-level (hunk applied "with fuzz 2"), so **use `git apply` only**. The combined result contains both features (checked by content), `tsc` and the 17 data + 4 page tests passed on the stacked variant (previous round); on the plain-reader tree this round: tsc, 17 + 4 + 5 tests, oxlint 36 warnings = unchanged baseline. The soft-delete test was not re-run on the stacked variant. Browser-level verification is still required.

## 4. Grant trim: exact resulting grants [local, `sandbox/grants-report.mjs`]
Effective EXECUTE (PUBLIC / anon / authenticated), default PostgreSQL privileges:
| Function | Original 02 | With `02-trim-grants.patch` |
|---|---|---|
| `can_discover_book`, `can_view_drafts` (from 01) | Y / Y / Y | unchanged |
| `reader_book_tree` | Y / Y / Y | unchanged (API entry point) |
| `step_is_reader_visible` | Y / Y / Y | unchanged (select_attachments policy runs as caller) |
| `reader_markdown` | Y / Y / Y | **unchanged: must stay** (a function used inside a view is checked against the CALLING user; reproduced: revoking it gives "permission denied for function reader_markdown" for anon on `reader_steps`) |
| `reader_step_json` | Y / Y / Y | **n / n / n**: explicit grant removed and `REVOKE ... FROM PUBLIC`; only reader_book_tree (SECURITY DEFINER) calls it |
With restrictive default privileges (new functions not executable by PUBLIC) the same ACLs hold except PUBLIC=n everywhere, and the explicit grants keep every other function working (lifecycle scenario B PASS). Honest limit: in default PostgreSQL every other new function remains executable by PUBLIC, like the existing helpers; the trim only closes `reader_step_json`. Revoking the others from PUBLIC would also cut non-anon/authenticated roles InsForge may use, so it was not done.
**Rollback.** `02_rollback.sql` drops the functions, ACL included; after 04/03/02/01 rollbacks no new function remains and every pre-existing function's ACL equals the original [local]. The `REVOKE` touches no pre-existing function. Re-running 02 (with or without the trim) changes no ACL. The trim therefore needs no rollback script. `lifecycle.mjs`: original 02 FAILS exactly the "reader_step_json is NOT callable" checks, trimmed PASSES; the full matrix on the trimmed copy is 0 mismatches / 0 draft hits, rollback identical.
Side finding (pre-existing, unchanged): `can_manage_members` and `get_book_id_for_step` become SECURITY DEFINER (01/03), by design.

## 5. Real-backend checklist for a SEPARATE InsForge test project (nothing below has been run)
Safeguards: separate folder, `preflight/guard.mjs` before every CLI call, scripts refuse the production app key. The scripts read credentials from environment variables only.
**Request shape (from SDK source).** `client.database.rpc('reader_book_tree', { target_book_id, include_drafts })` -> `POST {base}/api/database/rpc/reader_book_tree` with JSON body `{"target_book_id":"<uuid>","include_drafts":true|false}` (`rpc/<fn>` is rewritten to `/api/database/rpc/<fn>`; postgrest-js uses POST unless `{get:true}`; a STABLE function also allows GET [A]).
**Authentication context.** Header `Authorization: Bearer <user access token>` when signed in, else `Bearer <anon key>` (SDK `getHeaders`). [A] that InsForge maps the anon key to database role `anon` and a user token to `authenticated` with `auth.uid()` = the token subject (everything relies on it; step 04 relies on `current_setting('role')`).
**Expected response [A]:** HTTP 200 with the function's jsonb as the body: the `{ "book": {...}, "phases": [...] }` document, or `null` when the caller may not read the book or it does not exist; the SDK exposes it as `data`. Not-callable/unknown function: an error object (PostgREST would use 404 `PGRST202` / 42501); the exact InsForge error shape is unknown [A].
**Seed (same titles as the sandbox fixture so `rpc-expectations.mjs` applies):** users owner, editor, reviewer, viewer, stranger (real sign-ups; email verification requirements unknown [A]); members of PUB: editor/EDITOR, reviewer/REVIEWER, viewer/VIEWER (added by the owner; owner row comes from the trigger).
- PUB (PUBLISHED, PUBLIC): Phase A: "Published step" {status Published, markdown "DRAFT-EDIT-1 newer unpublished text", publishedMarkdown "PUB-1 published text", slug published-step} with attachment row pub.pdf; "Draft-only step" {status Draft, markdown "DRAFT_SECRET only an editor may read"} with attachment row draft.pdf; Phase B: "Legacy step" {markdown "LEGACY text of a step without status"}; Phase C: no steps; Phase D "Phase D (draft only)": "Draft in phase D" {status Draft, markdown "DRAFT_SECRET phase D"}.
- EMPTY (PUBLISHED, PUBLIC): one phase "Only phase", no steps. UNL (PUBLISHED, UNLISTED): phase "Unlisted phase", step "Unlisted step" {Published}. DRAFTBOOK (DRAFT, PUBLIC): phase "Draft phase", step "Step of a draft book" {Published}, owner only. DELETED (PUBLISHED, PUBLIC, `deleted_at` set; optional; whether the API lets an owner set it is unknown [A]): phase "Deleted phase", step "Deleted step".
**Run:**
1. `node mcp/proposals/rls-hardening/preflight/guard.mjs` (with `EXPECTED_TEST_APPKEY`) and the catalog queries Q1-Q9 (`TEST-PLAN.md`); expect `reader_step_json` anon/auth EXECUTE false, `reader_markdown`/`reader_book_tree`/`step_is_reader_visible` true.
2. Apply 01, 02 (+ trim, + soft-delete patch if adopted), 03, 04 one at a time from the test folder (never from the production folder).
3. `CONFIRM_TEST_PROJECT=yes TEST_URL=... TEST_ANON_KEY=... BOOKS_JSON='{...}' ACTOR_<NAME>_EMAIL/PASSWORD=... [SOFT_DELETE_PATCH=no] node rpc-contract-check.mjs`
| Check | Expected |
|---|---|
| anon, stranger | PUB: Phases A (Published step), B (Legacy step) only, text "PUB-1 published text", attachment pub.pdf only, with `include_drafts` true or false; EMPTY: `phases: []`; UNL: the tree; DRAFTBOOK: `null`; DELETED: `null` |
| viewer | as stranger for PUB even with `include_drafts=true`; DRAFTBOOK/DELETED `null` |
| reviewer, editor, owner, `include_drafts=false` | same as stranger |
| reviewer, editor, owner, `include_drafts=true` | PUB also has "Draft-only step" (text with DRAFT_SECRET, attachment draft.pdf), "Phase D", and Published step shows `markdown` = draft text, `publishedMarkdown` = "PUB-1 published text" |
| owner | DRAFTBOOK tree; DELETED `null` with the soft-delete patch (owner gets the tree without it: run with `SOFT_DELETE_PATCH=no` to document) |
| any actor, random uuid | `null`, indistinguishable from an inaccessible book |
| any actor, `reader_step_json` | error (not callable); `reader_markdown` | callable |
| Unverified, observe and record | HTTP status/body for null results; error shape for the missing function; whether GET works; whether anon key is accepted for RPC; whether sign-in works without email verification; JSON key order/number types (`position`, `file_size`); response time for a 100+ step book |
4. Keep the redacted outputs; any `BAD` line blocks step 03 and the frontend rollout.
Local proof that the checker's expectations are right: `rpc-expectations.test.mjs` runs them over the 48 recorded sandbox trees (all match) plus tampered responses (all flagged).

## 6. Tests run (all local) and results
| Check | Result |
|---|---|
| `sandbox/softdelete.mjs` (unpatched/patched/patched-on-unpatched/revert) | PASS / PASS / FAIL as designed / PASS |
| `sandbox/run.mjs` matrix on trimmed + soft-delete 02, WITH04 | baseline 33/45; new: 2 mismatches = the two intended `owner tree:b7` changes, 0 draft hits; rollback identical |
| `sandbox/lifecycle.mjs` on trimmed + soft-delete 02 | PASS (default and restrictive privileges) |
| `sandbox/grants-report.mjs` (original, trimmed, restrictive) | table above; rollback leaves nothing; no ACL drift |
| `sandbox/progress-reset.mjs` | PASS (A-E as tabulated) |
| `frontend-tests/softdelete.test.ts` | 5 passed |
| Reader suites on the plain reader patch (`tsc`, 17 data tests, 4 page tests, oxlint 36 = baseline) | pass |
| `rpc-expectations.test.mjs` | 4 passed |
| `verify-patch-order.sh` | PASS |
| `pg` parse of all SQL (incl. the revert) | OK |
| `rpc-contract-check.mjs` | syntax OK; refuses production URL, missing env, missing books map; never run against a backend |

## 7. Unresolved
Real RPC envelope/status codes, role mapping and `auth.uid()` (all [A]); function owner bypassing RLS (A1); production DDL of progress tables; whether the app should offer owners a trash/restore view (then the "hide for everyone" rule needs revisiting); whether to adopt `reset_my_book_progress`; PUBLIC execute on the other helpers; `run.mjs` oracle update if the soft-delete patch is adopted; browser testing; storage behaviour (see earlier reports).
