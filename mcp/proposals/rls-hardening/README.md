# Proposal: draft-exposure hardening (E1, E2, unlisted links) and two fixes found on the way

**Status: reviewed against your decisions D-a to D-f and tested in a disposable in-memory PostgreSQL. NOT applied to any real backend. Work belongs on `v2`; `v1` stays frozen; `src/`, `main` and production are untouched.**
Labels: **[parser]** syntax checked only, **[sandbox]** executed in a throwaway PostgreSQL 18.6 (PGlite) built from your real schema, **[V]** verified from your live output or code, **[A]** assumption still open.

## 1. Results, reported separately

### Parser results [parser]
All six SQL files (`01`-`03` and their rollbacks) parse with PostgreSQL's own parser, including every PL/pgSQL body. This proves syntax only. A first E1 draft failed this check and was restructured.

### Functional results [sandbox]
`sandbox/run.mjs` builds your schema in memory, creates 7 users and 8 books (PUBLIC, DRAFT, PRIVATE, FOLLOWERS_ONLY, SELECTED_USERS, ARCHIVED, soft-deleted, UNLISTED) with published, draft, legacy and missing-status steps, then checks 8 actors (anon, stranger, follower, selected, viewer, reviewer, editor, owner) against an independent JavaScript implementation of your approved rules. SQL files are applied verbatim from disk.

| Phase | Checks | Mismatches vs approved rules | Draft markers reaching non-draft actors |
|-------|--------|------------------------------|------------------------------------------|
| 1 BASELINE (your original policies) | 128 | **33** | **45** |
| 2 AFTER 01 + 02 + 03 | 272 | **0** | **0** |
| 3 AFTER ROLLBACK (03, 02, 01) | 128 | 33 (identical to phase 1) | 45 (identical) |

Rollback restores the baseline exactly: observed behaviour for every actor, all function bodies, and all policies compare identical.
Baseline problems, as observed: anon/stranger/follower/selected list books, phases and member rows of DRAFT, ARCHIVED and UNLISTED books; non-editors read every step including draft Markdown and `search_vector`; draft-step attachments are visible; strangers/followers/selected see progress rows for books they may not read. Checks cover books, phases, members, book_access, steps, search_vector, attachments, own progress, update rights, the two reader views and the direct-link function for every book with and without drafts.

### What the sandbox does NOT prove
Everything in section 6 (native PostgreSQL 18.4 now also reproduces the PGlite totals 33/0/33; see FINAL-REVIEW.md): InsForge's real roles, `auth.uid()`, grants, object ownership, PostgreSQL version, PostgREST exposure, concurrency, and the five reconstructed tables. Run `exposure-check.mjs` on the test project for the API part.

## 2. How your decisions are implemented

| Decision | Implementation |
|----------|----------------|
| D-a drafts: OWNER, EDITOR, REVIEWER | `can_view_drafts`; `steps` base table and `reader_book_tree(..., include_drafts => true)` both use it. VIEWER and non-members get published text only, from views and from the function |
| D-b archived hidden from non-members | `can_read_book`: members always read; everyone else needs `PUBLISHED`. Archived books also vanish from lists and search (same function) |
| D-c unlisted = link only, discoverability separate from permission | `can_read_book` = permission (UNLISTED readable), `can_discover_book` = permission minus "unlisted for non-members". Every list-capable policy (`books`, `phases`, `book_members`, `book_access`, `book_revisions`, `attachments`) and both views use discoverability. The direct-link path is `reader_book_tree(book_id)` (permission). Members still see their own unlisted books |
| D-d views, no editor rewrite | `reader_steps`, `reader_book_step_counts`, `reader_book_tree`; editor untouched. Section 6 lists what must be verified on a real project |
| D-e test backend | section 7 |
| D-f sandbox | done, section 1 |

## 3. Defects found on the way
1. **`can_manage_members` recursion [sandbox] (production impact [A]).** It is the only access helper that is not `SECURITY DEFINER`, yet it reads `book_members` and is called by a policy on `book_members` (`modify_members`). In the original schema the viewer, reviewer and editor get **no** `book_members` rows (the session fails), while the owner works. Production has only OWNER rows (5), so it is probably dormant today and would bite once collaborators exist. The fix (same body, `SECURITY DEFINER`) is in `01`. To check on the test project: sign in as an editor and open the collaborators panel, or run `exposure-check.mjs` as that user and look for an error on `book_members`.
2. **`FOLLOWERS` vs `FOLLOWERS_ONLY` [V]**: traced to `BookEditorPage.tsx:776` (write fails), `:1094,1103` and `MyBooksPage.tsx:57-61` (wrong display; real followers-only, selected-users and unlisted books are labelled "Public") and the type in `db.ts:36`. Fix: `frontend-access-level.patch` (6 lines, 3 files, `tsc` clean).
3. **Permission helpers callable through the API [A]**: `can_edit_book(book, user)`, `can_read_book`, `can_manage_members` take a user id parameter and live in the public schema, so PostgREST probably exposes them as RPC: anyone could ask whether a given user is a member/owner of a given book. Pre-existing; `exposure-check.mjs` reports whether the call works. Not changed here (moving helpers into a private schema is a separate decision).
4. **Not covered**: storage buckets and file URLs (files may be fetchable by URL regardless of these policies; policies not examined); `users` policy exposes authors of any `PUBLIC` book regardless of `publication_status`; `book_members` rows (user ids and roles) of discoverable books remain readable.

## 4. Files

