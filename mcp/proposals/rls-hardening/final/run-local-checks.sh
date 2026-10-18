#!/usr/bin/env bash
# Runs every LOCAL check of the DevBook MCP / RLS hardening work and prints a PASS/FAIL table.
# Touches no InsForge project and no remote database: PostgreSQL must be a disposable LOCAL instance (the scripts refuse
# any other PGHOST). It never modifies the repository (frontend checks run on a throwaway copy of src/).
#
#   PG_MODULE=<node_modules dir containing pg>  PGPORT=54329  DENO=<deno binary>  [DENO_DIR=<cache>]
#   FE_NODE_MODULES=<node_modules of the website (react, vite, typescript, @tanstack/react-query, oxlint)>
#   [PARSER_DIR=<node_modules dir containing libpg-query>]  bash run-local-checks.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; RLS="$(cd "$HERE/.." && pwd)"; MCP="$(cd "$RLS/../../devbook-mcp" && pwd)"; REPO="$(cd "$RLS/../../.." && pwd)"
: "${PG_MODULE:?set PG_MODULE}"; : "${DENO:?set DENO}"; export PGHOST=127.0.0.1 PGPORT="${PGPORT:-54329}" PGUSER=postgres PG_MODULE
ROWS=(); fails=0
run() { # run <name> <command...>  (output kept in $LOG/<n>.log)
  local name="$1"; shift; local n=$(( ${#ROWS[@]} + 1 )); local log="$LOG/$n.log"
  if "$@" >"$log" 2>&1; then ROWS+=("PASS  $name"); else ROWS+=("FAIL  $name   (see $log)"); fails=$((fails+1)); fi
}
skip() { ROWS+=("SKIP  $1 ($2)"); }
LOG="$(mktemp -d)"; echo "logs: $LOG"

# 0. the PostgreSQL must be local and reachable
run "local PostgreSQL reachable on 127.0.0.1:$PGPORT" node -e 'const pg=require(require("path").join(process.env.PG_MODULE,"pg"));const c=new pg.Client({host:"127.0.0.1",port:+process.env.PGPORT,user:"postgres",database:"postgres"});c.connect().then(()=>c.query("show server_version")).then(r=>{console.log(r.rows[0].server_version);return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})'

# 1. SQL parser check
if [ -n "${PARSER_DIR:-}" ]; then
  run "SQL parses (final set, rollbacks, mcp_tokens)" node -e 'const q=require(require("path").join(process.env.PARSER_DIR,"libpg-query"));const fs=require("fs");(async()=>{await q.loadModule();let bad=0;for(const d of ["'"$HERE"'","'"$MCP"'/sql"])for(const f of fs.readdirSync(d).filter(x=>x.endsWith(".sql"))){try{q.parseSync(fs.readFileSync(d+"/"+f,"utf8"))}catch(e){bad++;console.error(f,e.message)}}process.exit(bad?1:0)})()'
else skip "SQL parse check" "PARSER_DIR not set"; fi

# 2. SQL behaviour in the sandbox (native PostgreSQL)
(cd "$HERE/sandbox" && true)
run "04_helper_guard.sql is in sync with 01/02 (check-04-drift.mjs)" node "$HERE/check-04-drift.mjs"
run "RLS matrix: baseline vs final 01-04, rollback restores everything (final/sandbox/run.mjs)" node "$HERE/sandbox/run.mjs"
run "04 guard also fires without a role switch when a JWT subject exists (final/sandbox/guard-no-role.mjs)" node "$HERE/sandbox/guard-no-role.mjs"
run "F3: a user cannot create a book owned by someone else (final/sandbox/insert-books.mjs)" node "$HERE/sandbox/insert-books.mjs"
run "can_manage_members recursion reproduced and fixed (final/sandbox/recursion.mjs)" env SQL_DIR="$HERE" node "$HERE/sandbox/recursion.mjs"
run "lifecycle + function privileges, default and restrictive grants (sandbox/lifecycle.mjs)" env SQL_DIR="$HERE" node "$RLS/sandbox/lifecycle.mjs"
run "soft-deleted books hidden from the reader function (sandbox/softdelete.mjs)" env SQL_DIR="$HERE" EXPECT=patched node "$RLS/sandbox/softdelete.mjs"
run "progress reset: which rows survive (sandbox/progress-reset.mjs)" env SQL_DIR="$HERE" node "$RLS/sandbox/progress-reset.mjs"
run "grants report + rollback leaves no function behind (sandbox/grants-report.mjs)" env SQL_DIR="$HERE" node "$RLS/sandbox/grants-report.mjs"
run "grants report, restrictive default privileges" env SQL_DIR="$HERE" RESTRICTIVE=1 node "$RLS/sandbox/grants-report.mjs"

# 3. MCP server
export DENO_DIR="${DENO_DIR:-$HOME/.cache/deno}"
run "MCP: deno check handler.ts" bash -c "cd '$MCP' && '$DENO' check handler.ts"
run "MCP: deno lint handler.ts (no-import-prefix/no-explicit-any excluded: single-file deploy)" bash -c "cd '$MCP' && '$DENO' lint --rules-exclude=no-import-prefix,no-explicit-any handler.ts"
run "MCP: unit tests with in-memory store + store-on-PostgreSQL integration tests" bash -c "cd '$MCP' && '$DENO' test --allow-net=127.0.0.1 --allow-env --allow-read=./handler.ts,./sql,../proposals/rls-hardening/final,../proposals/rls-hardening/sandbox tests/"
run "MCP: token tool tests (mcp/tools/mcp-token.test.mjs)" node --test "$REPO/mcp/tools/mcp-token.test.mjs"
run "RPC contract expectations vs recorded SQL output (rpc-expectations.test.mjs)" node --test "$RLS/rpc-expectations.test.mjs"

# 4. website patches on a throwaway copy of src/
run "patch application order matrix (verify-patch-order.sh)" bash "$RLS/verify-patch-order.sh"
if [ -n "${FE_NODE_MODULES:-}" ] && [ -d "$FE_NODE_MODULES" ]; then
  W="$(mktemp -d)"; cp -r "$REPO/src" "$REPO/public" "$REPO/index.html" "$REPO/package.json" "$REPO"/tsconfig*.json "$REPO/vite.config.ts" "$REPO/.oxlintrc.json" "$W/" 2>/dev/null
  ln -s "$FE_NODE_MODULES" "$W/node_modules"; (cd "$W" && printf 'node_modules\n' > .gitignore && git init -q . && git add -A >/dev/null 2>&1 && git -c user.email=a@b -c user.name=x commit -qm base >/dev/null)
  FE() { (cd "$W" && "$@"); }
  run "website: base src type-checks" FE node_modules/.bin/tsc -b
  run "website: apply access-level patch, then stacked reader patch (git apply)" FE bash -c "git apply '$RLS/frontend-access-level.patch' && git apply '$RLS/frontend-reader-integration.after-access-level.patch'"
  run "website (combined patches): tsc -b" FE node_modules/.bin/tsc -b
  run "website (combined patches): vite build" FE node_modules/.bin/vite build
  base=$(cd "$W" && git stash -q -u -- src && node_modules/.bin/oxlint src 2>&1 | grep -c '^src.*\(warning\|error\)'; cd "$W" && git stash pop -q)
  now=$(cd "$W" && node_modules/.bin/oxlint src 2>&1 | grep -c '^src.*\(warning\|error\)')
  run "website (combined patches): oxlint warnings not above base ($base -> $now)" test "$now" -le "$base"
  mkdir -p "$W/t" && cp -r "$RLS/frontend-tests/"* "$W/t/"
  for pair in "reader-integration.test.ts out-a" "reader-page.test.tsx out-b" "softdelete.test.ts out-c"; do set -- $pair
    run "website (combined patches): $1" FE bash -c "node t/build-test.mjs $1 $2 && node t/$2/*.js"; done
  run "website (combined patches): access-level + optimistic rollback (real useUpdateBook)" FE bash -c "node t/build.mjs && node t/out/rollback.test.js"
else skip "website checks (tsc, build, lint, reader/soft-delete/rollback tests)" "FE_NODE_MODULES not set"; fi

# 5. safety: scripts refuse non-local databases and the production project
run "sandbox scripts refuse a non-local PGHOST" bash -c 'for f in '"$HERE"'/sandbox/run.mjs '"$HERE"'/sandbox/recursion.mjs '"$RLS"'/sandbox/*.mjs '"$RLS"'/frontend-tests/generate-*.mjs; do out=$(PGHOST=db.example.com PG_MODULE=/x node "$f" 2>&1 | head -1); case "$out" in Refusing*) ;; *) echo "NOT REFUSED: $f: $out"; exit 1;; esac; done'
run "API scripts refuse production / unnamed project (exposure-check, rpc-contract-check, guard)" bash -c '
for f in '"$RLS"'/exposure-check.mjs '"$RLS"'/rpc-contract-check.mjs; do
  for e in "EXPECTED_TEST_APPKEY=6ktij8hk TEST_URL=https://6ktij8hk.ap-southeast.insforge.app" "TEST_URL=https://tst12345.ap-southeast.insforge.app" "EXPECTED_TEST_APPKEY=other999 TEST_URL=https://tst12345.ap-southeast.insforge.app"; do
    out=$(env CONFIRM_TEST_PROJECT=yes TEST_ANON_KEY=x BOOKS_JSON="{}" $e node "$f" 2>&1 | head -1); case "$out" in Refusing*) ;; *) echo "NOT REFUSED: $f $e: $out"; exit 1;; esac; done; done
d=$(mktemp -d); mkdir -p $d/.insforge; echo "{\"oss_host\":\"https://6ktij8hk.ap-southeast.insforge.app\"}" > $d/.insforge/project.json
(cd $d && EXPECTED_TEST_APPKEY=tst12345 node '"$RLS"'/preflight/guard.mjs >/dev/null 2>&1) && { echo "guard accepted the production folder"; exit 1; }; exit 0'

[ "${#ROWS[@]}" -gt 0 ] || { echo "no check ran"; exit 1; }
echo; echo "================ RESULT ================"; printf '%s\n' "${ROWS[@]}"; echo "failures: $fails"; exit $((fails>0))
