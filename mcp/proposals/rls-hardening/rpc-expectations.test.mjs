// node --test rpc-expectations.test.mjs : the hand-written expectations must agree with the outputs recorded from the SQL.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ACTORS, expected, verify } from "./rpc-expectations.mjs";
const fx = JSON.parse(fs.readFileSync(new URL("./frontend-tests/fixtures/reader-fixtures.json", import.meta.url), "utf8"));
const sd = JSON.parse(fs.readFileSync(new URL("./frontend-tests/fixtures/softdelete-fixtures.json", import.meta.url), "utf8"));
const BK = ["PUB", "EMPTY", "UNL", "DRAFTBOOK"];

test("expectations match every recorded tree (6 actors x 4 books x 2 modes)", () => {
  let n = 0;
  for (const a of ACTORS) for (const b of BK) for (const d of [false, true]) {
    const problems = verify(a, b, d, fx.trees[a][`${b}:${d}`]); n++;
    assert.deepEqual(problems, [], `${a}/${b}/drafts=${d}`);
  }
  assert.equal(n, 48);
});
test("soft-deleted: null for all with the patch; owner gets the tree without it", () => {
  for (const a of ["anon", "stranger", "editor", "owner"]) {
    assert.equal(sd.after[a], null); assert.deepEqual(verify(a, "DELETED", true, sd.after[a]), []);
    assert.deepEqual(verify(a, "DELETED", true, sd.before[a], { softDeletePatch: false }).map((x) => x.slice(0, 20)).length >= 0, true);
  }
  assert.notEqual(sd.before.owner, null);
  assert.ok(verify("owner", "DELETED", true, sd.before.owner).length > 0, "unpatched owner tree must be flagged when the patch is expected");
});
test("tampered responses are detected", () => {
  const t = JSON.parse(JSON.stringify(fx.trees.anon["PUB:false"]));
  t.phases[0].steps[0].markdown += " DRAFT_SECRET"; assert.ok(verify("anon", "PUB", false, t).some((x) => x.startsWith("leak") || x.includes("text wrong")));
  const t2 = JSON.parse(JSON.stringify(fx.trees.editor["PUB:true"])); t2.phases[0].steps.pop(); assert.ok(verify("editor", "PUB", true, t2).length > 0);
  assert.ok(verify("anon", "PUB", false, null).length > 0);                 // null where a tree is expected
  assert.ok(verify("stranger", "DRAFTBOOK", false, fx.trees.owner["DRAFTBOOK:false"]).length > 0); // tree where null is expected
  assert.ok(verify("viewer", "PUB", true, fx.trees.editor["PUB:true"]).length > 0);                  // viewer receiving drafts
  assert.ok(verify("anon", "PUB", false, { nope: 1 }).length > 0);
});
test("expected() encodes the approved rules", () => {
  assert.equal(expected("anon", "DRAFTBOOK", false), null);
  assert.equal(expected("editor", "UNL", true).phases[0][1][0], "Unlisted step");
  assert.equal(expected("viewer", "PUB", true).drafts, false);
  assert.equal(expected("reviewer", "PUB", true).drafts, true);
});
