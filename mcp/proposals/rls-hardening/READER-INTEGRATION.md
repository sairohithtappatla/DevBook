# Round 3: reader integration patch and grant trim (local proposals, NOT applied)

Nothing here touches `src/`, a branch, InsForge or production. All results are from a disposable native PostgreSQL 18.4 and a stubbed InsForge client. **None of it proves real InsForge compatibility.**

## 1. Files
New (nothing existing was overwritten or edited this round):
| File | Purpose |
|---|---|
| `frontend-reader-integration.patch` | reader integration against the CURRENT tree (applies cleanly; 7 files incl. new `src/lib/reader-tree.ts`) |
| `frontend-reader-integration.after-access-level.patch` | the same change generated on top of `frontend-access-level.patch` (the two patches touch adjacent lines of `db.ts` and `BookReaderPage.tsx`, so they cannot both apply in either order without this variant). Use ONE of the two reader patches |
| `02-trim-grants.patch` | `patch -p1` against `02_reader_objects.sql` (dry-run clean) |
| `sandbox/lifecycle.mjs` | privilege + lifecycle test, two default-privilege scenarios, `SQL_DIR=` to test a patched copy |
| `frontend-tests/generate-fixtures.mjs`, `fixtures/reader-fixtures.json` | records the REAL `reader_book_tree`, view and RLS outputs for 6 actors x 4 books |
| `frontend-tests/stub-insforge.ts`, `legacy-structure.ts`, `reader-integration.test.ts`, `reader-page.test.tsx`, `build-reader.mjs` | 17 data-layer tests and 4 page-render tests |
Existing files are unchanged: `02_reader_objects.sql`, all rollbacks, `frontend-access-level.patch`, `TEST-PLAN.md`, `FINAL-REVIEW.md`.

## 2. Reader data contract (read from `02_reader_objects.sql`, confirmed against recorded output)
`reader_book_tree(target_book_id uuid, include_drafts boolean DEFAULT false) -> jsonb`
- `null`: book missing, caller may not read it (draft/archived for non-members, private, etc.). Indistinguishable from "does not exist".
- `{ book, phases }`; `book` = `id,title,slug,description,cover_url,publication_status,access_level,estimated_read_time,difficulty,tags,created_by,created_at,updated_at,creator{id,name,avatar_url,bio}|null`.
- `phases[]` = `{id,title,position,steps[]}`, ordered by position, **only phases with at least one visible step**.
- `steps[]` = `{id,title,position,slug,description,difficulty,estimatedTime,visibility,status,markdown,publishedMarkdown,attachments[]}`; the metadata fields and `publishedMarkdown` can be JSON null; `attachments[]` = `{id,file_name,storage_path,file_type,file_size}`.
- non-draft mode (also for any caller who is not OWNER/EDITOR/REVIEWER, even with `include_drafts=true`): published steps only, `status:"Published"`, `markdown == publishedMarkdown`.
- draft mode (OWNER/EDITOR/REVIEWER): also unpublished steps; `markdown` is the current (draft) text, `publishedMarkdown` the published text or null.
`reader_book_step_counts(book_id, step_count)`: published, discoverable steps only; books with zero rows are absent.

## 3. Mapping to the current UI
| UI need | Before | Now |
|---|---|---|
| Reader page book + creator | `useBook` (books + users embed) + `useBookStructure(…, true)` (phases, steps) | one `useReaderBook` -> `reader_book_tree(id, include_drafts=true)`; `treeToBook` / `treeToStructure` produce the same `DBBook` and `getBookStructure` objects (key `["book-structure", id, "reader-tree"]`, `staleTime 0`) |
| Step markdown | published text if present else current | identical rule, applied to the function output |
| Missing metadata defaults | `""`, `"Draft"`, `"Beginner"`, `10`, `"Public"` | same defaults |
| Reader route "can edit" | `useBook` | `tree.book.created_by` from the shared query |
| Step counts (Home, Featured, Landing, Profile) | `phases -> steps(id)` embed | `reader_book_step_counts` (published only) |
| Step counts (My Books, Progress) | same embed (drafts counted) | `includeDrafts`: max(view, embed): drafts counted for owner/editor/reviewer, view for everyone else |
| Reset progress | `phases` then `steps` selects, delete by ids | ids from `reader_book_tree(…, true)` (all steps for draft viewers, published for others), then the same deletes |
| Attachments | `attachments: []` in the reader | carried in the structure, still not rendered (UI unchanged) |
| Malformed response | n/a | `parseReaderTree` throws instead of rendering a wrong book |

