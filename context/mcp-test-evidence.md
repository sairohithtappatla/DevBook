# DevBook MCP — Test Evidence

All runs 2026-10-20 on Windows 11 / Git Bash unless marked [recorded]. Tools were installed into a session scratch folder, never
into the repo: Deno 2.5.6 (npm `deno`), PostgreSQL 15.18 (npm `@embedded-postgres/windows-x64`, cluster on 127.0.0.1:54315,
trust auth, deleted with the scratch folder), `pg` 8.13.1, `libpg-query` 17.6.0. Code under test: `v2` 9da7167 + the local
remediation (uncommitted). Secrets: none used locally; remote reads used the CLI's existing login; no value was printed.

## A. Static and local
| Command | Environment | Result |
|---|---|---|
| `deno check handler.ts tests/*.ts` (in `mcp/devbook-mcp`) | local | PASS |
| `deno lint --rules-exclude=no-import-prefix,no-explicit-any handler.ts` | local | PASS |
| `deno test --allow-net=127.0.0.1 --allow-env --allow-read=./handler.ts,./sql,../proposals tests/handler.test.ts` on the ORIGINAL 9da7167 code (baseline, before any change) | in-memory fake store | 25 passed |
| same, current code | in-memory | **36 passed, 0 failed** |
| `PGPORT=54315 deno test … tests/` (in-memory + `store-pg.test.ts`) | in-memory + PostgreSQL 15.18 through `tests/pg-db.ts` (PostgREST emulation, superuser as service credential); SQL state 01, 02, 02b, 03, 04, 07, MCP 001, 002 | **49 passed, 0 failed** (with `deno.lock`) |
| mutation runs: 18 deliberate re-breaks of security fixes on scratch copies (`deno test --no-check …`) | local | **18/18 caught** (each made ≥1 test fail) |
| `node --test mcp/tools/mcp-token.test.mjs` | local | 5 passed |
| `PG_MODULE=… PGPORT=54315 node final/sandbox/legacy-freeze.mjs` | PostgreSQL 15.18 | **23/23** (02b, 07 incl. precondition and re-run, 06, rollbacks) |
| `bash final/run-local-checks.sh` (PG_MODULE, PARSER_DIR, DENO, DENO_DIR, FE_NODE_MODULES, MSYS=winsymlinks:nativestrict) | PostgreSQL 15.18 + throwaway website copy | **32 PASS, 0 FAIL, 0 SKIP** — `final/LOCAL-CHECKS-RESULT-PG15-REVIEW.txt` |
| `bash proposals/rls-hardening/verify-patch-order.sh` after regenerating the reader patches | throwaway `src/` copies | PASS |
| `npm audit --omit=dev` of `@modelcontextprotocol/sdk@1.32.1 zod@3.25.76 zod-to-json-schema@3.24.6 @insforge/sdk@1.5.2` | scratch folder, 111 packages | 0 advisories (SDK 1.32.1 is the latest release). Not proof of safety |

What the local database tests do NOT prove: InsForge's role mapping, PostgREST behaviour, the admin key's real privileges,
hosted Deno limits. The superuser stands in for the service credential.

## B. Remote TEST (`devbook-rls-test`, app key 393cz2pc), read-only, by Claude Code
| Check | Command / method | Result |
|---|---|---|
| target identity | `EXPECTED_TEST_APPKEY=393cz2pc node …/preflight/guard.mjs`; `npx -y @insforge/cli current` | GUARD OK; project devbook-rls-test, ap-southeast |
| server version | `db query "select version()"` | PostgreSQL 15.18 |
| deployed function | `functions list`; `functions code devbook-mcp` diffed with `git show <c>:mcp/devbook-mcp/handler.ts` | active, created 19/10; **identical to 9da7167** (remediation NOT deployed) |
| function settings (names/booleans only) | `secrets list`; `secrets get` piped to a true/false test | API/CONFIRM keys present; WRITE_TOOLS=false; PUBLISH_TOOL=false; project `API_KEY`/`ANON_KEY` updated 20/10, function key 19/10 |
| applied SQL | catalog SELECTs | 01–04 applied (policies switched, 04 guard in 6 helpers); 02b, 05, 06, 07 not applied; `trigger_add_book_owner` has no search_path |
| legacy exposure condition | SELECT counts per book | 2 steps reader-visible only through the legacy fallback (Fixture Public, Fixture Draft) |
| token table | SELECTs (counts only) | RLS on, 0 policies, no anon/authenticated SELECT/INSERT; 2 active read-only tokens, earliest expiry 20/10 17:38 UTC |
| unauthenticated transport | `curl` probes and `node mcp/tools/remote-verify.mjs` without tokens | 401 identical (missing/garbage/random token, token in query string), GET/DELETE 405, browser Origin 403: PASS. `x-request-id`: absent (expected: old code) |
| log hygiene | `logs function.logs --limit 200` scanned locally | 0 token / JWT / API-key patterns; no headers or query strings logged; only 62 lines retained |

