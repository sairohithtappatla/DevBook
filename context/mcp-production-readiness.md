# DevBook MCP — Production Readiness

Updated 2026-10-20. Companion documents: `mcp-remediation-ledger.md` (findings and fixes), `mcp-test-evidence.md` (commands
and results), `mcp-test-release-runbook.md` (TEST rollout and rollback). Labels as in the ledger: [local] / [remote] / [recorded].

## 1. Decision

**NOT PRODUCTION READY — the MCP server and the database hardening are now verified on the InsForge TEST project; the release is blocked by production-side work and by unverified/operational items listed in §4.**
(Superseded first assessment of this morning: "locally remediated, remote verification BLOCKED on approvals".)

Every known Critical/High finding has a fix with a regression test that fails on the old behaviour and passes now [local].
What is still missing is evidence on real infrastructure: the remediated function is not deployed to TEST (the deployed code is
the old `9da7167` version [remote]), 02b/07/06/002 are not applied there, no authenticated call of the new code, no real MCP
client, no observed throttling, no alerting, and production has none of the database hardening the MCP relies on.
MCP is also planned to stay out of the first production rollout (owner's leaning), so the security hardening + website patches
can ship first on their own runbook.

## 2. Architecture (unchanged in shape)
```
MCP client --HTTPS POST, Authorization: Bearer dbk_...--> InsForge Edge Function devbook-mcp (Deno, stateless, one file)
   1. method/Origin checks -> 2. token: SHA-256 lookup in mcp_tokens (expiry, revocation, scopes) -> 3. size/JSON checks
   4. fresh MCP server per request (SDK 1.32.1, Streamable HTTP, JSON responses, no sessions)
   5. tool: zod-validated input -> membership/role/scope/flag checks in code -> Store (admin key, bypasses RLS)
   6. audit line (+ optional durable row), x-request-id
Database: RLS hardening 01-04 (+02b, 07, 06) protects every NON-MCP path; mcp_tokens / mcp_rate_limits / mcp_audit_events are
closed to the API roles (RLS on, no policies, privileges revoked).
```

## 3. Threat model and controls
| Threat | Control | Evidence |
|---|---|---|
| Stolen/guessed token | 256-bit random secret, only its SHA-256 stored, format check before any DB call, expiry (≤365 d), revocation checked every request, identical 401 for every failure, never logged | [local] tests; [remote] probes 401 identical; [recorded] Stage 3/4 |
| Confused deputy (admin key bypasses RLS) | every tool resolves ids to a book and checks the caller's `book_members` row; soft-deleted books invisible; draft text only for OWNER/EDITOR/REVIEWER; writes OWNER/EDITOR; publish OWNER; no user-id parameters; no raw SQL or generic table tool; no delete tools | [local] authorization matrix and cross-book tests; [recorded] Stage 4 |
| Draft leak to readers | strict reader rule in SQL (07) and in the handler; legacy steps frozen (02b); MCP refuses ambiguous legacy edits; viewers never see draft-only steps or draft-only phase titles | [local] 23/23 SQL, handler + pg tests, 6 mutations |
| Unauthorised publication | owner-only; 2-step HMAC confirmation bound to op/user/token/step/revision/content, 10 min, single use (revision moves); feature flag + `publish` scope | [local]; [recorded] Stage 4 for the earlier version |
| Lost updates | compare-and-set on the trigger-maintained `updated_at`; the browser editor does NOT check revisions (accepted, documented) | [local]; [recorded] |
| Duplicates under retries | idempotent `create_phase` (normalised title) and `create_draft` (slug + content hash); unique positions in the DB; bounded jittered retry; `BUSY` when exhausted | [local] 10/10 parallel |
| Abuse / DoS | 256 KB body cap, strict schemas, per-isolate limiter, optional shared per-token limiter (002); unauthenticated well-formed tokens still cost one indexed lookup each | [local]; platform-level protection NOT available/verified |
| Prompt injection via stored Markdown | content returned as data; tool descriptions say so; publish needs the human-visible preview + exact title | design; cannot be fully prevented server-side |
| Secret leakage | allowlisted audit fields; fixed error messages; no tokens/headers/query strings in platform logs | [local] canaries; [remote] 0 token/JWT/key patterns in function logs |
| Attachment access | not reachable through MCP; on the website any authenticated user can fetch any object key | ACCEPTED for MCP, OPEN for website (ledger F7) |

**Admin-key boundary.** The function holds a full admin key. Compromise of the function code or its secrets equals full
database access. Mitigations: the key lives only in function secrets, is never returned or logged, and all authorisation is in
code with tests. A user-scoped JWT design (RLS enforced for MCP too) would shrink the blast radius but needs the project JWT
secret inside the function and a separate proof on TEST — proposed, not implemented (ledger P3).

## 4. Release blockers and their status
| Blocker | Status |
|---|---|
| No reproducible draft-content leak | PASS [local]; BLOCKED [remote] (deploy + 02b/07 on TEST) |
| Database and application reader rules agree | PASS [local] (525-shape parity, SQL vs handler) |
| No cross-book / cross-tenant access | PASS [local], PASS [recorded] for the old code; re-run BLOCKED |
| Owner-only publishing | PASS [local]; BLOCKED [remote] |
| Confirmation bound to authorisation context | PASS [local] |
| Token expiry and revocation | PASS [local]; PASS [recorded] |
| Flags enforced server-side | PASS [local]; flags currently false on TEST [remote] |
| TEST migrations reviewed and applied | 01–04 applied [remote]; 02b, 07, 06, 002 BLOCKED (approval) |
| No unresolved Critical/High | F2 (production not hardened) remains by design until the go-live runbook |
| Concurrent create/update integrity | PASS [local]; BLOCKED [remote] |
| Real-client interoperability | NOT VERIFIED (needs a token and the owner's client) |
| Rate limiting verified | PASS [local] logic + atomicity; NOT VERIFIED [remote] |
| Private storage | residual risk documented (website) |
| Credentials current, rotation documented | rotation documented; current state UNKNOWN (keys updated 20/10, function key 19/10) |
| Monitoring, durable audit, incident response | durable audit implemented (opt-in); alerting NOT configured; procedure in the runbook |
| Rollback rehearsed on TEST | SQL 01–04 rehearsed [recorded]; function rollback NOT rehearsed |
| Website regression tests | see `mcp-test-evidence.md` |
| Deployed code = reviewed source | FAIL today (TEST runs `9da7167`); fixed by the approved deploy + `functions code` diff |
| No production modifications | PASS (production never contacted) |

## 5. Operations (implemented vs. manual)
Implemented in code: request ids, allowlisted structured logs, durable audit table, shared limits, `BUSY`/`RATE_LIMITED`
codes, fail-closed writes when the limit store fails, flags default OFF, token tool with revoke.
Manual (account/infrastructure, not in the repo): log export/retention beyond the platform default; alerts on 5xx, `INTERNAL`,
repeated `UNAUTHENTICATED`, `RATE_LIMITED`, `BUSY`, `audit_store_error`, `rate_store_error`; platform-level rate limiting if
InsForge offers it; a scheduled export/prune of `mcp_audit_events`; OAuth if claude.ai/ChatGPT must connect without headers.

## 6. Residual risks accepted for now
Browser editor without revision checks (F13); `phases` table shows draft-only phase titles to readers of a discoverable book (F9,
table side); attachments downloadable by any authenticated user who knows a key (F7, website); admin-key blast radius (F3);
hosted deploy resolves transitive dependency versions itself (F16); fixed-window limits allow up to 2× the limit around a window
boundary.

## 8. Status after the post-remediation run (2026-10-20 evening)
- Website editor bug (F21): fixed in `src/` locally with 9 regression tests (6 fail on the original code); NOT browser-verified (no TEST website).
- Access levels FOLLOWERS_ONLY / SELECTED_USERS / ARCHIVED and malformed content verified on TEST; real anonymous API confirmed the reader protections; draft-only phase TITLES are exposed by the `phases` table (S4, open).
- Flag propagation root cause established (platform restart per secret update, sequential); procedure updated; token revocation verified as the immediate kill switch.
- Storage cross-user download not testable on TEST this round (empty bucket, no object delete in the CLI).

## 7. Status after the authorized TEST run (2026-10-20)
| Blocker | Status on TEST |
|---|---|
| No reproducible draft-content leak | **PASS** (strict reader rule live; legacy and Published-without-text content hidden; MCP refuses ambiguous edits) |
| DB and application reader rules agree | **PASS** (deployed `reader_markdown` body = reviewed file; MCP results match the reader tree) |
| No cross-book / cross-tenant access | **PASS** (4 roles x owner-only/unlisted books -> NOT_FOUND) |
| Owner-only publishing | **PASS** |
| Confirmation bound to context | **PASS** for user/token/replay on TEST; operation binding local only |
| Token expiry and revocation | revocation **PASS** (immediate); expiry local only |
| Flags enforced server-side | **PASS**, but flag changes need a redeploy to take effect reliably (F23) |
| TEST migrations reviewed and applied | **PASS** (02b, 06, 07, 002; 02c deliberately skipped) |
| Concurrent create/update integrity | **PASS** (10/10 parallel creates, CAS conflicts) |
| Real-client interoperability | **PARTIAL** (official SDK client PASS; Claude Code/Inspector UI not run) |
| Rate limiting | **PASS (throttling observed)**; layer attribution not separable |
| Durable audit | **PASS**; alerting and retention NOT configured |
| Rollback rehearsed | function rollback **not** rehearsed (redeploy mechanism proven by 3 redeploys); SQL rollbacks of 02b/06/07/002 not run on TEST |
| Website editor fix | **BLOCKED**: no TEST website deployment exists |
| Deployed TEST code = reviewed source | **PASS** (but the source is uncommitted; must be committed before any production use) |
| Production | untouched; none of 01–07 / 002 applied there |
Remaining blockers for an MCP production release: production DB hardening via `final/PRODUCTION-RUNBOOK.md` (incl. 02b/07 and the editor fix live first); commit + review of the remediation; a website test deployment to verify the editor fix in a browser; alerting/log retention; F23 procedure (or code change); rollback rehearsal; decision on OAuth if web clients are needed.
