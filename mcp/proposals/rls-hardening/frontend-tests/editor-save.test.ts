// Regression tests for the editor data-integrity fix: autosave must never delete, roll back or implicitly publish
// `publishedMarkdown`. Runs the REAL src/services/db.ts and src/lib/step-content.ts against stub-steps-db.ts.
// SIMULATED database (no InsForge, no RLS): evidence for the client-side write logic only.
//   node t/build-editor.mjs && node t/out-editor/editor-save.test.js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DBService } from "@/services/db";
import { draftContentPatch, mergeStepContent, DRAFT_CONTENT_KEYS } from "@/lib/step-content";
import { db, reset, nextStamp } from "./stub-steps-db";

const BOOK = "b0000000-0000-4000-8000-000000000001", PHASE = "f0000000-0000-4000-8000-000000000001", STEP = "50000000-0000-4000-8000-000000000001";
const results: [string, boolean, string?][] = [];
async function test(name: string, fn: () => Promise<void> | void) { try { await fn(); results.push([name, true]); } catch (e) { results.push([name, false, String((e as Error).message).slice(0, 300)]); } }
function seed(content: Record<string, unknown>) {
  reset();
  db.phases.push({ id: PHASE, book_id: BOOK, title: "P", position: 1 });
  db.steps.push({ id: STEP, phase_id: PHASE, title: "Step", position: 1, content: JSON.parse(JSON.stringify(content)), updated_at: nextStamp() });
}
const row = () => db.steps[0];
// what BookEditorPage's autosave sends (built exactly like the component does)
const autosave = (fields: Record<string, unknown>) => DBService.updateStep(STEP, { title: "Step", position: 1, content: draftContentPatch(fields) });

await test("1 loading a published step returns draft and published Markdown separately", async () => {
  seed({ status: "Published", markdown: "DRAFT v2", publishedMarkdown: "PUBLISHED v1", slug: "s" });
  const [phase] = await DBService.getBookStructure(BOOK, false);
  const s = phase.steps[0];
  assert.equal(s.markdown, "DRAFT v2");
  assert.equal(s.publishedMarkdown, "PUBLISHED v1");
  // and the editor keeps it in state (the mapping in BookEditorPage.tsx copies the field)
  const src = fs.readFileSync(path.join(process.cwd(), "src/routes/books/BookEditorPage.tsx"), "utf8");
  assert.match(src, /publishedMarkdown: s\.publishedMarkdown/, "editor state mapping must keep publishedMarkdown");
});

await test("2 autosaving an edit changes the draft only; published text and status are unchanged", async () => {
  seed({ status: "Published", markdown: "DRAFT v2", publishedMarkdown: "PUBLISHED v1", slug: "s", custom: { keep: 1 } });
  await autosave({ slug: "s", markdown: "DRAFT v3", description: "d", difficulty: "Beginner", estimatedTime: 10, visibility: "Public" });
  assert.deepEqual(row().content, { status: "Published", markdown: "DRAFT v3", publishedMarkdown: "PUBLISHED v1", slug: "s", custom: { keep: 1 }, description: "d", difficulty: "Beginner", estimatedTime: 10, visibility: "Public" });
  assert.ok(!("publishedMarkdown" in db.updates[0].content) || db.updates[0].content.publishedMarkdown === "PUBLISHED v1");
});

await test("3 a published step WITHOUT publishedMarkdown stays without it (no draft becomes published text)", async () => {
  seed({ status: "Published", markdown: "UNAPPROVED" });
  await autosave({ markdown: "UNAPPROVED v2" });
  assert.equal("publishedMarkdown" in row().content, false);
  assert.equal(row().content.markdown, "UNAPPROVED v2");
});