## C. Remote TEST, authenticated — NOT RUN by Claude Code (BLOCKED: needs approved token minting and deploy)
[recorded] Antigravity 2026-10-19 on the OLD code: 6 read tools listed, authorisation matrix, CAS conflicts, publish confirmation
binding/expiry/replay, archived/soft-deleted refusal, log hygiene (3448 lines, 0 forbidden matches); exceptions: 10 parallel
creates 4/10, limiter not triggered (test design could not trigger it), editors could publish.
Reproducible command for the new code: `context/mcp-test-release-runbook.md` §5–§7 (`mcp/tools/remote-verify.mjs`).

## D. Real-client interoperability — NOT VERIFIED
Stage 3 [recorded] used scripted HTTP (`hello-mcp/verify.mjs` style), not a real client. Command for the owner:
`context/mcp-test-release-runbook.md` §7.

## E. Remote TEST execution, 2026-10-20 (authorized; devbook-rls-test, project 2a222ddf-…, app key 393cz2pc)
Before every remote change: `guard.mjs` GUARD OK and `insforge current` showed devbook-rls-test / 393cz2pc. Production never contacted.
| Gate | Operation (remote change) | Verification on TEST | Result |
|---|---|---|---|
| A | `backups create --name pre-mcp-remediation-2026-10-20 --wait` | `backups list`: id `c3db846f-7ebf-4179-b098-9b40cfbc5440`, status completed (size shown as "-") | PASS |
| pre | `db import` probes (harmless) | `Error: FORBIDDEN`; probe function absent afterwards. `db query` with BEGIN: "Transaction control statements are not allowed"; `--unrestricted`: disabled | method rejected; migrations used |
| pre | roles (read-only) | CLI/migrations run as `project_admin` (rolbypassrls, not superuser), owner of all app objects; PostgREST connects as `postgres` | — |
| B1 | migration `20261020110927_legacy-step-freeze` (02b) | backup table = exactly step `670a198b…`, `publishedMarkdown` = its unchanged markdown (md5 same); step `d2eefe86…` byte-identical; backup table closed to anon/authenticated; reader trees of all 5 fixture books identical to the pre-migration snapshot (sha256) | PASS |
| B2 | migration `…111217_pin-trigger-search-path` (06) | `proconfig = search_path=public, pg_temp`, still SECURITY DEFINER; trees identical | PASS |
| B3 | migration `…111334_strict-reader-rule` (07) | deployed body md5 = local file `0639fddd…`, no read of `markdown`; synthetic: Published-without-pm -> NULL, legacy -> NULL, published text (incl. '') returned; `d2eefe86…` hidden; steps visible only via fallback: 0; trees identical; ACLs kept | PASS |
| C | `functions deploy devbook-mcp --file mcp/devbook-mcp/handler.ts` (flags false) | `functions code` = local file (0 differing non-blank lines); `x-request-id` present; smoke 4/4 | PASS |
| C | website editor fix | no TEST website deployment (`deployments list`: none) | BLOCKED |
| D | 6 tokens minted (1 day, hashes only) | `remote-verify.mjs` read-only 15/15; extra checks 14/14 (cross-book NOT_FOUND for editor/reviewer/viewer/stranger, published-text-absent handling, frozen legacy text md5, flags-off NOT_AVAILABLE, scope FORBIDDEN_SCOPE, unknown tool, oversized input); official MCP SDK client 7/7 | PASS |
| E | fixtures (test-only ids f9e00000-…, b9e00000-…) via `db query` | readers do not see legacy-shaped or Published-without-text text; OWNER row created by the pinned trigger | PASS |
| E | WRITE flag true | `--writes` 25/25 (role denials, CAS conflict, LEGACY_STEP, 10/10 parallel creates, idempotent retry); Published-without-text step refused, both fixture rows unchanged | PASS |
| E | WRITE false | stored false; 10/10 sampled instances 6 tools | PASS |
| E | WRITE+PUBLISH true (+ draft-only editor token) | `--writes --publish` 29/29 (editor FORBIDDEN_ROLE, cross-token CONFIRMATION_INVALID, publish, viewer reads it, replay CONFLICT); metadata scope 3/3 | PASS |
| E | WRITE+PUBLISH false | stored false, but instances kept the write tools >1.5 min (F23); identical-code redeploy -> 6 tools everywhere | PASS after redeploy |
| E | migration `…113543_mcp-ops` (002) + DURABLE flags + redeploy | tables/function owned by project_admin, RLS on, 0 policies, no anon/authenticated access; durable audit rows for refused write/publish attempts (request ids match), none for reads; burst 150 reads -> 63 ok / 87 RATE_LIMITED | PASS (layer attribution uncertain) |
| F | DURABLE flags false + redeploy | all four flags stored false; 6 tools on 10/10 instances; write attempt leaves no audit row | PASS |
| F | delete test records by exact id (3 rv phases -> 24 steps, 1 probe book) | 0 leftovers; nothing else changed since 11:00 UTC except the 02b-frozen step; reader trees identical to the pre-migration snapshot | PASS |
| F | revoke 9 tokens | viewer 200 -> 401 immediately; all 9 revoked; local token file deleted | PASS |
| F | final smoke + identity | smoke 4/4 (after one transient network failure); deployed = local; migrations list shows the 4 migrations; function logs: 0 tokens, 0 JWTs, 0 fixture markdown markers, 0 INTERNAL | PASS |
Supplementary (local, no database): `deno check`, 36/36 in-memory unit tests. Not used as remote evidence.

