# mcp/: DevBook MCP server and RLS hardening (development on branch `v2`)

Nothing in this folder is deployed or applied to any database. `src/` (the website) is unchanged. Start with `ANTIGRAVITY-PROMPT.md` if you are an AI agent, otherwise with `proposals/rls-hardening/final/HANDOFF.md`.

| Path | What it is | State |
|---|---|---|
| `devbook-mcp/` | the MCP server (one Edge Function file `handler.ts`), token table SQL, 31 tests | tested locally only |
| `hello-mcp/` | earlier runtime probe (echo tool, no DB) | probe, not deployed |
| `tools/` | `mcp-token.mjs` (mints a token, prints only its hash as SQL), `redact.mjs`, `anon-read-probe.mjs` (read-only production probe, run manually) | local |
| `proposals/rls-hardening/final/` | FINAL SQL set 01-05 + rollbacks, sandbox oracle and tests, `run-local-checks.sh`, `HANDOFF.md` (13-phase real-backend verification plan) | proposal, not applied |
| `proposals/rls-hardening/` (parent) | earlier drafts, website patches (`frontend-*.patch`, apply with `git apply` only, order in `verify-patch-order.sh`), reader tests, reports `FOLLOWUP-REPORT.md`, `READER-INTEGRATION.md`, `TEST-PLAN.md`, preflight scripts, API check scripts | proposals, not applied |
| `proposals/reader-leak-fix/` | first client-side reader fix proposal (superseded by the reader function) | proposal |
| `../context/mcp-*.md` | original feasibility/design documents and the phase 2A checklist | design |

Rules that apply to everything here: production app key `6ktij8hk` is never a target of tests; PostgreSQL scripts only run against a local disposable server; API scripts need `EXPECTED_TEST_APPKEY` of a separate test project; no secrets in files (tokens, keys, connection strings); the branch model is `main` = production, `v1` frozen, `v2` development.
