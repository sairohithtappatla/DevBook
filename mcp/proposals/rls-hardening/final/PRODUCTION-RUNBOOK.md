# Production go-live runbook: RLS hardening + website patches (v2 -> main)

Status: **NOT EXECUTED.** Every step below needs the owner's explicit approval at the time it is run. Written 2026-10-20.
Scope: SQL `01, 02, 02b, 07, 03, 04` (+ optional `05`, `06`) on production (`6ktij8hk`) and the website with both patches.
Out of scope (separate, later): the MCP function, storage (signed URLs / download function), OAuth.

## 0. Prerequisites (all must be true before the day)
| # | Check | Evidence needed |
|---|---|---|
| P1 | The CURRENT files (incl. `02b`, `06`) passed on the TEST project: apply, checks, reverse rollback with 0 catalog differences, re-apply | redacted TEST outputs |
| P2 | Website with both patches verified against the TEST project in a browser (reader, editor, visibility menu, progress, counts) | screenshots / notes |
| P3 | Release branch prepared from `v2` with both patches applied to `src/` (`git apply`, add `--ignore-whitespace` on a CRLF checkout; never GNU `patch`); `npm run lint`, `npm run build` and the reader tests pass | CI/local output. Committing and pushing needs "commit and push" from the owner |
| P4 | A separate folder linked to PRODUCTION, used only for this runbook (never the TEST folder, never the repo folder) | `npx @insforge/cli` shows project `devbook` / `6ktij8hk` |
| P5 | A production-mode guard: the existing `preflight/guard.mjs` deliberately REFUSES `6ktij8hk`. Add a production mode that requires the app key AND a typed confirmation before any write (separate approval) | guard output |
| P6 | Smoke-test identities on production: the owner's own account plus at least one throwaway non-member account (and ideally an EDITOR and a VIEWER on a throwaway book) | list of accounts (no passwords in files or chat) |
| P7 | Window agreed (low traffic), rollback owner present, this runbook printed or open | - |

## 1. Read-only preflight on production (no writes)
1. In the production folder: `select version()` -> expect 15.x. Record it.
2. Run the catalog queries `preflight/readonly-queries.sql` Q1-Q11 read-only (Q11 = content shape counts, no text). Save outputs on your disk only (never committed, never pasted).
3. **Drift check (stop on any difference):** compare live `pg_get_functiondef` of `can_read_book`, `can_manage_members`, `can_edit_book`, `can_delete_book`, `get_book_id_for_step`, `get_book_id_for_phase`, `trigger_add_book_owner` and the policies of `books, phases, steps, attachments, book_members, book_access, book_revisions` with the texts in `01_rollback.sql`, `03_rollback.sql`, `04_rollback.sql` and `test-project/00_baseline_schema.sql`. If production differs, the rollback files would overwrite the newer definition: regenerate them from the live text and re-test on TEST first.
4. Check the reconstructed tables (`book_access, user_followers, step_progress, book_progress, book_revisions`) and `book_invitations` (not reproduced anywhere) against production DDL; review any policy on `book_invitations`.
5. From Q11, compute how many steps `02b` will freeze (rows with `published_type` not `string` and either `step_status = Published`, or no status in a PUBLISHED book with `markdown_type = string`). Note the number: step 3.3 must report the same.
**Go/no-go 1:** version 15.x, no drift (or rollback texts regenerated and re-tested), numbers recorded.

## 2. Backup
1. Platform backup/snapshot of the database (InsForge CLI/dashboard; record the exact command and the backup id).
2. Schema export (`db export --no-data` with functions and views) and a DATA export of `books, phases, steps, book_members, attachments` to your disk. `02b` changes step content; this export is the last-resort restore.
3. Keep the outputs of step 1 as the "before" reference.
**Go/no-go 2:** backup id recorded and export files readable.

