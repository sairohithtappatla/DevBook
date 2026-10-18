#!/usr/bin/env bash
# Verifies the application order of the frontend patches on a THROWAWAY copy of src/ (the repo is only read).
#   bash verify-patch-order.sh            (run from anywhere)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
AL="$HERE/frontend-access-level.patch"; RD="$HERE/frontend-reader-integration.patch"; ST="$HERE/frontend-reader-integration.after-access-level.patch"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fresh() { rm -rf "$T/w"; mkdir "$T/w"; cp -r "$REPO/src" "$T/w/src"; (cd "$T/w" && git init -q . && git add -A >/dev/null 2>&1 && git -c user.email=a@b -c user.name=x commit -qm base >/dev/null); }
ap() { (cd "$T/w" && git apply "$1" 2>/dev/null); }
fail=0
expect() { # expect <ok|fail> <description> <patch...> : applies the patches in order on a fresh copy
  local want="$1" desc="$2"; shift 2; fresh; local got=ok
  for p in "$@"; do ap "$p" || { got=fail; break; }; done
  if [ "$got" = "$want" ]; then printf '  ok    %-62s -> %s\n' "$desc" "$got"; else printf '  WRONG %-62s -> %s (wanted %s)\n' "$desc" "$got" "$want"; fail=1; fi
  [ "$got" = ok ] && (cd "$T/w" && find src -type f | sort | xargs sha256sum | sha256sum | cut -c1-16 > "$T/hash.$(echo "$desc" | tr -c 'a-z0-9' _)")
}
echo "Scenario results (ok = applies cleanly, fail = refused atomically; git apply never half-applies):"
expect ok   "reader only"                              "$RD"
expect ok   "access-level only"                        "$AL"
expect ok   "access-level, then STACKED reader"        "$AL" "$ST"
expect fail "access-level, then PLAIN reader"          "$AL" "$RD"
expect fail "STACKED reader on a tree without access-level" "$ST"
expect fail "plain reader, then stacked reader"        "$RD" "$ST"
expect fail "plain reader applied twice"               "$RD" "$RD"
expect fail "stacked reader applied twice"             "$AL" "$ST" "$ST"
expect fail "access-level applied twice"               "$AL" "$AL"
fresh; ap "$RD" && if ap "$AL"; then echo "  ok    plain reader, then access-level                              -> ok"; else echo "  ok    plain reader, then access-level                              -> fail (refused, no overlap overwrite)"; fi
echo
echo "Content of the combined result (access-level, then stacked):"
fresh; ap "$AL"; ap "$ST"
(cd "$T/w" && for needle in "src/lib/access-level.ts:SELECTABLE_ACCESS_LEVELS" "src/lib/reader-tree.ts:parseReaderTree" "src/services/db.ts:getReaderTree" "src/services/db.ts:AccessLevel" "src/routes/books/BookEditorPage.tsx:VISIBILITY_ICONS" "src/routes/books/BookReaderPage.tsx:useReaderBook" "src/routes/books/BookReaderPage.tsx:readerVisibility" "src/hooks/useBooks.ts:useReaderBook"; do f="${needle%%:*}"; s="${needle##*:}"; if grep -q "$s" "$f"; then echo "  ok    $f contains $s"; else echo "  WRONG $f lacks $s"; fail=1; fi; done)
echo
[ $fail -eq 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit $fail
