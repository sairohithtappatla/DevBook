# DevBook MCP — TEST Release Runbook (devbook-rls-test only)

Target: InsForge project **devbook-rls-test**, id `2a222ddf-f2a8-4307-91d4-6177fa473381`, app key **393cz2pc**, region
ap-southeast, function slug `devbook-mcp`, URL `https://393cz2pc.function2.insforge.app/devbook-mcp`.
Never production (`6ktij8hk`). Every step marked **[APPROVAL]** needs the owner's explicit go for that step.
Commands marked **CONFIRMED** were run successfully on TEST on 2026-10-20 (read-only ones); **PROPOSED** ones exist in the CLI
help but have not been run for this purpose yet. All commands run from `D:\Project\devbook-test` (linked to TEST).

## 0. Preflight (read-only, CONFIRMED)
```
EXPECTED_TEST_APPKEY=393cz2pc node mcp/proposals/rls-hardening/preflight/guard.mjs      # must print GUARD OK
npx -y @insforge/cli current                                                            # project devbook-rls-test / 393cz2pc
npx -y @insforge/cli functions list                                                     # devbook-mcp active
npx -y @insforge/cli functions code devbook-mcp > <scratch>/before.ts                   # keep: function rollback source
npx -y @insforge/cli secrets list                                                       # names only
git rev-parse HEAD; git status --short                                                  # record the source identity
```
Expected safe state: `DEVBOOK_MCP_WRITE_TOOLS=false`, `DEVBOOK_MCP_PUBLISH_TOOL=false`, durable flags absent/false.
**Abort** if the guard fails, the project differs, or the working tree is not the reviewed commit.

## 1. Backup [APPROVAL] (PROPOSED)
`npx -y @insforge/cli backups create --name pre-mcp-remediation --wait` — record the backup id.

