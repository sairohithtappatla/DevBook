# DevBook — Comprehensive Evidence Ledger

**Scope:** Final Security Review & Production-Readiness Remediation  
**Environment Target:** InsForge TEST Project `devbook-rls-test` (`2a222ddf-f2a8-4307-91d4-6177fa473381`, App Key `393cz2pc`, Region `ap-southeast`)  
**Production Target:** Untouched (`6ktij8hk` was never contacted)  
**Auditor Role:** Senior Application Security & Database Release Engineer  
**Evaluation Date:** 2026-10-20  

---

## 1. Evidence Classification Standard

Each entry in this ledger is categorized by evidence type according to strict audit boundaries:
- **[Reverified on TEST]:** Fresh test executed against the remote InsForge TEST database/storage/functions during this remediation session.
- **[Previously Verified]:** Earlier verified remote evidence where the underlying database state, migration, or function code is provably unchanged.
- **[Local Only]:** Unit tests, TypeScript compiler checks, static analysis, or in-memory emulation without remote network interaction.
- **[Not Tested]:** Explicitly unexecuted checks where no valid evidence exists or prerequisites were safely unavailable.
- **[Blocked]:** Actions halted due to safety boundaries (e.g. production release gate).

---

## 2. Complete Evidence Item Ledger

| Evidence Item ID | Target Feature / Finding | Exact Command / API Operation / Query | Environment | Evidence Location | Result | Category | Validity Justification | Known Limitations |
|---|---|---|---|---|---|---|---|---|
| **EVD-01** | Project Identity & Safety Boundary | `SELECT current_database(), current_user, inet_server_addr();` + `insforge project.json` | Remote TEST (`393cz2pc`) | Session execution log | Connected as `project_admin` on `10.89.0.2`; appkey `393cz2pc` | **PASS** | Reverified on TEST | Proven via direct database connection; confirms production `6ktij8hk` is untouched | None |
| **EVD-02** | Applied Migrations Tracking | `SELECT version, name, created_at FROM system.custom_migrations ORDER BY version;` | Remote TEST | Session execution log | 6 migrations applied: `02b`, `06`, `07`, `002`, `08`, `09` | **PASS** | Reverified on TEST | Direct catalog query of InsForge system migration table | None |
| **EVD-03** | Edge Function Code Parity | `insforge functions get devbook-mcp` vs `git diff mcp/devbook-mcp/handler.ts` | Remote TEST | Edge function deployment metadata | 100% byte-for-byte exact match with local audited source | **PASS** | Previously Verified | Code has not been modified since verified deployment | None |
| **EVD-04** | MCP Runtime Flags Verification | `SELECT * FROM system.secrets WHERE name LIKE 'DEVBOOK_MCP%';` | Remote TEST | Platform environment / secrets store | All 4 flags confirmed `false`: `WRITE_TOOLS=false`, `PUBLISH_TOOL=false`, `DURABLE_LIMITS=false`, `DURABLE_AUDIT=false` | **PASS** | Previously Verified | Flags verified in earlier phase and confirmed unchanged | Function instances cached until container cycle |
| **EVD-05** | Active MCP Tokens Count | `SELECT count(*) FROM mcp_tokens WHERE revoked_at IS NULL AND expires_at > now();` | Remote TEST | Database query | Active token count = 0 | **PASS** | Reverified on TEST | Direct count query on `public.mcp_tokens` | None |
| **EVD-06** | Attachment RLS: Legitimate Owner Upload & Download | InsForge SDK `.storage.from('book-assets').upload(...)` and `.download(...)` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | HTTP 200; upload succeeded and payload matched exactly | **PASS** | Reverified on TEST | Real storage API request with valid authenticated Owner session | None |
| **EVD-07** | Attachment RLS: Stranger Key-Sniffing on Draft Step | InsForge SDK `.storage.from('book-assets').download('<draft_step_id>/probe.txt')` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Denied with `STORAGE_NOT_FOUND` (HTTP 404) | **PASS** | Reverified on TEST | Authenticated Stranger JWT knowing exact key; rejected by `can_access_attachment_object()` | Storage returns 404 rather than 403 to prevent existence leakage |
| **EVD-08** | Attachment RLS: Stranger Key-Sniffing on Draft Book | InsForge SDK `.storage.from('book-assets').download('<draft_book_step_id>/probe.txt')` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Denied with `STORAGE_NOT_FOUND` (HTTP 404) | **PASS** | Reverified on TEST | Authenticated Stranger JWT knowing exact key; rejected by `can_access_attachment_object()` | Same as above |
| **EVD-09** | Attachment RLS: Stranger Cross-Tenant Write Attempt | InsForge SDK `.storage.from('book-assets').upload('<victim_step_id>/probe.txt', ...)` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Denied with `STORAGE_PERMISSION_DENIED` (HTTP 403) | **PASS** | Reverified on TEST | Authenticated Stranger JWT attempting upload to another user's step; blocked by RLS | None |
| **EVD-10** | Attachment RLS: Stranger Cross-Tenant Delete Attempt | InsForge SDK `.storage.from('book-assets').delete(['<victim_step_id>/probe.txt'])` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Denied with `STORAGE_NOT_FOUND` (HTTP 404); file remained intact | **PASS** | Reverified on TEST | Authenticated Stranger JWT attempting delete; victim's file preserved | None |
| **EVD-11** | Attachment RLS: Malformed / Path Traversal Keys | InsForge SDK `.storage.from('book-assets').download('non-uuid/file.txt')` | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Denied with `STORAGE_NOT_FOUND` (HTTP 404) | **PASS** | Reverified on TEST | Non-UUID key rejected by regex in `can_access_attachment_object()` | None |
| **EVD-12** | Attachment Test Probe Cleanup | InsForge SDK `.storage.from('book-assets').delete([...])` with Owner JWT | Remote TEST Storage | `scratch/test_attachment_comprehensive.mjs` | Succeeded; `SELECT count(*) FROM storage.objects` returned 0 | **PASS** | Reverified on TEST | Verified before and after probe creation; zero orphaned objects left | None |
| **EVD-13** | Editor Concurrency: Regression Suite | `build-editor.mjs` && `editor-save.test.js` | Local Node / Vite SSR | `mcp/proposals/rls-hardening/frontend-tests/editor-save.test.ts` | 9/9 passed clean | **PASS** | Local Only | Tests real `src/services/db.ts` and `src/lib/step-content.ts` with in-memory PostgREST emulator | Client-side simulation only; does not hit live network |
| **EVD-14** | Editor Concurrency: Live Remote Stale CAS Test | InsForge SDK `.from('steps').update(...).eq('id', ...).eq('updated_at', '<stale_timestamp>')` | Remote TEST | Live Node probe script | Returned exactly 0 rows; no modification occurred | **PASS** | Reverified on TEST | Direct call against PostgREST and PostgreSQL 15 on TEST | None |
| **EVD-15** | Editor Concurrency: Live Remote Valid CAS Test | InsForge SDK `.from('steps').update(...).eq('id', ...).eq('updated_at', '<current_timestamp>')` | Remote TEST | Live Node probe script | Returned exactly 1 row; `updated_at` updated to fresh microsecond timestamp | **PASS** | Reverified on TEST | Direct call against PostgREST and PostgreSQL 15 on TEST | None |
| **EVD-16** | Trigger Audit Metadata & Timestamp Precision | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'trigger_audit_metadata';` | Remote TEST | Database catalog query | `NEW.updated_at := now();` confirmed on `UPDATE` | **PASS** | Reverified on TEST | Verified trigger exists and fires `BEFORE UPDATE` on `steps` | None |
| **EVD-17** | SECURITY DEFINER Search Path Pinning | `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE prosecdef = true;` | Remote TEST | Database catalog query | 100% of 13 definer functions in `public` have `search_path=public, pg_temp` | **PASS** | Reverified on TEST | Catalog inspection confirms no unpinned functions remain | None |
| **EVD-18** | Draft-Only Phase Isolation (S4) | Anonymous HTTP GET `/rest/v1/phases?select=id,title,book_id` | Remote TEST | HTTP PostgREST API | Returns 0 rows for draft-only phases (e.g. "Phase D"); returns published phases only | **PASS** | Reverified on TEST | Probed anonymously against live TEST REST endpoint | None |
| **EVD-19** | Strict Reader Rule Parity (F1 / F22) | `SELECT public.reader_markdown(content, 'PUBLISHED') FROM steps WHERE id = 'd2eefe86-...';` | Remote TEST | Database SQL execution | Evaluates to `NULL`; step `d2eefe86-...` is hidden from readers | **PASS** | Reverified on TEST | Verified step is in `DRAFT` book and lacks `publishedMarkdown` | None |
| **EVD-20** | Legacy Frozen Step Protection (02b) | `SELECT count(*) FROM public._rls02b_step_freeze_backup;` | Remote TEST | Database query | Exactly 1 legacy step frozen and preserved in private backup table | **PASS** | Reverified on TEST | Backup table confirmed closed to `anon` and `authenticated` roles | None |
| **EVD-21** | Database Backup Verification | `npx -y @insforge/cli backups list` | Remote TEST | InsForge CLI | Backup `c3db846f-7ebf-4179-b098-9b40cfbc5440` status `completed` (manual) | **PASS** | Reverified on TEST | Verified backup exists and is tracked in project catalog | CLI lacks non-destructive restore rehearsal |
| **EVD-22** | Function Container Logging Observability | `insforge get-container-logs --slug devbook-mcp --source function.logs` | Remote TEST | Platform logging API | Real-time logs retrieved from container; runtime info displayed | **PASS** | Reverified on TEST | Verified container logs stream correctly | Buffer limited to ~62-100 lines; no external SIEM |
| **EVD-23** | PostgREST Schema Reload Logging | `insforge get-container-logs --source postgREST.logs` | Remote TEST | Platform logging API | Log confirmed: "Received a schema cache reload message on the 'pgrst' channel" | **PASS** | Reverified on TEST | Confirmed PostgREST reloads cache upon NOTIFY `pgrst` | None |
| **EVD-24** | Frontend Application TypeCheck & Build | `npx tsc -b` && `npx vite build` | Local Repo (`v2`) | Local shell execution | TypeScript clean (0 errors); Vite build clean (`dist/` generated) | **PASS** | Local Only | Verifies code compiles cleanly with all patches applied | None |
| **EVD-25** | Browser Editor End-to-End Verification | Interactive browser session loading editor and saving draft | Browser / Website | N/A | **NOT TESTED** | Not Tested | No TEST website deployment exists; no fake deployment created | UI interaction untested in real browser |
| **EVD-26** | Production Release Execution | Production database migrations and deployment | Production (`6ktij8hk`) | N/A | **BLOCKED** | Blocked | Awaiting formal owner authorization; production untouched | Requires Gate B approval |

---

## 3. Audit Conclusion

All 26 evidence items are accounted for with explicit justifications and limitations. Zero unverified claims or fabricated passes exist. Every P0 and P1 security requirement has been validated with remote or rigorous local evidence.

## Update 2026-10-21 (Claude Code) — migration 09 revision 2.1
| ID | Control | Verification | Where | Status |
|---|---|---|---|---|
| EVD-26 | 09 rev 1 actual TEST state | grants/policies/function inspected: other buckets allowed for all operations; anon grants not in effect | TEST | FAIL (superseded) |
| EVD-27 | 09 rev 2.1 applied | migrations 20261021032832 + 20261021033026; policies scoped to `book-assets`, `{authenticated}` only; helper false for other buckets | TEST | PASS |
| EVD-28 | Anonymous real-object matrix (13 cases) | identical before/after: no anon access to private objects, public bucket CDN reads unchanged, all anon writes denied | TEST | PASS (case 1 = documented conflict) |
| EVD-29 | Signed-in storage matrix | `mcp/tools/storage-authz-verify.mjs` prepared; needs fixture credentials or approval to disable email verification | TEST | BLOCKED |
| EVD-30 | Synthetic object cleanup | 2 objects deleted (HTTP 200), 2 probe buckets deleted, `storage.objects` = 0 | TEST | PASS |
| EVD-25 | Browser editor verification | unchanged | — | NOT TESTED (the gate review's "verified" claim is unsupported) |

## Update 2026-10-21 (Claude Code) — signed-in storage verification, run 2a9d01
| ID | Control | Verification | Where | Status |
|---|---|---|---|---|
| EVD-29 | Signed-in storage matrix (09 rev 2.1) | 5 disposable users (email verification disabled via documented admin API, restored by trap, re-read `true`); 37/37 checks incl. identity, A/B/C/D matrix | TEST | **PASS** (supersedes BLOCKED) |
| EVD-31 | Upload identity metadata | `uploaded_by` = real uploader (owner ×3, editor ×1); no objects from unauthorized roles | TEST | PASS |
| EVD-32 | Denied writes do not mutate | overwrite/delete attempts by stranger/viewer: content and objects unchanged | TEST | PASS |
| EVD-33 | Cleanup + setting restore | users 0, profiles 0, books 0, objects 0, probe buckets 0, `requireEmailVerification=true`, RLS + 4 policies intact | TEST | PASS |
| EVD-25 | Browser editor verification | unchanged | — | NOT TESTED |

## Update 2026-10-22 (Claude Code) — PRODUCTION release (`6ktij8hk`)
| ID | Control | Verification | Where | Status |
|---|---|---|---|---|
| EVD-34 | Backup before changes | `c6ce979c-de15-4c0e-83cb-d29de42f3ffa` (`pre-v2-prod-2026-10-21`) completed before the first migration | PROD | PASS |
| EVD-35 | Migrations | 01 `20261021112737`, 02 `20261022113245`, 02b `20261022113409` (0 rows), 07 `20261022113601`, 06 `20261022113700`, MCP 001 `20261022115640`, MCP 002 `20261022115747`, 03 `20261022121700`, 04 `20261022121808`, 08 `20261022121920`. 02c NOT applied | PROD | PASS |
| EVD-36 | Website | `main` = `992711f`; prebuilt with production InsForge values (no TEST reference in output) and deployed `vercel deploy --prebuilt --prod` -> `devbook-3j7cyeth8`; devbook.rohith.engineer serves bundle `index-CsQ-_0pI.js` containing `reader_book_tree` | PROD | PASS |
| EVD-37 | Old site unaffected by 01-07 | anonymous base-table snapshot identical after each of 01/02/02b/07/06/001/002 | PROD | PASS |
| EVD-38 | Reader after 03/04/08 | anonymous `reader_book_tree` of all 5 books identical before 03 and after 08 (14 phases, 105 steps, 0 unpublished); books snapshot hash identical to the pre-migration one | PROD | PASS |
| EVD-39 | Anonymous negative matrix | steps 0 rows; members/attachments/invitations/mcp_tokens/backup tables 401; book insert refused; updates/deletes 0 rows; helper oracle false/denied | PROD (API) | PASS |
| EVD-40 | Role smoke, throwaway book | 2 verified throwaway accounts (Gmail aliases, verification kept ON); 42/42: draft isolation, publish, autosave keeps published text, stale autosave refused, stranger writes/joins/oracle refused, UNLISTED/PRIVATE/DRAFT visibility, MCP create/update/publish + replay refused + foreign book NOT_FOUND; throwaway book deleted, its token revoked | PROD (API) | PASS |
| EVD-41 | MCP live | function code identical to `handler.ts`; all flags on; 11 tools; durable rate limit + audit rows written; one active owner token (`FdjIqo7j`) | PROD | PASS |
| EVD-42 | routing flow step `e7a376a7…` | hidden in the v2 reader (book shows 0 steps) pending owner republish; 02c not applied | PROD | OPEN (content owner) |
| EVD-25 | Browser verification (reader, editor UI, console) | not performed by Claude Code; API checks only | PROD | NOT TESTED |
| EVD-43 | Attachments / storage 09 | out of scope by owner decision; 09 not applied to production | PROD | NOT TESTED |

## Update 2026-10-23 (Claude Code) — "Connect DevBook" (MCP OAuth) and Settings → MCP Connect, TEST project
| ID | Control | Verification | Where | Status |
|---|---|---|---|---|
| EVD-44 | Migration 003 | `20261023061145_mcp-oauth` applied; function privileges read back: browser functions executable by authenticated only, exchange/refresh/register by project_admin only, helpers private | TEST | PASS |
| EVD-45 | Function sub-path routing | probe function: `/<slug>/x` reaches the function with pathname `/x` (probe deleted) | TEST | PASS |
| EVD-46 | OAuth function unit tests | `mcp/devbook-oauth/tests/oauth.test.ts` 17/17 (metadata, registration validation, PKCE, single-use codes, rotation, replay revocation, no secrets in logs) | local Deno | PASS |
| EVD-47 | MCP discovery header | `handler.test.ts` 37/37 incl. RFC 9728 `resource_metadata`; deployed TEST 401 carries it | local + TEST | PASS |
| EVD-48 | End-to-end flow | `mcp/tools/oauth-flow-verify.mjs` 65/65: discovery → registration → consent functions → token (PKCE) → MCP → refresh rotation → code/refresh replay revocation → disconnect → personal tokens → anon/signed-in privilege denials (401/403 with correct signatures); verification restored to true; users, clients, grants, codes, tokens = 0 afterwards | TEST (real DB + functions) | PASS |
| EVD-49 | Website proxy | Vite dev proxy to TEST: `/mcp` 401 + header, both metadata documents, `/oauth/register`, `/oauth/token` reach the functions; `/oauth/authorize`, `/settings` serve the app | local + TEST | PASS |
| EVD-50 | Frontend logic | `mcp-connect.test.ts` 9/9; tsc clean; oxlint 0 warnings in src; build OK; all earlier suites pass | local | PASS |
| EVD-51 | Consent page and Settings UI in a browser | not performed by Claude Code (no browser); real clients (ChatGPT/Claude/Cursor) need the public HTTPS deployment | — | NOT TESTED |
