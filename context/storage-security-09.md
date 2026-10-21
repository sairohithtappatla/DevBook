# Migration 09 — Attachment Storage Security (revision 2.1), TEST validation

Date: 2026-10-21. Target: InsForge TEST `devbook-rls-test` (project 2a222ddf-…, app key 393cz2pc). Production (`6ktij8hk`) not contacted.
No Git operations. Labels: **[verified now]** observed in this run on TEST · **[reported]** earlier report, not re-run · **[inferred]** from SQL/docs · **[blocked]**.

## 1. Official basis
InsForge's storage guidance (`insforge` skill, `storage/postgres-rls.md`) supports RLS on `storage.objects` through a custom migration
("Managed Storage RLS"), with policies scoped per bucket, the four privileges SELECT/INSERT/UPDATE/DELETE for `authenticated`, and notes:
public buckets bypass RLS on downloads; signed URLs are the answer for conditionally visible files in private buckets.

## 2. What revision 1 actually did on TEST [verified now]
| Item | Revision 1 file | Observed on TEST |
|---|---|---|
| Policies | 4 policies `TO public`, predicate `can_access_attachment_object(bucket, key, …)` | present; roles = all |
| Other buckets | helper returned **TRUE** for any bucket ≠ `book-assets` (reads AND writes) | confirmed in the function body |
| `GRANT ALL ON storage.objects TO authenticated` | requested | authenticated has SELECT/INSERT/UPDATE/DELETE only (no TRUNCATE/REFERENCES/TRIGGER) |
| `GRANT SELECT … TO anon`, `GRANT USAGE ON SCHEMA storage TO anon` | requested | **not in effect**: anon has no privilege and no schema usage |
| Anonymous download of a published attachment | report claimed "PASS (Downloaded)" | **403 `permission denied for schema storage`** with a real object — the claim is refuted |

## 3. Revision 2.1 (applied on TEST as migrations 20261021032832 and 20261021033026)
- Every policy carries `bucket = 'book-assets'`; the helper returns FALSE for any other bucket and for keys whose first segment is not an existing step UUID.
- Writes (INSERT/UPDATE/DELETE): `authenticated` only, caller must be OWNER/EDITOR of the step's book (`can_edit_book`); INSERT also requires `uploaded_by = auth.jwt()->>'sub'`.
- Reads: `authenticated` only — draft viewers (OWNER/EDITOR/REVIEWER), or a signed-in user who may discover the book when the step has published text.
- Privileges: `GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated` (no ALL). Nothing for `anon`.
- Re-runnable (CREATE OR REPLACE, DROP POLICY IF EXISTS, idempotent ENABLE RLS / GRANT). Rollback: `final/09_rollback.sql` with explicit warnings.

### Before / after on TEST [verified now]
| | Before (rev 1) | After (rev 2.1) |
|---|---|---|
| RLS on storage.objects | on | on |
| anon privileges / schema usage | none / no | none / no |
| authenticated privileges | S I U D | S I U D |
| select_book_assets | all roles; `can_access_attachment_object(bucket,key,false)` | `{authenticated}`; `bucket='book-assets' AND …` |
| insert_book_assets | all roles; helper(write) | `{authenticated}`; `bucket='book-assets' AND uploaded_by = sub AND …` |
| update/delete_book_assets | all roles; helper(write) | `{authenticated}`; `bucket='book-assets' AND …` |
| helper, other bucket read/write | TRUE / TRUE | FALSE / FALSE |
| helper, book-assets published (anonymous identity) | true | true (but anon has no table access, see §4) |
| helper, draft step / malformed key / unknown step | false | false |

