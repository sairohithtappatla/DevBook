# Round 2 addendum (SQL review, frontend patch, storage, exposure plan)
Still nothing applied, no cloud project, `src/` untouched. Detailed commands and the eight tests: `TEST-PLAN.md`.

## A. Issues found in the actual SQL
| # | Where | Finding | Status |
|---|---|---|---|
| S1 | 01, 02 | The new functions relied on the default PUBLIC EXECUTE. Policies run as the caller, so on a backend whose default privileges revoke it, every policy using `can_discover_book` / `can_view_drafts` fails. Reproduced on native PG 18.4: book insert, phase/step insert, update and the editor's reads all fail with `permission denied for function`. | **Fixed**: explicit `GRANT EXECUTE ... TO anon, authenticated` (role-exists guarded) in 01 and 02. With restrictive defaults + grants everything passes; the rollbacks need no change (dropping the functions drops the grants) |
| S2 | 04 | Guard relies on `current_setting('role')` being `anon`/`authenticated`. If InsForge's API does not set the role, the guard is inert (no breakage, no protection). Trusted/admin connections and an MCP server using an admin connection are unaffected; an MCP server running as the caller passes its own `auth.uid()` | open [A], test 6 |
| S3 | 01 | `select_books` keeps `OR created_by = auth.uid()`, so a creator who is no longer a member still sees an unpublished/archived own book. Pre-existing, matches intent of the original, noted not changed | note |
| S4 | 03 | `get_book_id_for_phase` is still an invoker function. It works because phases stay readable (discoverability) for everyone who can_view_drafts, but a future change to the phases policy would silently empty `select_steps` | note |
| S5 | all definers | search_path is `public, pg_temp` (pg_temp last), all cross-references are schema-qualified or unambiguous; exploitable only if `authenticated` can CREATE in `public` | open [A], Q5 |
| S6 | 02 | `reader_book_tree` calls `reader_step_json` twice per step and is PL/pgSQL; fine for the fixture, performance on large books not measured | open, test 4 with a 100+ step book |
| S7 | pre-existing | `select_members` shows member user ids and roles of discoverable books to anon; `select_followers` is `USING (true)`; `users` policy exposes authors of any PUBLIC book; `get_book_id_for_step/phase` return a book id for any step/phase id | unchanged, listed |
| S8 | rollbacks | Verified on native PG: after rolling back (04, 03, 02, 01) behaviour per actor, function bodies and policies equal the baseline. Rollback of 01 fails safely (dependency error) if 02/03 objects still exist | verified |
No authorization bypass or privilege escalation was found in the SQL as written: write policies are unchanged; the new definer functions return booleans or published/permitted data only, take no caller-controlled identity after 04 (`reader_book_tree` never did), and `include_drafts=true` is ANDed with `can_view_drafts`.

Sandbox, native PG 18.4, after the grant edits (`WITH04=1 node sandbox/run.mjs`): baseline 33 mismatches / 45 draft hits; new 0 / 0; rollback identical; adversarial: helper oracle 32-34 hits before 04, 0 after; no draft marker or UNLISTED row reached anon/stranger/follower. Lifecycle (`create book RETURNING`, phase, step, update, attachment, add editor, editor edit, stranger sees nothing, publish, anon reads tree): all steps pass in baseline, 01-03, 01-04 and restrictive-defaults-with-grants.