## 2. Database changes on TEST [APPROVAL per file] (PROPOSED method)
Order: `final/02b_legacy_step_freeze.sql` -> [`final/02c_optional_freeze_published_without_text.sql` ONLY on an explicit decision]
-> `final/07_strict_reader_rule.sql` -> `final/06_pin_trigger_search_path.sql` -> `mcp/devbook-mcp/sql/002_mcp_ops.sql`.
Each file is one transaction; stop at the first error.
TEST expectations (read-only inspection 2026-10-20): 02b freezes exactly ONE step, `670a198b-00e9-468f-a2d1-724f6371144f`
("Legacy step", Fixture Public, no status, unchanged since the seed). Step `d2eefe86-f004-403c-adbc-db14452dab9b` ("Step of a
draft book", Fixture Draft = DRAFT book, status Published, publishedMarkdown deleted by the editor bug F21) is NOT frozen; 07
reports "1 step(s) … no longer served to readers" for it. Its book is DRAFT, so only members could see it before; afterwards the
owner sees it in draft mode only. The recorded contract expectation "owner sees the DRAFTBOOK step in non-draft mode" will then
differ by design (or restore the seeded `publishedMarkdown` of that test step deliberately, a separate approved data repair).
Method (CONFIRMED on TEST 2026-10-20): `db import` is FORBIDDEN on this project and `db query` rejects BEGIN/COMMIT. Use the
migration workflow, which runs each file as `project_admin` inside one transaction:
```
F=$(npx -y @insforge/cli db migrations new <name> | grep -oE '[0-9]{14}_<name>\.sql')
grep -vxE 'BEGIN;|COMMIT;' <reviewed file> > migrations/$F && diff <reviewed file> migrations/$F   # only BEGIN;/COMMIT; may differ
npx -y @insforge/cli db migrations up $F
```
Checks after each file (read-only SELECTs):
- 02b: NOTICE "froze 1 legacy step(s)"; `_rls02b_step_freeze_backup` has exactly step 670a198b…; anonymous `reader_book_tree` of Fixture Public identical to before.
- 07: NOTICE "1 step(s) marked Published without published text …"; `reader_markdown` body has no `markdown` fallback; the anonymous Fixture Public tree still identical.
- 06: `trigger_add_book_owner` config `search_path=public, pg_temp`.
- 002: tables `mcp_rate_limits`, `mcp_audit_events` exist, RLS on, no anon/authenticated privileges; `mcp_rate_take` not executable by anon/authenticated; executable by the function's role (confirm with a `db rpc`-free test in step 5).

## 3. Deploy the remediated function [APPROVAL] (PROPOSED)
```
npx -y @insforge/cli functions deploy devbook-mcp --file mcp/devbook-mcp/handler.ts --description "DevBook MCP (test)"
npx -y @insforge/cli functions code devbook-mcp > <scratch>/after.ts   # then: diff --strip-trailing-cr after.ts handler.ts -> identical
```
Flags stay OFF. **Flag changes (F23, measured 2026-10-20):** the platform restarts the function per secret update with the
config of that moment; one change becomes live on all instances after ~20–40 s, several quick changes are applied one after
another (up to ~90 s, partial states in between). So: change ONE flag at a time, then sample ≥6 parallel `tools/list` (or
behaviour) probes until every sample shows the new state; redeploying the identical file forces a fresh config immediately.
For an emergency stop, revoke tokens first (effective on the next request), then turn flags off. Credential secrets are changed by
the owner in their own terminal; values are never pasted into chat or files.

## 4. Smoke (no token, CONFIRMED script)
`EXPECTED_TEST_APPKEY=393cz2pc MCP_URL=https://393cz2pc.function2.insforge.app/devbook-mcp node mcp/tools/remote-verify.mjs`
Expect 4 PASS including `x-request-id` (proves the new code is live).

## 5. Tokens [APPROVAL] and read-only authenticated suite
1. Mint one READ-only token per role (`owner|editor|reviewer|viewer|stranger@example.invalid`), 1 day:
   `node mcp/tools/mcp-token.mjs --email owner@example.invalid --label rv-owner --scopes read,draft,publish --days 1` (owner needs
   draft+publish for later steps; others `read,draft`). The script prints the token once to stderr and SQL (hash only) to stdout;
   the owner runs the SQL with `npx -y @insforge/cli db query "<sql>"` and keeps the tokens in environment variables.
2. `DBK_OWNER=… DBK_EDITOR=… DBK_REVIEWER=… DBK_VIEWER=… DBK_STRANGER=… [DBK_OWNER2=…] node mcp/tools/remote-verify.mjs` (read-only).

## 6. Writes, then publish, then burst [APPROVAL each]
1. Owner sets `DEVBOOK_MCP_WRITE_TOOLS=true`; run `… remote-verify.mjs --writes --expect-legacy=migrated` (after 02b; use
   `refused` if 02b was not applied). Creates phases/steps titled `rv-<run id>` in Fixture Public only.
2. Owner sets `DEVBOOK_MCP_PUBLISH_TOOL=true`; run `… --writes --publish` (needs `DBK_OWNER2` for the cross-token check).
3. Owner sets `DEVBOOK_MCP_DURABLE_LIMITS=true` and `DEVBOOK_MCP_DURABLE_AUDIT=true`; run `… --burst=150`; expect `RATE_LIMITED`
   after 120 reads per minute; check `select tool, outcome, count(*) from mcp_audit_events group by 1,2`.
4. Immediately afterwards: WRITE/PUBLISH flags back to `false`.

## 7. Real MCP client (owner runs it; token from step 5, read scope)
Claude Code:
```
claude mcp add --transport http devbook-test https://393cz2pc.function2.insforge.app/devbook-mcp --header "Authorization: Bearer ${DEVBOOK_TEST_TOKEN}"
claude mcp list            # devbook-test connected
# in a session: "list my DevBook books" -> search_books; "show the structure of Fixture Public" -> get_book_structure
claude mcp remove devbook-test
```
MCP Inspector: `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, URL above, header `Authorization: Bearer …`;
Connect -> List Tools -> call `search_books`. claude.ai / ChatGPT: custom headers are not generally available; they need OAuth
(not implemented).

## 8. Cleanup and credential hygiene [APPROVAL]
- Revoke every token minted for the run: `node mcp/tools/mcp-token.mjs --revoke-prefix <8 chars>` -> run the printed SQL; also the 2 older active tokens.
- Remove disposable content: the SQL printed by `remote-verify.mjs` (`delete from public.phases where title like 'rv-<run>%';`).
- Rotation: new value set by the owner with `secrets update DEVBOOK_MCP_API_KEY` / `DEVBOOK_MCP_CONFIRM_KEY` (the latter invalidates pending confirmations); if the project `API_KEY` is rotated, update `DEVBOOK_MCP_API_KEY` before the grace period ends and re-run step 4 (a 503 "Authentication backend unavailable" means the key is stale).

## 9. Rollback
| Problem | Action | Notes |
|---|---|---|
| any write/publish misbehaviour | set WRITE/PUBLISH flags `false` (instant, no deploy) | tools disappear from `tools/list` |
| function misbehaves | redeploy `before.ts` (step 0) with `functions deploy … --file before.ts`; then step 4 | the old code reads with the LEGACY rule: on a database with 07 it may show a viewer an un-frozen legacy step the database hides (after 02b there are none on TEST) |
| a token leaked | revoke it (step 8); rotate `DEVBOOK_MCP_CONFIRM_KEY` | effective on the next request |
| durable flags cause errors | set them `false` first, then `002_rollback.sql` (exports/destroys the audit trail) | writes fail closed while the limit function is missing and the flag is on |
| database | `06_rollback` -> `07_rollback` -> `02b_rollback` (each independent of the function); 01–04 rollbacks per `final/PRODUCTION-RUNBOOK.md` | `02b_rollback` leaves steps published after the freeze alone |
| emergency | `functions delete devbook-mcp` only with explicit confirmation (destructive) | backup from step 1 restores the database (overwrites later data) |

## 10. Abort criteria
Guard/identity mismatch; deployed code ≠ reviewed file; any FAIL in step 4/5; any draft marker visible to viewer/stranger; a
write succeeding for viewer/reviewer; publish succeeding for an editor; `INTERNAL` responses; tokens or Markdown in logs.

## 11. Production
Nothing in this runbook touches production. The MCP production release needs the go/no-go list in
`context/mcp-production-readiness.md` §4 to be all PASS, after the database go-live (`final/PRODUCTION-RUNBOOK.md`).