## 4. Real-object tests [verified now]
Synthetic objects: 2 in `book-assets` (under Fixture Public's published step and its draft-only step), a new PUBLIC bucket and a new PRIVATE bucket with 1 object each. Script: scratch `anon-storage.mjs` (anonymous REST calls with the public anon key, never printed). Run before and after rev 2.1: **identical results**.
| # | Case | Result (both runs) | Expected | Status |
|---|---|---|---|---|
| 1 | anon download, book-assets published-step object | 403 permission denied for schema storage | published attachments for anon were the intent | conflict (see §6) |
| 2 | anon download, draft-step object | 403 | deny | PASS |
| 3 | anon download, PUBLIC bucket | 302 to CDN | public read unchanged | PASS |
| 4 | anon download, PRIVATE bucket | 403 | deny | PASS |
| 5–7 | anon list book-assets / public / private | 403 | deny | PASS |
| 8–10 | anon upload/overwrite book-assets, public, private | 403 STORAGE_PERMISSION_DENIED | deny | PASS |
| 11–12 | anon delete book-assets, public | 403 | deny | PASS |
| 13 | no Authorization header, PUBLIC bucket | 302 to CDN | unchanged | PASS |
Objects unchanged after every write attempt (sizes checked). Cleanup: 2 book-assets objects deleted via the admin storage API (HTTP 200), both probe buckets deleted; `storage.objects` count 0, only `book-assets` remains [verified now].

## 5. Signed-in tests [blocked]
Email verification is required on TEST and InsForge offers no admin endpoint that creates a verified user or issues a session; the fixture users' passwords are not available to the agent. Not tested: owner/editor upload and download, stranger download of a known draft key, stranger upload/overwrite/delete, signed-in access to other buckets, and whether `uploaded_by` is populated before the INSERT check (if not, all uploads would fail — must be checked).
**Unblock (no secrets in chat):** in your own terminal, from `D:\Project\devbook-test`:
```
npx -y @insforge/cli storage create-bucket rv5-public-probe --public
npx -y @insforge/cli storage create-bucket rv5-private-probe --private
echo probe > probe.txt
npx -y @insforge/cli storage upload probe.txt --bucket rv5-public-probe --key rv5/public.txt
npx -y @insforge/cli storage upload probe.txt --bucket rv5-private-probe --key rv5/private.txt
EXPECTED_TEST_APPKEY=393cz2pc OWNER_EMAIL=owner@example.invalid OWNER_PASSWORD=… STRANGER_EMAIL=stranger@example.invalid STRANGER_PASSWORD=… \
  EDITOR_EMAIL=editor@example.invalid EDITOR_PASSWORD=… VIEWER_EMAIL=viewer@example.invalid VIEWER_PASSWORD=… \
  PUBLIC_BUCKET=rv5-public-probe PUBLIC_KEY=rv5/public.txt PRIVATE_BUCKET=rv5-private-probe PRIVATE_KEY=rv5/private.txt \
  node mcp/tools/storage-authz-verify.mjs
npx -y @insforge/cli storage delete-bucket rv5-public-probe
npx -y @insforge/cli storage delete-bucket rv5-private-probe
del probe.txt
```
The script refuses production, never prints credentials or tokens, creates only `rv5-<run>` objects and deletes them.
Alternative (needs your approval): temporarily disable email verification on TEST, create two disposable users, test, delete them (admin `DELETE /api/auth/users`), restore the setting.

## 6. Conflict with the intended behaviour
Anonymous download of published attachments is not achievable with RLS here: a migration (`project_admin`) cannot grant `anon` access to the managed `storage` schema (two attempts, no effect). InsForge's model for conditionally visible files is a private bucket plus signed URLs issued after an access check. Options: (a) accept that logged-out readers cannot download attachments (same as before 09; recommended for the first release), (b) later: a small function that checks `can_access_attachment_object`/reader rules and returns a short-lived signed URL. Making the bucket public is NOT an option (it would expose draft attachments; public downloads bypass RLS).

## 7. Remaining risks
- [blocked] signed-in behaviour (§5), including uploads by editors (the `uploaded_by` check).
- [inferred] On a project where RLS was DISABLED before 09, other private buckets lose their previous "any signed-in user can do anything" access (no policies for them); public-bucket downloads are unaffected (verified on TEST). The website only writes to `book-assets` [verified in code: `src/hooks/useAttachments.ts`]. Production buckets and the pre-09 RLS state must be checked in the read-only preflight.
- [inferred] If production already has InsForge's auto-installed owner-only policies, they stay and OR with 09: uploaders keep access to their own objects in every bucket.
- Rollback (`09_rollback.sql`) re-opens cross-user downloads when it disables RLS; prefer option (a) in that file.
- Attachment `storage_path` values reach readers through `reader_book_tree`; with 09 that no longer grants access by itself.

## 8. Verdict (superseded 2026-10-21, see §9): BLOCKED
Revision 2.1 removes the over-broad behaviour of revision 1 (verified on TEST: policies scoped to `book-assets`, helper false for other buckets, no anon access, public-bucket reads unchanged, all anonymous writes denied). It cannot be marked PASS FOR OWNER REVIEW until the signed-in cases in §5 have run against TEST.

## 9. Signed-in verification, 2026-10-21 (automated run `2a9d01`) [verified now]
**Provisioning (no secrets recorded).** InsForge documents no admin call that creates a verified user, so the documented admin
endpoint `PUT /api/auth/config` was used on TEST only: original `requireEmailVerification=true` recorded → set `false` → 5 users
`rv6-2a9d01-{owner,editor,reviewer,viewer,stranger}@example.invalid` registered with random in-memory passwords (tokens kept in a
scratch file, never printed) → setting restored by a shell `trap` in the same command and re-read: `true`. A first attempt failed
(registration needs the anon key as Bearer; the docs example omits it) and the trap restored the setting; no user existed then.
**Fixtures:** profile rows; book `rv6-2a9d01-public` (PUBLISHED, PUBLIC; owner; members EDITOR, REVIEWER, VIEWER) with a published
and a draft-only step; book `rv6-2a9d01-restricted` (PUBLISHED, SELECTED_USERS, owner only); public and private probe buckets with
one synthetic object each. Roles verified in the database and with the real predicates (stranger reads public: true, restricted:
false; reviewer drafts: true; viewer drafts: false; editor edits: true).
**Identity:** for every token the server confirmed the expected user id (`GET /api/auth/sessions/current`) and the token's `role`
claim was `authenticated` (no admin credential used for user requests). Note: on TEST that endpoint returns no `role` field (docs differ).
**Harness:** `mcp/tools/storage-authz-verify.mjs` (target from the folder's real InsForge link, refuses production/wrong folder —
tested; deletes only `rv-<run>-` keys it recorded; idempotent cleanup in `finally`; `--keep` / `--cleanup` modes).

| # | Case | HTTP | Status |
|---|---|---|---|
| A1–A3 | owner uploads (published step, draft step, restricted book) | 200 | PASS |
| A4 | editor uploads | 200 | PASS |
| A5–A6 | owner downloads editor's object; editor downloads owner's draft object | 200 | PASS |
| A7 | owner overwrites own object (update) | 200, new content | PASS |
| C1 | reviewer downloads draft-step object | 200 | PASS |
| C2 | viewer downloads draft-step object | 404 | PASS (denied) |
| C3 / C4 | viewer / signed-in stranger download published attachment of a PUBLIC book | 200 | PASS (allowed by design) |
| C5 | unknown step id | 404 | PASS |
| C6 / C7 | upload under malformed prefix / bucket root | 403 | PASS |
| B1 | stranger downloads known draft key | 404 | PASS |
| B2 | stranger downloads published attachment of a SELECTED_USERS book | 404 | PASS |
| B3 | stranger uploads into the book | 403 | PASS |
| B4 | stranger overwrites known key; content checked | 403, unchanged | PASS |
| B5 | stranger deletes owner's object; object checked | 404, intact | PASS |
| B6–B8 | viewer upload / overwrite / delete | 403 / 403 / 404, unchanged | PASS |
| B9 | reviewer uploads | 403 | PASS |
| D1, D5 | public probe object: anonymous download before/after, unchanged | 200 | PASS |
| D2–D4 | signed-in overwrite / upload / delete in the public probe bucket | 403 / 403 / 404 | PASS |
| D6 | owner and stranger download from the private probe bucket | 404 | PASS (not widened) |
| D7–D8 | signed-in upload / delete in the private probe bucket | 403 / 404 | PASS |
Result: **37/37 PASS** (5 identity + 32 storage). Integrity (admin read): `uploaded_by` = owner for the 3 owner objects and = editor
for the editor object; no object from stranger/viewer/reviewer; the owner's object kept its legitimate v2 content after the denied
overwrites; RLS on, 4 policies, anon no schema usage/SELECT, authenticated no TRUNCATE.
**Cleanup (verified):** 4 objects deleted by their uploaders (each confirmed absent; the editor's delete also exercises the editor
delete path), 2 probe buckets deleted, 2 fixture books deleted (cascade), 5 users deleted via admin `DELETE /api/auth/users`
(auth users 0, profiles 0), token file removed; `requireEmailVerification=true` (original); only `book-assets` remains; RLS + 4
policies intact; pre-existing seed users (5), Fixture books (5) and reader trees unchanged; 0 active MCP tokens.
**Local (supplementary):** `tsc -b` OK, `vite build` OK, oxlint 0 errors.
**Still not covered:** anonymous download of published attachments (unsupported by design, §6); signed URL flows; behaviour on
production buckets and production's pre-09 RLS state (preflight); browser UI (no browser test was run).

## 10. Verdict: **PASS FOR OWNER REVIEW**
All required signed-in, anonymous and other-bucket cases passed on TEST with cleanup verified and the TEST setting restored.
This is not a production-readiness statement: production preflight, backup and the release decision remain open.