## F. Post-remediation run, 2026-10-20 evening
Remote (TEST, devbook-rls-test / 393cz2pc; guard + `current` before every change; production not contacted):
| Check | Method | Result |
|---|---|---|
| deployed state unchanged since §E | `functions code` = local handler; migrations list (4); flags all false; reader md5 `0639fddd…`; trigger config pinned; 0 active tokens; trees = 20/10 snapshot | PASS |
| access levels | disposable `rv2-` books (FOLLOWERS_ONLY, SELECTED_USERS, ARCHIVED, malformed) + `can_read_book`/`can_discover_book`/`can_view_drafts` for owner, viewer, stranger (follower), editor, anon | all 15 combinations as designed — PASS |
| malformed content | steps with `publishedMarkdown` 5 / null / missing / draft | never served; archived step with published text served (F26) |
| real anonymous API (anon key in memory, never printed) | `records/books`, `records/steps`, `rpc/reader_book_tree` (include_drafts=true), `rpc/can_edit_book`, `records/mcp_*` | only PUBLISHED+PUBLIC books listed; steps `[]`; restricted books `null`; no draft text; helper `false`; MCP tables `permission denied` — PASS. `records/phases` exposes draft-only phase TITLES (S4) — FAIL (known) |
| storage | `storage list-objects book-assets` | bucket empty — NOT TESTED |
| flag propagation | harmless DURABLE flags, 6 parallel probes per sample, behaviour observed through audit rows / shared counter | single change 18–38 s, uniform; sequential changes applied one by one (partial state at +55 s) |
| token revocation | revoke probe token | next request 401 — PASS |
| cleanup | exact-id deletes; follower row created by the test removed | 0 leftovers; trees identical to the 20/10 snapshot |

Local (no database): website `tsc -b`, `vite build`, oxlint 36 -> 36 (HEAD with project config also 36); reader-integration 17/17, reader-page, soft-delete, rollback suites pass with all three patches; `editor-save.test.ts` 9/9 (and 6/9 FAIL on the original `src/`, proving the regression tests detect the bug); patch application matrix in git repositories: all orders OK.