## 3. Additive database changes (no behaviour change for users)
Apply each file as one transaction, with the same method that worked on the TEST project. Stop at the first error; nothing partial is left because each file is one transaction.
1. `01_access_predicates.sql` -> check: `can_discover_book`, `can_view_drafts` exist; a non-owner member can read `book_members` (no stack-depth error).
2. `02_reader_objects.sql` -> check: `reader_book_tree(<a public book id>, false)` returns the book for an anonymous caller through the API; `reader_step_json` is not callable by anon.
3. `02b_legacy_step_freeze.sql` -> check: the NOTICE count equals the number from step 1.5; the anonymous `reader_book_tree` of 2-3 books is identical to before (save before/after).
3b. `07_strict_reader_rule.sql` -> it aborts by itself if 02b missed a step; check: the same anonymous trees are still identical.
4. Optional now or later: `06_pin_trigger_search_path.sql` -> check: creating a book still creates its OWNER row.
The OLD website keeps working after this step (it still reads the base tables, which 01/02/02b do not restrict).

## 4. Deploy the website with both patches
1. Deploy the release branch (P3) to production hosting. Do a preview deployment against production first if possible.
2. Check as anonymous, as a non-member and as the owner: home lists, a book page, step counts, My Books, Progress, the editor.
**Go/no-go 3:** the patched site works on the not-yet-restricted database.

## 5. Behaviour change: 03 and 04 together, in one sitting
1. Apply `03_policy_switch.sql`, then immediately `04_helper_guard.sql`. Never 03 without the patched site live (non-editors would see empty books).
2. Expect: browser tabs still running the OLD JavaScript show empty books until reloaded; this is why the window is low-traffic.
3. Optional: `05_optional_reset_my_book_progress.sql` (not called by the patched site yet).

## 6. Smoke tests (immediately after step 5)
| Actor | Must see | Must NOT see |
|---|---|---|
| anonymous | published books and published text; an UNLISTED book by its link | draft text, DRAFT/ARCHIVED/UNLISTED books in lists, `steps` rows, `book_members` rows |
| logged-in non-member | same as anonymous | same; `can_edit_book(<book>, <owner id>)` through the API returns false |
| VIEWER of a book | published text of that book | its drafts |
| EDITOR | draft preview in the reader, edit and autosave in the editor | - |
| OWNER | everything of their book; visibility menu for all levels incl. a forced failure rolling back; creating a book; progress mark + reset | someone else's drafts |
Also: creating a book with someone else's `created_by` through the API is refused; edits to a legacy step stay drafts.
**Go/no-go 4:** every row passes. Any failure -> section 8.

## 7. Watch (30-60 minutes) and finish
- Watch API error rates (4xx/5xx on `rpc/reader_book_tree`, `records/reader_book_step_counts`, `steps`) and user reports.
- Finish: the owner merges `v2` into `main` (and tags the release); update `context/progress-tracker.md`; keep the backup and the before/after outputs.

## 8. Rollback (decide fast; each file is one transaction)
| Situation | Do, in this order |
|---|---|
| Problem after step 5 | `04_rollback.sql` -> `03_rollback.sql`. The patched site keeps working on the old policies (the reader objects still exist). Do NOT roll the website back before 03 is rolled back. |
| The patched website itself is broken | first the row above, then redeploy the previous website build |
| Problem with the frozen legacy steps | `02b_rollback.sql` (restores the original keys where `publishedMarkdown` is still the frozen value; afterwards edits of those steps go live immediately again) |
| Full rollback | `05_rollback` (if applied) -> `06_rollback` (if applied) -> `04_rollback` -> `03_rollback` -> previous website build -> `07_rollback` -> `02b_rollback` -> `02_rollback` -> `01_rollback`. `01_rollback` fails safely while 02/03 objects still exist. |
| Data damage | platform restore from the backup of step 2 (last resort; loses changes made after the backup) |
After any rollback: re-run Q1-Q11 and the drift comparison and confirm they match the "before" outputs.