## B. Frontend patch (kept unapplied; regenerated, applies cleanly to the current tree)
All five values are handled through one new module `src/lib/access-level.ts` (`ACCESS_LEVELS`, `AccessLevel`, `visibilityLabel`, `SELECTABLE_ACCESS_LEVELS`, `readerVisibility`). Changes: `db.ts` type; editor badge and menu show all five values (SELECTED_USERS is displayed and preserved but not selectable because no screen manages its user list); `MyBooksPage` maps and badges via the helper (UNLISTED added, unknown values show "Unknown" instead of silently becoming "Public"/"Followers"); reader `visibility` no longer casts `any`.
Silent-replacement protections: the handler writes `{ access_level }` only (the old call also sent `title: dbBook?.title || ""`, which could blank the title if the book had not loaded); it does nothing when the book is not loaded, a save is in flight, or the value is unchanged; the current level is disabled in the menu; an unknown value is shown as Unknown, never mapped to another level. Optimistic update and rollback remain in `useUpdateBook` (unchanged).
Evidence: `tsc -b` clean, `vite build` OK, no new lint warning classes; `frontend-tests/` runs the REAL `useUpdateBook` against a stubbed `DBService` (React SSR + query client): all five values write only `access_level`, optimistic value appears while pending, failure restores both `["book",id]` and `["books"]` and leaves title and the other book untouched; "FOLLOWERS"/"SELECTED" are rejected as Unknown. Run: copy `src` into a scratch project with dependencies, then `node t/build.mjs && node t/out/rollback.test.js`. Not covered: rendering of the menu in a browser (no UI test harness), which is test 7. The replaced menu code kept existing `emerald` color classes on the check icon (already in the file).

## C. Storage (N4, corrected)
The earlier statement "files are public URLs" was an inference from `getPublicUrl`. What the backend says: `getPublicUrl` only builds `{base}/api/storage/buckets/book-assets/objects/{key}`; it resolves only for a public bucket; bucket public/private is a flag listed by `storage buckets`. Whether `book-assets` is public is therefore UNKNOWN until `storage buckets` (read-only) is read; see TEST-PLAN section 2.

## D. Confirmed / uncertain / next files
Confirmed (sandbox): everything in sections 1-2 above and A. Uncertain: A1 owner bypass, A2/A7 role GUC and proxy exposure, bucket flag, Q5, production N1, performance. Files for the next review: `TEST-PLAN.md`, `preflight/{guard.mjs,run-readonly.mjs,readonly-queries.sql}`, `exposure-check.mjs`, and, once you run them, the redacted outputs of `storage buckets` and of Q1-Q5.

---
# Final review: RLS hardening proposal (v2, NOT applied anywhere)

Scope kept: nothing executed against InsForge, no cloud project, `src/` untouched, no branch change, no commit/push/deploy.
Labels: **[native]** executed on a disposable native PostgreSQL 18.4 (sandbox only), **[V]** verified from your live output or code, **[A]** assumption, **[parser]** syntax only.

## 1. Test evidence (native PostgreSQL 18.4, same harness as before, `PG_MODULE=... node sandbox/run.mjs`)
| Phase | Result |
|---|---|
| Baseline (your policies) | 128 checks, 33 mismatches vs approved rules, 45 draft-marker hits for non-draft actors |
| After 01+02+03 | 272 checks, **0** mismatches, **0** draft hits |
| After 01+02+03+04 (`WITH04=1`) | same: 0 / 0 |
| After rollbacks | baseline restored exactly (behaviour, function bodies, policies) |
The earlier PGlite numbers are reproduced exactly on the real engine, so they are not an in-memory artifact. Run `WITH04=1` for the adversarial section.

## 2. Findings
**N1 `can_manage_members`, confirmed [native], production impact UNCONFIRMED.**
- Real error on PG 18.4: `stack depth limit exceeded` (SQLSTATE 54001), for VIEWER, REVIEWER, EDITOR selecting `book_members`; the owner works.
- Mechanism: `modify_members` (FOR ALL, so it also applies to SELECT) calls `can_manage_members`, which is an *invoker* function that itself selects `book_members`; that inner select re-applies the same policy, which calls the function again. It stops only if the planner reaches an OWNER row first, so it is **data and plan dependent**: with 1 book and 3 member rows it did not fail; with 8 books / 32 rows it fails for every non-owner member.
- Production holds only OWNER rows (5) [V], so it is probably dormant today; it would surface when collaborators exist.
- Fix in 01: same body, `SECURITY DEFINER`, `search_path = public, pg_temp`. Needs the function owner to bypass RLS [A1] and EXECUTE for anon/authenticated (already default). Side effect: as definer it answers for any user id (see N3), so 04 is recommended with it.

