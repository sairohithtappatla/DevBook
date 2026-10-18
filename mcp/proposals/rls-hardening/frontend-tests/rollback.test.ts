import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useUpdateBook } from "@/hooks/useBooks";
import { calls, control } from "@/services/db";
import { ACCESS_LEVELS, SELECTABLE_ACCESS_LEVELS, visibilityLabel, readerVisibility, isAccessLevel } from "@/lib/access-level";

const qc = new QueryClient();
let mutateAsync: any;
function Probe() { mutateAsync = useUpdateBook().mutateAsync; return null; }
renderToString(createElement(QueryClientProvider, { client: qc }, createElement(Probe)));

const book = { id: "b1", title: "Keep me", access_level: "PUBLIC" };
const other = { id: "b2", title: "Other", access_level: "PRIVATE" };
const seed = () => { qc.setQueryData(["book", "b1"], { ...book }); qc.setQueryData(["books"], [{ ...book }, { ...other }]); };
const lvl = () => (qc.getQueryData(["book", "b1"]) as any).access_level;
const listLvl = () => (qc.getQueryData(["books"]) as any[]).map((b) => b.access_level);

// every database value is writable and has a label
for (const v of ACCESS_LEVELS) { assert.ok(isAccessLevel(v)); assert.notEqual(visibilityLabel(v), "Unknown"); assert.equal(readerVisibility(v), ({ PUBLIC: "public", UNLISTED: "unlisted", PRIVATE: "private", FOLLOWERS_ONLY: "followers", SELECTED_USERS: "selected" } as const)[v]); }
assert.deepEqual([...SELECTABLE_ACCESS_LEVELS].sort(), ["FOLLOWERS_ONLY", "PRIVATE", "PUBLIC", "UNLISTED"]);
assert.equal(visibilityLabel("FOLLOWERS"), "Unknown");            // the old wrong value is not silently accepted
assert.equal(visibilityLabel("SELECTED"), "Unknown");
assert.equal(readerVisibility("bogus"), "private");               // unknown fails closed

// success: optimistic value shows while pending, payload contains ONLY access_level
for (const v of ["UNLISTED", "FOLLOWERS_ONLY", "SELECTED_USERS", "PRIVATE", "PUBLIC"] as const) {
  seed(); control.fail = false; calls.length = 0;
  const p = mutateAsync({ bookId: "b1", updates: { access_level: v } });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(lvl(), v, `optimistic ${v}`);
  await p;
  assert.deepEqual(Object.keys(calls[0].updates), ["access_level"]);
  assert.equal(lvl(), v);
}
// failure: both caches roll back, the other book is untouched
seed(); control.fail = true;
const p = mutateAsync({ bookId: "b1", updates: { access_level: "FOLLOWERS_ONLY" } });
await new Promise((r) => setTimeout(r, 5));
assert.equal(lvl(), "FOLLOWERS_ONLY"); assert.deepEqual(listLvl(), ["FOLLOWERS_ONLY", "PRIVATE"]);
await assert.rejects(p);
assert.equal(lvl(), "PUBLIC"); assert.deepEqual(listLvl(), ["PUBLIC", "PRIVATE"]);
assert.equal((qc.getQueryData(["book", "b1"]) as any).title, "Keep me");
console.log("rollback + access-level tests: all passed");
process.exit(0);