| File | Purpose |
|------|---------|
| `01_access_predicates.sql` / `01_rollback.sql` | `can_read_book` (changed), `can_discover_book`, `can_view_drafts` (new), `can_manage_members` (SECURITY DEFINER fix) |
| `02_reader_objects.sql` / `02_rollback.sql` | additive: `reader_markdown`, `step_is_reader_visible`, `reader_step_json`, `reader_book_tree`, views `reader_steps`, `reader_book_step_counts`, grants. Changes no existing behaviour |
| `03_policy_switch.sql` / `03_rollback.sql` | the behaviour change: `get_book_id_for_step` to SECURITY DEFINER; seven policies switched |
| `frontend-access-level.patch` | the FOLLOWERS_ONLY / SELECTED_USERS fix |
| `sandbox/schema.sql`, `sandbox/run.mjs` | the disposable test (run instructions in `run.mjs`) |
| `exposure-check.mjs` | read-only API exposure check for the TEST project only |

Rollback order: `03_rollback`, `02_rollback`, `01_rollback`. Each is transactional and restores your live definitions as read on 2026-10-18.

## 5. Frontend changes required before step 03 goes live (reader only, no editor rewrite)
1. The reader route calls `reader_book_tree(book_id)` once instead of `getBook` + `getBookStructure(reader)` + per-step attachments: it returns the book, creator, visible phases/steps and attachments. Pass `include_drafts: true` only for an owner/editor/reviewer preview.
2. `getStepCounts` reads `reader_book_step_counts` (the `phases -> steps(id)` embed becomes empty under the new policy).
3. `resetBookProgress` takes the step ids from the tree function (or `reader_steps`).
4. Apply `frontend-access-level.patch` and keep the TypeScript reader rule (`src/lib/reader-visibility.ts`) as a second layer.
Discovery surfaces (Home, Featured, Profile, search) already read `books` through the base table, so unlisted and archived books drop out of them by policy.

## 6. Assumptions that could invalidate the sandbox result
| # | Assumption | Why it matters | How it is settled |
|---|------------|----------------|-------------------|
| A1 | Functions and views are owned by a role that bypasses RLS (sandbox owner is a superuser; no `FORCE` was seen in the export) | the reader views and every SECURITY DEFINER helper rely on it | test project: `exposure-check.mjs` returns rows from `reader_steps` and `reader_book_tree` |
| A2 | `auth.uid()` reads the JWT subject and is NULL for anon (sandbox uses its own stand-in) | all policies | test project, signed-in vs anon runs |
| A3 | Roles `anon` and `authenticated` exist and PostgREST maps requests to them; both hold table privileges (sandbox granted ALL) | RLS is then the only barrier. If real grants are narrower, results are stricter, not looser | test project |
| A4 | Reconstructed tables `book_access`, `user_followers`, `step_progress`, `book_progress`, `book_revisions` have extra columns/triggers the sandbox lacks | could break fixtures or add behaviour | export their real DDL (read-only) before the test project is seeded |
| A5 | Enum values of `book_difficulty` and `step_type` beyond those used | fixtures only | export |
| A6 | PostgreSQL version (sandbox 18.6) | syntax and planner behaviour; `security_invoker` option deliberately not used | check version on the test project |
| A7 | PostgREST: exposure of views and RPC, schema cache reload after `NOTIFY pgrst`, JWT claim handling | what the public API actually returns | `exposure-check.mjs` |
| A8 | One session per actor, no concurrency | locking and race behaviour untested | out of scope for RLS correctness |
| A9 | PGlite limitation: its WASM build leaks Postgres's error stack, so each actor/phase runs in a fresh database | none for correctness; explains the runtime (~2 min) | n/a |

## 7. Test project (D-e: separate cloud project preferred)
- Use a separate folder, e.g. `D:\Project\devbook-rls-test`, never the production-linked `D:\Project\devbook`. Before **any** write command run `npx @insforge/cli current` and confirm it does not show `6ktij8hk`.
- Create the project (you run it; plan limits and cost for a second project are **unverified**): `npx @insforge/cli create --name devbook-rls-test --org-id <your org id> --region ap-southeast`, then `link` that folder to it. If a second project is not available on your plan, use `npx @insforge/cli local start` (Docker) only after confirming it reproduces the same PostgreSQL and PostgREST behaviour.
- Schema parity first (read-only on production): export of the remaining tables, enum values of `step_type`, `book_difficulty`, `invitation_status`, and `db migrations list` (if production was built from migrations they can be replayed). The export prints enum columns as `USER-DEFINED`, so the test schema is assembled from it plus the enum values.
- Then apply `01`, `02`, `03` with `db import` **from the test folder**, seed fixtures through the test project's own auth, and run `exposure-check.mjs` once per actor with that project's anon key and test accounts.
- Do not put production credentials, data, or `.env.local` in the test folder.

## 8. Decisions still needed
- **N1** Include the `can_manage_members` fix in step 01 (recommended; otherwise `modify_members` keeps recursing for non-owner members)?
- **N2** Accept that the reader moves to `reader_book_tree` (one RPC call replaces three reader queries)? This is the price of "unlisted = link only" with real enforcement; the alternative is app-level hiding only, which does not stop API enumeration.
- **N3** Leave the permission-helper RPC exposure (defect 3) for a later private-schema change?
- **N4** Do you want storage bucket policies examined next (read-only)?

## 9. Update (native review)
See `FINAL-REVIEW.md` for N1-N4 findings, `04_helper_guard.sql` (optional) and the test plan. N1 on native PG 18.4: error is `stack depth limit exceeded`, data/plan dependent.

New in round 2: `TEST-PLAN.md`, `preflight/`, `04_helper_guard.sql`, `frontend-tests/`, regenerated `frontend-access-level.patch`.