**N2 `reader_book_tree` and views [native].** Step counts, progress reset ids, attachments and per-actor visibility match the oracle for all 8 actors x 8 books (include_drafts true/false). Details:
- `reader_book_tree`: SECURITY DEFINER, STABLE, `search_path public,pg_temp`, uses `auth.uid()` only (no user-id parameter, nothing to spoof). Returns NULL when `!can_read_book`, identical for private and nonexistent ids (checked for non-members).
- Fields exposed: book `id,title,slug,description,cover_url,publication_status,access_level,estimated_read_time,difficulty,tags,created_by,created_at,updated_at`; creator `id,name,avatar_url,bio` (bypasses the `users` policy, so a link holder of a followers-only/unlisted book sees its author; email is not selected); phases `id,title,position`; steps `id,title,position,slug,description,difficulty,estimatedTime,visibility,status,markdown,publishedMarkdown`; attachments `id,file_name,storage_path,file_type,file_size` (only of visible steps). Not exposed: `search_vector`, `created_by/updated_by` of steps, `revision`, member lists.
- Views `reader_steps` / `reader_book_step_counts`: owner-rights views [A1], discoverable + reader-visible rows only, content limited to the listed keys, no `search_vector`.
- `reader_step_json` and `reader_markdown` are invoker/immutable and only transform values the caller already passes.
- Behaviour change to accept: link-only (UNLISTED) works through the RPC, not through base tables.

**N3 helper functions [native], pre-existing, API exposure still [A].** With the helpers as in 01-03, an anonymous caller got TRUE for `can_edit_book/can_manage_members/can_delete_book/can_view_drafts(book, <owner id>)` on all books (32 hits for anon, 34 for follower/viewer): a membership/ownership oracle (needs user and book ids). `can_edit_book`/`can_delete_book` are already SECURITY DEFINER in your live backend [V], so the exposure exists today if PostgREST publishes them. EXECUTE cannot simply be revoked: policies run as the caller and need it.
- Minimum safe change (`04_helper_guard.sql`, optional, rollback `04_rollback.sql`): inside 7 helpers, if the Postgres `role` GUC is `anon`/`authenticated` and `req_user_id <> auth.uid()` return FALSE. Policies always pass `auth.uid()`, so nothing changes for them. Result [native]: oracle hits 32/34 -> **0**, functional checks still 0 mismatches, rollback identical. Admin/service connections are unaffected.
- [A] InsForge must set the `role` GUC like PostgREST does; if not, the guard is inert (no harm) and the test project will show it.
- Not covered: `get_book_id_for_step/phase` return a book id for any step/phase id (needs a UUID; low). `select_followers` is `USING (true)`: the follow graph is public (pre-existing). Moving helpers to a private schema remains a later option.

**N4 storage [V from code, nothing executed].** Bucket `book-assets`; objects keyed `${stepId}/${Date.now()}.${ext}`; DB keeps `storage_path`. The editor inserts `getPublicUrl()` links into Markdown and the code never calls `createSignedUrl/download`, so files are served as **public URLs** if the bucket is public (the CLI default). Then neither RLS nor this proposal protects file bytes: a draft step's attachment is fetchable by anyone holding its URL (key contains a step UUID + timestamp, unguessable but not secret). Bucket public/private flag and storage policies are unverified [A]; reader page currently hardcodes `attachments: []`. Decision needed later: keep public (accept) or private bucket + signed URLs.

