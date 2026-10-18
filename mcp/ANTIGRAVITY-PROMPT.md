# Antigravity prompts for DevBook MCP / RLS hardening

Use on branch `v2` (the development branch; `main` = production; `v1` frozen). Two prompts:
1. **Context + code review** (no backend access needed).
2. **Real-backend verification** (only after you created a SEPARATE InsForge test project and connected Antigravity's InsForge MCP to THAT project).
Paste each block as the first message of a fresh Antigravity session. They are self-contained but point at the repo files so the agent keeps the context in sync.

---

## Prompt 1: understand the context and review the implementation

```text
You are reviewing work on DevBook (React 19 + Vite + TypeScript website, InsForge backend: Postgres + PostgREST-style API + Edge Functions + storage). Branch: v2. Do NOT modify src/, do NOT commit or push, do NOT apply any SQL to any database, do NOT use or ask for credentials. This session is read-only review plus running LOCAL tests.

CONTEXT (read in this order, summarize each in 3-5 lines before reviewing):
1. AGENTS.md and context/project-overview.md, context/architecture.md, context/code-standards.md (project rules; no hardcoded hex colors).
2. context/mcp-feasibility-and-design.md and context/mcp-phase2-design.md (original MCP design; later sections are superseded by what is below).
3. mcp/README.md (map of the work), then mcp/proposals/rls-hardening/final/README.md and final/HANDOFF.md (decisions, test evidence, assumptions A1-A15, and the verification plan).
4. The SQL, in apply order: mcp/proposals/rls-hardening/final/01_access_predicates.sql, 02_reader_objects.sql, 03_policy_switch.sql, 04_helper_guard.sql, optional 05_optional_reset_my_book_progress.sql, and every *_rollback.sql. Original (live) behaviour is reconstructed in final/sandbox/schema.sql.
5. The MCP server: mcp/devbook-mcp/handler.ts (single deployable Edge Function file), README.md, sql/001_mcp_tokens.sql, tests/.
6. The website patches (NOT applied): mcp/proposals/rls-hardening/frontend-access-level.patch and frontend-reader-integration.after-access-level.patch (apply order: access-level first, then the "after-access-level" reader patch; use `git apply` only, never GNU patch), plus READER-INTEGRATION.md and FOLLOWUP-REPORT.md.

WHAT THE WORK IS (verify each statement against the code, do not trust this summary):
- Problem: the live RLS lets anyone who can read a book read every step's whole content JSON, including DRAFT markdown and a search_vector built from draft text; DRAFT/ARCHIVED/UNLISTED books are listable; permission helper functions can be probed; can_manage_members recurses for non-owner members of a soft-deleted book; any logged-in user can create a book owned by someone else (insert_books policy).
- Decisions: draft text only for OWNER/EDITOR/REVIEWER (VIEWER and non-members get published text only, through reader_book_tree / reader_steps views); ARCHIVED/DRAFT books members-only; UNLISTED = link-only (readable via reader_book_tree(id), never listed); soft-deleted books hidden from the reader for everyone including the owner (matches DBService.getBook); new decisions F1 (member/access/revision lists only for draft viewers), F2 (get_book_id_for_step returns the id only to callers who can read the book), F3 (insert_books requires created_by = caller).
- MCP server: stateless Streamable HTTP, personal access tokens (dbk_...), SHA-256 hash lookup in mcp_tokens, service credential bypasses RLS so authorization is done in code (membership, role, not archived, not soft-deleted), 6 read tools, 4 draft tools (off by default), publish_draft (2-phase, HMAC confirmation, off by default), safe errors, allowlisted audit log.

REVIEW TASKS (report findings with file:line, severity, evidence, and a concrete fix; do not edit files):
A. SQL security: SECURITY DEFINER functions (search_path pinned? any caller-controlled identity? dynamic SQL?), every GRANT/REVOKE, view ownership/RLS-bypass assumptions, policy completeness for books, phases, steps, attachments, book_members, book_access, book_revisions, progress tables, users; any path where draft markdown or search_vector reaches a non-draft role (tables, views, RPC, search, related endpoints); enumeration of unlisted books, members, or other users' permissions; archived and soft-deleted handling; whether each rollback truly restores the original text/behaviour; whether 04_helper_guard.sql bodies still match 01/02 apart from the guard (final/check-04-drift.mjs).
B. MCP handler: authentication (every request, identical 401s, token never logged), authorization in every tool (cross-book ids, phase/step belongs to the authorised book, viewer vs reviewer vs editor vs owner), input validation (strict zod, limits, control characters), compare-and-set on steps.updated_at, merge rule in update_draft, publish_draft token binding (user, step, revision, content hash, expiry, exact title), error paths (store failures must become INTERNAL with no backend text), rate limiter, log shape, secrets handling (service key, confirm key), prompt-injection exposure of stored Markdown, anything that could write to another user's content or leak it.
C. Website patches (read only): do they handle all five access_level values, preserve optimistic rollback in useUpdateBook, avoid silently overwriting SELECTED_USERS or any value the UI cannot edit, and match the actual reader_book_tree JSON (final/02_reader_objects.sql)? List behaviour changes (empty phases hidden, public counts published-only, progress reset limits).
D. Test quality: do the tests really prove what the docs claim? Look for tests that could pass vacuously; propose 5 additional adversarial tests. Check the safety guards of scripts (PGHOST local-only, EXPECTED_TEST_APPKEY lock, production app key 6ktij8hk refusal).

RUN LOCALLY (needs a local disposable PostgreSQL; if you cannot provide one, skip and say so):
  bash mcp/proposals/rls-hardening/final/run-local-checks.sh   (see its header for the env variables)
  cd mcp/devbook-mcp && deno test --allow-net=127.0.0.1 --allow-env --allow-read=./handler.ts,./sql,../proposals/rls-hardening/final,../proposals/rls-hardening/sandbox tests/
Report exact commands and results. Never claim real InsForge compatibility from these results.

OUTPUT: (1) a one-page "state of the project" in your own words; (2) findings table (severity, area, evidence, fix); (3) things the docs claim that you could not confirm; (4) questions for the owner. Do not print secrets.
```

---

## Prompt 2: real-backend verification on a separate InsForge TEST project

Prerequisites (you, not the agent): a separate InsForge project created for testing; Antigravity's InsForge MCP connected to THAT project only (its API key comes from an environment variable, never pasted in chat); a service account for production is NOT available to this session.

```text
You are verifying DevBook's RLS hardening and MCP server on a SEPARATE InsForge TEST project through the InsForge MCP tools available in this session. Branch v2 of the repo is checked out; read mcp/proposals/rls-hardening/final/HANDOFF.md section 6 (the 13-phase plan) and final/README.md first; they are the source of truth. Also read mcp/proposals/rls-hardening/TEST-PLAN.md, preflight/readonly-queries.sql and mcp/devbook-mcp/README.md.

HARD RULES
- Phase 0 first: determine the connected project's identity (project name, API base URL / app key). The PRODUCTION app key is 6ktij8hk. If the project is production, or you cannot prove it is not, STOP and tell me. Do not continue on doubt.
- Never print, log or ask for API keys, tokens, passwords, JWTs or connection strings. Redact anything that looks like a secret in your output.
- Work through the phases in order. Read-only unless a phase says "apply". Apply SQL files exactly as in the repo (final/01... then 02, 03, 04, then mcp/devbook-mcp/sql/001_mcp_tokens.sql), one file at a time, saving before/after evidence. Do not edit the SQL; if a file fails or a check differs from "expected", STOP and report the exact error and output instead of fixing it.
- Do not modify src/, do not commit or push, do not touch storage bucket visibility, do not delete anything except objects/rows YOU created for the test (list them so I can clean up).
- The test data must be synthetic (users owner, editor, reviewer, viewer, stranger; dummy files). No real content.

DO THIS
1. Phase 0 (identity) and Phase 1 (catalog preflight): run Q1-Q10 from preflight/readonly-queries.sql plus pg_get_functiondef of auth.uid(), all public functions, all policies, pg_default_acl, role flags (rolbypassrls, rolsuper), has_schema_privilege('authenticated','public','CREATE'). Save as the "before" snapshot.
2. Phase 2 (schema parity): export the DDL of books, phases, steps, attachments, book_members, book_access, book_revisions, book_progress, step_progress, user_followers, users, enums, triggers; diff against final/sandbox/schema.sql; list every difference.
3. Phase 3 (identity plumbing): create a temporary public.__whoami() as described in the plan, call it via the API as anon and as a signed-in user, record auth.uid(), current_user, current_setting('role'), claims, HTTP method/path/response shape and error shape for unknown/forbidden functions. Drop it afterwards.
4. Phases 4-5: seed, then reproduce the known defects BEFORE applying anything (draft leak, listable draft/unlisted books, helper RPC probing, book_members failure for editor/viewer on the soft-deleted book, books insert with someone else's created_by).
5. Phases 6-8: apply 01, 02, 03, 04 in order, re-running the matrix after each (use exposure-check.mjs and rpc-contract-check.mjs from mcp/proposals/rls-hardening/ with CONFIRM_TEST_PROJECT=yes and EXPECTED_TEST_APPKEY set to the TEST project's key; or reproduce their calls with the MCP tools). Compare every result with the "expected" statements in the plan.
6. Phase 9 (storage/attachments): check bucket private flag, anonymous / stranger / viewer access to a draft attachment and a published attachment (HTTP status only), listing by authenticated non-members, and how a getPublicUrl-style link behaves logged-out. Report; change nothing.
7. Phase 11 (MCP function): apply mcp/devbook-mcp/sql/001_mcp_tokens.sql, check anon/authenticated cannot read it but the service credential can, deploy handler.ts with write flags OFF, mint a read-only token with mcp/tools/mcp-token.mjs (token only in my terminal, never in chat), run the read-tool and auth tests; then, only if everything before is green and I say so, enable write tools and test; then publish.
8. Phase 12 (rollback): roll back in reverse order and diff against the Phase 1 snapshot.

REPORT (one table): phase, check, expected, observed (redacted), PASS/FAIL, evidence reference. Then: assumptions A1-A15 of HANDOFF.md section 5, each CONFIRMED / REFUTED / STILL UNKNOWN with the evidence; every difference between sandbox and real backend; the list of rows/objects/files you created for cleanup; and a go/no-go recommendation for each of: step 01-02, step 03, step 04, MCP read tools, MCP write tools, MCP publish. Never state production readiness.
```

---

## Keeping the context in sync
- The authoritative decisions and evidence live in `mcp/proposals/rls-hardening/final/{README,HANDOFF}.md`. If the real backend contradicts a statement there, update that file and add the evidence under `mcp/proposals/rls-hardening/final/` rather than patching the SQL silently.
- Re-run `final/run-local-checks.sh` after any SQL or handler change; it also catches drift between `04_helper_guard.sql` and `01/02`.
- Open questions the owner must decide are listed in HANDOFF.md section 8.
