// Reader integration tests. They run the REAL src/services/db.ts, src/lib/reader-tree.ts and src/hooks/useBooks.ts
// against a stub of the InsForge client that replays outputs recorded from the real SQL (see generate-fixtures.mjs).
// NOT covered (needs a real backend): the actual HTTP/RPC envelope of InsForge, JWT/role handling, RLS in the live project.
import assert from "node:assert/strict";
import fx from "./fixtures/reader-fixtures.json";
import { DBService } from "@/services/db";
import { parseReaderTree, treeToBook, treeToStructure, treeStepIds } from "@/lib/reader-tree";
import { control, calls, reset } from "@/lib/insforge";
import { legacyStructure } from "./legacy-structure";

const F: any = fx;
const B = F.ids.books, S = F.ids.steps, U = F.ids.users;
const MARKERS = ["DRAFT_SECRET", "DRAFT-EDIT", "draft.pdf"];
let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { reset(); control.actor = "anon"; await fn(); passed++; console.log("  ok  ", name); }
  catch (e: any) { failed++; console.log("  FAIL", name, "\n      ", String(e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const stepIds = (tree: any) => treeStepIds(tree).sort();
const sorted = (a: string[]) => [...a].sort();
const leaks = (v: unknown) => MARKERS.filter((m) => JSON.stringify(v).includes(m));

console.log("reader data contract (from recorded SQL output):");
await test("public published reader (anon): only published steps, published text, no draft markers", async () => {
  const tree = await DBService.getReaderTree(B.PUB, true);
  assert.ok(tree);
  assert.deepEqual(stepIds(tree), sorted([S[1], S[3]]));
  assert.deepEqual(leaks(tree), []);
  const phases = treeToStructure(tree!);
  assert.deepEqual(phases.map((p) => p.title), ["Phase A", "Phase B"]); // empty phase C and draft-only phase D are not shown
  assert.equal(phases[0].steps[0].markdown, "PUB-1 published text");
  assert.equal(phases[0].steps[0].status, "Published");
  assert.equal(phases[1].steps[0].markdown, "LEGACY text of a step without status"); // legacy rule, book is PUBLISHED
  assert.equal(calls.rpc[0].args.include_drafts, true); // requested, ignored by the function for non-draft viewers
});
await test("book fields the reader page uses survive the mapping", async () => {
  const b = treeToBook((await DBService.getReaderTree(B.PUB))!);
  assert.equal(b.title, "Public Book"); assert.equal(b.slug, "public-book"); assert.equal(b.description, "Public Book description");
  assert.deepEqual(b.tags, ["tagA", "tagB"]); assert.equal(b.access_level, "PUBLIC"); assert.equal(b.publication_status, "PUBLISHED");
  assert.equal(b.created_by, U.owner); assert.equal(b.creator?.name, "Author owner"); assert.equal(b.creator?.avatar_url, "https://img.invalid/owner.png"); assert.equal(b.creator?.bio, "bio of owner");
  assert.ok(b.updated_at && b.created_at);
});
await test("authorized members (owner, editor, reviewer) get draft steps; markdown follows the old reader rule", async () => {
  for (const actor of ["owner", "editor", "reviewer"]) {
    control.actor = actor;
    const tree = (await DBService.getReaderTree(B.PUB, true))!;
    assert.deepEqual(stepIds(tree), sorted([S[1], S[2], S[3], S[4]]), actor);
    const st = treeToStructure(tree);
    const s1 = st[0].steps[0], s2 = st[0].steps[1];
    assert.equal(s1.markdown, "PUB-1 published text", actor);          // published text wins when it exists
    assert.equal(s1.publishedMarkdown, "PUB-1 published text");
    assert.match(s2.markdown, /DRAFT_SECRET/);                          // never published: current text, as before
    assert.equal(s2.publishedMarkdown, undefined);
    assert.equal(s2.status, "Draft");
    assert.equal(st.at(-1)!.title, "Phase D (draft only)");
    assert.equal(st[0].steps[1].attachments.map((a) => a.file_name)[0], "draft.pdf");
  }
});
await test("viewer and stranger never receive drafts, even with include_drafts=true", async () => {
  for (const actor of ["viewer", "stranger", "anon"]) {
    control.actor = actor;
    const tree = await DBService.getReaderTree(B.PUB, true);
    assert.deepEqual(stepIds(tree), sorted([S[1], S[3]]), actor);
    assert.deepEqual(leaks(tree), [], actor);
    assert.deepEqual(tree!.phases[0].steps[0].attachments.map((a) => a.file_name), ["pub.pdf"], actor);
  }
});
await test("no access and missing books map to null (stranger on draft book, random id)", async () => {
  control.actor = "stranger";
  assert.equal(await DBService.getReaderTree(B.DRAFTBOOK), null);
  assert.equal(await DBService.getReaderTree("00000000-0000-0000-0000-000000000099"), null);
  control.actor = "editor"; // a member of PUB only
  assert.equal(await DBService.getReaderTree(B.DRAFTBOOK), null);
});
await test("unlisted book opens by id for anyone (direct link)", async () => {
  const tree = (await DBService.getReaderTree(B.UNL))!;
  assert.equal(tree.book.access_level, "UNLISTED"); assert.deepEqual(stepIds(tree), [S[5]]);
});
await test("empty book: tree has no phases, structure is [] (reader shows its 'No phases' state)", async () => {
  const tree = (await DBService.getReaderTree(B.EMPTY))!;
  assert.deepEqual(tree.phases, []); assert.deepEqual(treeToStructure(tree), []); assert.deepEqual(treeStepIds(tree), []);
  assert.equal(treeToBook(tree).title, "Empty Book");
});
await test("parity: tree-derived steps equal the OLD getBookStructure(reader) objects, except `status`/`publishedMarkdown` of legacy steps", async () => {
  for (const actor of ["anon", "editor"]) {
    control.actor = actor;
    const tree = (await DBService.getReaderTree(B.PUB))!;
    const visible = new Set(treeStepIds(tree));
    const phases = F.raw.phases.filter((p: any) => p.book_id === B.PUB);
    const old = legacyStructure(phases, F.raw.steps.filter((s: any) => visible.has(s.id))).filter((p: any) => p.steps.length > 0);
    const now = JSON.parse(JSON.stringify(treeToStructure(tree).map((p) => ({ ...p, steps: p.steps.map(({ attachments: _attachments, ...rest }) => rest) }))));
    assert.deepEqual(now.map((p: any) => [p.id, p.title, p.steps.map((s: any) => s.id)]), old.map((p: any) => [p.id, p.title, p.steps.map((s: any) => s.id)]), actor + " structure");
    for (const [pi, p] of now.entries()) for (const [si, s] of p.steps.entries()) {
      const o = old[pi].steps[si];
      const { status: ns, ...nrest } = s; const { status: os, ...orest } = o;
      const rawContent = F.raw.steps.find((r: any) => r.id === s.id).content;
      const raw = rawContent.status;
      // Same for a legacy step seen by a non-draft reader: the function reports its text as publishedMarkdown too.
      if (actor === "anon" && rawContent.publishedMarkdown === undefined) { assert.equal(nrest.publishedMarkdown, nrest.markdown); delete (nrest as any).publishedMarkdown; delete (orest as any).publishedMarkdown; }
      assert.deepEqual(nrest, JSON.parse(JSON.stringify(orest)), `${actor} ${s.title}`);
      // The old mapping reported "Draft" for a legacy step without status; the function reports what the reader renders.
      assert.equal(ns, raw === undefined && actor === "anon" ? "Published" : os, `${actor} ${s.title} status`);
    }
  }
});
await test("defaults match the old mapping (missing slug/description/difficulty/time/visibility)", () => {
  const tree = parseReaderTree({ book: { id: "b", creator: null }, phases: [{ id: "p", title: "P", position: 1, steps: [{ id: "s", title: "T", position: 1, slug: null, description: null, difficulty: null, estimatedTime: null, visibility: null, status: "Published", markdown: "m", publishedMarkdown: "m", attachments: [] }] }] })!;
  const s = treeToStructure(tree)[0].steps[0];
  assert.deepEqual([s.slug, s.description, s.difficulty, s.estimatedTime, s.visibility], ["", "", "Beginner", 10, "Public"]);
  assert.equal(treeToBook(tree).creator, null);
});
await test("unexpected response shapes fail loudly instead of rendering a wrong book", async () => {
  for (const bad of [[], "x", { book: {}, phases: [] }, { book: { id: "b" } }, { book: { id: "b" }, phases: [{ id: "p" }] }]) {
    control.rpcOverride = () => ({ data: bad, error: null });
    await assert.rejects(DBService.getReaderTree(B.PUB), /Unexpected reader_book_tree response/);
  }
  control.rpcOverride = () => ({ data: null, error: new Error("rpc failed") });
  await assert.rejects(DBService.getReaderTree(B.PUB), /rpc failed/);
});

console.log("step counts:");
await test("default counts for readers come from reader_book_step_counts (published only; unlisted/empty/draft books absent)", async () => {
  for (const actor of ["anon", "stranger", "viewer"]) {
    control.actor = actor;
    const c = await DBService.getStepCounts(Object.values(B) as string[]);
    assert.deepEqual(c, { [B.PUB]: 2 }, actor);
    assert.equal(c[B.EMPTY] || 0, 0);
  }
  assert.ok(calls.selects.every((s) => s.table === "reader_book_step_counts"), "no direct phases/steps read for readers");
});
await test("includeDrafts counts draft steps for owner/editor/reviewer (max of view and base-table embed)", async () => {
  for (const actor of ["owner", "editor", "reviewer"]) {
    control.actor = actor;
    const c = await DBService.getStepCounts([B.PUB], { includeDrafts: true });
    assert.equal(c[B.PUB], 4, actor); // steps 1,2,3,4
  }
  control.actor = "viewer";
  assert.equal((await DBService.getStepCounts([B.PUB], { includeDrafts: true }))[B.PUB], 2); // a viewer's embed is empty
  control.actor = "anon";
  assert.equal((await DBService.getStepCounts([B.PUB], { includeDrafts: true }))[B.PUB], 2);
});
await test("empty input does not call the backend; a failing view propagates the error", async () => {
  assert.deepEqual(await DBService.getStepCounts([]), {}); assert.equal(calls.selects.length, 0);
  control.failTable = "reader_book_step_counts";
  await assert.rejects(DBService.getStepCounts([B.PUB]), /reader_book_step_counts failed/);
});

console.log("progress / reset-progress ids:");
const delIds = () => calls.deletes.find((d) => d.table === "step_progress")?.filters.find((f) => f.type === "in")?.vals as string[] | undefined;
await test("reset for a reader clears exactly the published step ids and the book_progress row", async () => {
  control.actor = "viewer";
  await DBService.resetBookProgress(U.viewer, B.PUB);
  assert.deepEqual(sorted(delIds()!), sorted([S[1], S[3]]));
  const sp = calls.deletes.find((d) => d.table === "step_progress")!;
  assert.deepEqual(sp.filters.find((f) => f.type === "eq"), { type: "eq", col: "user_id", val: U.viewer });
  const bp = calls.deletes.find((d) => d.table === "book_progress")!;
  assert.deepEqual(bp.filters.map((f) => [f.col, f.val]), [["user_id", U.viewer], ["book_id", B.PUB]]);
  assert.deepEqual(calls.selects.filter((s) => s.table === "phases"), []); // no direct phases/steps reads any more
});
await test("reset for an editor includes draft step ids", async () => {
  control.actor = "editor";
  await DBService.resetBookProgress(U.editor, B.PUB);
  assert.deepEqual(sorted(delIds()!), sorted([S[1], S[2], S[3], S[4]]));
});
await test("reset on an empty or inaccessible book skips step_progress but still clears book_progress", async () => {
  await DBService.resetBookProgress(U.stranger, B.EMPTY);
  assert.equal(delIds(), undefined); assert.equal(calls.deletes.filter((d) => d.table === "book_progress").length, 1);
  reset(); control.actor = "stranger";
  await DBService.resetBookProgress(U.stranger, B.DRAFTBOOK);
  assert.equal(delIds(), undefined); assert.equal(calls.deletes.filter((d) => d.table === "book_progress").length, 1);
});
await test("reset surfaces backend errors (step_progress failure aborts before book_progress)", async () => {
  control.actor = "viewer"; control.failTable = "step_progress";
  await assert.rejects(DBService.resetBookProgress(U.viewer, B.PUB), /step_progress failed/);
  assert.equal(calls.deletes.filter((d) => d.table === "book_progress").length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