## 4. Tests run, with results (all local)
| Check | Result |
|---|---|
| `generate-fixtures.mjs` against native PG 18.4 with `01`-`04` and the trimmed `02` | wrote fixtures (6 actors, 4 books: public with empty phase, draft-only phase, legacy step and attachments; empty; unlisted; draft book) |
| `reader-integration.test.ts` (real `db.ts`, `reader-tree.ts`) | **17 passed, 0 failed**: public reader, owner/editor/reviewer with drafts, viewer/stranger/anon never get drafts even with `include_drafts=true`, null for inaccessible/random ids, unlisted by id, empty book, field parity with a verbatim copy of the old `getBookStructure`, defaults, malformed responses, counts (reader / includeDrafts / empty input / error), reset ids (reader, editor, empty, inaccessible, error ordering) |
| `reader-page.test.tsx` (real `BookReaderPage`, server render, cache seeded from fixtures) | **4 passed**: anon sees published text and no draft text or draft step titles; editor sees draft steps; empty-book state; "Book not found" for a null tree |
| `tsc -b`, `vite build`, `oxlint` (repo config) | tsc clean; build OK; 36 warnings before and after (no new ones); same results on the stacked variant |
| `git apply --check` | reader patch on current tree OK; stacked patch after the access-level patch OK; plain reader patch after the access-level patch FAILS (adjacent hunks), hence the stacked variant |
| Grant trim: `sandbox/lifecycle.mjs` | on the unpatched `02`: 6 expected failures (reader_step_json callable by anon/authenticated). On the patched copy: **PASS** in both default and restrictive default-privilege scenarios (book/phase/step/attachment lifecycle, trees, views, attachments policy) |
| Grant trim: full `sandbox/run.mjs` matrix (WITH04=1) on the patched copy | baseline 33 mismatches / 45 draft hits; after: **0 / 0**; rollback identical (behaviour, function bodies, policies) |

## 5. Grant removal: result differs from the premise
Only ONE of the two grants was unnecessary. Postgres checks EXECUTE on functions used inside a view against the CALLING user, not the view owner (documented behaviour; reproduced: with both revoked, `select from reader_steps` as anon fails with `permission denied for function reader_markdown`).
- `reader_step_json`: only called inside the SECURITY DEFINER `reader_book_tree` -> grant removed and `REVOKE ... FROM PUBLIC` added (removal alone changes nothing because new functions are executable by PUBLIC by default). It is now not callable through the API (tested).
- `reader_markdown`: used by both views -> **grant must stay** (comment in the patch says why).
- `02_rollback.sql` needs no change (dropping the functions drops their ACL); verified by the rollback-identical check.
- `TEST-PLAN.md` Q2 expectation to add: `reader_step_json` anon/auth EXECUTE = false; `reader_markdown`, `reader_book_tree`, `step_is_reader_visible` = true.
Real-backend assumption: that InsForge's views run function checks the same way (it is PostgreSQL; unverified on their stack).

## 6. Regressions and unresolved questions
1. **Soft-deleted books.** The tree has no `deleted_at`; for the OWNER of a soft-deleted book `can_read_book` is true, so the reader would open a deleted book that `getBook` (filters `deleted_at is null`) hides. Needs a one-line SQL addition (`'deleted_at', bk.deleted_at` in the tree) plus a mapper check, or an accepted behaviour. Not changed (02 untouched).
2. **Empty phases disappear** in the reader (the function omits phases without a visible step; before, empty phases were listed). Also true in draft-preview mode. The editor still uses the base tables.
3. **Counts for public lists are now published-only** (previously they counted draft steps, which was part of the leak). Owner lists keep draft-inclusive counts through `includeDrafts`.
4. **Reset progress** can only clear step ids the caller can see; progress rows of steps that were later unpublished stay. A server-side `reset_my_book_progress` function would be exact (not written).
5. **`status` / `publishedMarkdown` of legacy steps** differ from the old mapping (function reports `Published` and the text as published for non-draft readers); the reader UI uses neither.
6. **Owners/editors previewing**: the reader requests `include_drafts=true` (as the old reader showed drafts to everyone); the function ignores it for non-draft viewers. If previews should be published-only, flip the argument.
7. **InsForge RPC envelope** (`/api/database/rpc/reader_book_tree` through `postgrest-js`) assumed to return the jsonb value as `data`; `parseReaderTree` fails loudly otherwise. Unverified. Whether the function is exposed at all is test 6 of `TEST-PLAN.md`.
8. Attachment `storage_path` values reach the client but cannot be rendered with a private bucket (no signed-URL code exists); unchanged behaviour.
9. No browser test was run: page tests are server renders; interactions, routing and real network are untested.
10. `reader-leak-fix` client-side filtering becomes redundant but harmless as a second layer.

## 7. How to reproduce (scratch copy, never in the repo)
```
SQL_DIR=<copy of rls-hardening with 02-trim-grants.patch applied (patch -p1)>
PGHOST=127.0.0.1 PGPORT=<p> PGUSER=postgres PG_MODULE=<node_modules with pg> node sandbox/lifecycle.mjs
… node frontend-tests/generate-fixtures.mjs
<scratch copy of the repo + reader patch>: cp -r frontend-tests/* t/ ; node t/build-reader.mjs && node t/out/reader-integration.test.js ; node t/build-reader.mjs reader-page && node t/out-page/reader-page.test.js
```