**Security review of the SQL.**
- All definer functions pin `search_path = public, pg_temp`, `pg_temp` last; table references resolve to existing `public` tables first and `pg_catalog` is implicitly first. Residual risk only if `authenticated` can CREATE in `public` [A]: test `has_schema_privilege('authenticated','public','CREATE')` must be false.
- Ownership: definer bodies and views assume the owner bypasses RLS (superuser/BYPASSRLS/table owner without FORCE) [A1].
- No policy lets a user write on another's behalf: `modify_*` policies unchanged; the new functions only return data or booleans. `include_drafts=true` is ANDed with `can_view_drafts(auth.uid())` [native: 0 draft leaks for anon, stranger, follower, viewer].
- Direct API bypass [native]: base tables, search (`search_vector`), `reader_steps`, counts and the tree never returned draft markers to non-draft actors; the UNLISTED book appeared in no table/view for anon/stranger/follower (only for the member viewer, as designed); it is reachable only via `reader_book_tree(<id>)`. Residual: anyone who learns an unlisted book id reads its published content (intended D-c).
- Default function EXECUTE is PUBLIC; the new functions rely on that for policies. `reader_book_tree` revealing nothing beyond what `can_read_book` allows.

**Frontend patch (kept unapplied).** `git apply --check` is clean on the current tree; 6 changes: `BookEditorPage.tsx` (write value + two comparisons), `MyBooksPage.tsx` (two labels), `db.ts` type; tsc passed earlier. `useUpdateBook` snapshots `["book",id]` and `["books"]` in `onMutate` and restores both in `onError`, so a failed enum write (today's behaviour) rolls back the optimistic state; after the patch the write succeeds. Caveats: only those two caches are optimistic and there is no `onSettled` refetch, so other lists catch up on their next refetch; the editor still offers only public/private/followers, so UNLISTED/SELECTED_USERS books show no selected option and saving overwrites them.

## 3. Unresolved assumptions
A1 definer/view owner bypasses RLS; A2 `auth.uid()` from JWT, NULL for anon; A3 roles/grants; A4/A5 reconstructed tables and enums; A6 PG version on InsForge; A7 PostgREST exposure of RPC/views and the `role` GUC (04); `public` CREATE privilege; storage bucket visibility; whether N1 reproduces on production data.

## 4. Migration order (test project first, then only with your approval)
Apply 01 -> 02 (additive, no behaviour change) -> deploy the frontend that reads `reader_book_tree`/views plus the access-level patch -> 03 (behaviour change) -> 04 (optional). Rollback in reverse: 04_rollback -> 03 -> 02 -> 01.

## 5. Tests that must pass in a separate InsForge project (the exact, updated plan is TEST-PLAN.md section 5)
1. Preconditions: `select version()`; owners/BYPASSRLS of the 7 functions and 2 views; `has_schema_privilege('authenticated','public','CREATE')` false; role GUC visible inside a function via `current_setting('role')`.
2. Replay the 8-actor x 8-book matrix through the real API (sign-up users, real JWTs): 0 mismatches, 0 draft markers for anon/stranger/follower/selected/viewer (`exposure-check.mjs`, `ACTOR_ROLE=reader`); draft viewers (owner/editor/reviewer) do see drafts via `include_drafts=true`.
3. RPC exposure: call each helper with another user's id as anon/authenticated: before 04 report the result; after 04 all FALSE.
4. Unlisted: absent from home, featured, profile, search and every table/view for non-members; `reader_book_tree(id)` works; wrong/private id returns the same NULL.
5. `book_members` as a non-owner member on a multi-book dataset: no `stack depth limit exceeded` after 01 (and the original error reproduced before 01).
6. Reader app: step counts, progress reset, attachments listing, and owner editor (draft edit, publish, revisions) unchanged after 03; optimistic visibility change succeeds with FOLLOWERS_ONLY and rolls back on a forced failure.
7. Storage: bucket public flag, storage policies, can a draft step's file URL be fetched anonymously; behaviour of delete/upload by non-editors.
8. Rollbacks: apply each rollback; compare function bodies, policies and per-actor behaviour with the pre-state.