await test("4 legacy / malformed content: undefined values never delete keys, odd types are preserved, nothing is invented", async () => {
  seed({ markdown: "LEGACY", publishedMarkdown: null, weird: [1, 2] });
  await autosave({ markdown: "LEGACY v2", description: undefined, slug: undefined });
  assert.deepEqual(row().content, { markdown: "LEGACY v2", publishedMarkdown: null, weird: [1, 2] });
  seed({}); row().content = null;
  await autosave({ markdown: "from null" });
  assert.deepEqual(row().content, { markdown: "from null" });
  assert.deepEqual(mergeStepContent("not an object", { markdown: "x" }), { markdown: "x" });
});

await test("5 an ordinary save cannot publish implicitly: publishedMarkdown and status are stripped from draft patches", async () => {
  const patch = draftContentPatch({ markdown: "M", publishedMarkdown: "SNEAKY", status: "Published", slug: "s" } as never);
  assert.deepEqual(patch, { markdown: "M", slug: "s" });
  assert.ok(!(DRAFT_CONTENT_KEYS as readonly string[]).includes("publishedMarkdown") && !(DRAFT_CONTENT_KEYS as readonly string[]).includes("status"));
  seed({ status: "Draft", markdown: "D" });
  await autosave({ markdown: "D2", publishedMarkdown: "SNEAKY", status: "Published" } as never);
  assert.deepEqual(row().content, { status: "Draft", markdown: "D2" });
  // the autosave call site in BookEditorPage.tsx sends draftContentPatch(...) and no publishedMarkdown/status
  const src = fs.readFileSync(path.join(process.cwd(), "src/routes/books/BookEditorPage.tsx"), "utf8");
  const block = src.slice(src.indexOf("const syncDatabase"), src.indexOf("setSaveStatus(\"saved\")"));
  assert.match(block, /content: draftContentPatch\(/);
  assert.doesNotMatch(block, /publishedMarkdown:|status: activeStepFound/);
});

await test("6 a stale editor cannot roll back newer published content (another session published between read and write)", async () => {
  seed({ status: "Draft", markdown: "D", publishedMarkdown: "OLD PUBLISHED" });
  // another session (e.g. MCP publish_draft or another tab) publishes right before our first write
  let fired = false;
  db.beforeUpdate = () => { if (fired) return; fired = true; Object.assign(row(), { content: { status: "Published", markdown: "D", publishedMarkdown: "NEW PUBLISHED" }, updated_at: nextStamp() }); };
  await autosave({ markdown: "stale editor text" });
  assert.equal(row().content.publishedMarkdown, "NEW PUBLISHED", "published text from the other session must survive");
  assert.equal(row().content.status, "Published");
  assert.equal(row().content.markdown, "stale editor text");
  assert.equal(db.updates.length, 1, "the conflicting first write matched no row (compare-and-set on updated_at)");
});

await test("7 explicit publish still works: the Publish path sets publishedMarkdown and status", async () => {
  seed({ status: "Draft", markdown: "READY" });
  await DBService.updateStep(STEP, { title: "Step", position: 1, content: { markdown: "READY", publishedMarkdown: "READY", status: "Published" } } as never);
  assert.deepEqual(row().content, { status: "Published", markdown: "READY", publishedMarkdown: "READY" });
});

await test("8 repeated conflicts end in a clear error and write nothing", async () => {
  seed({ status: "Published", markdown: "D", publishedMarkdown: "P" });
  db.beforeUpdate = () => { row().updated_at = nextStamp(); }; // someone saves before every write
  await assert.rejects(() => autosave({ markdown: "never written" }), /changed elsewhere/);
  assert.equal(row().content.markdown, "D");
  assert.equal(db.updates.length, 0);
});

await test("9 updates without content keep the old single-statement path", async () => {
  seed({ status: "Draft", markdown: "D" });
  await DBService.updateStep(STEP, { title: "Renamed" } as never);
  assert.equal(row().title, "Renamed");
  assert.deepEqual(row().content, { status: "Draft", markdown: "D" });
});

let fails = 0;
for (const [n, ok, why] of results) { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${n}${ok ? "" : "  -> " + why}`); }
console.log(`\n${results.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
