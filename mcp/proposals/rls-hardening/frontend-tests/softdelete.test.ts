// Frontend regression for soft-deleted books: the reader must show "Book not found" wherever the application's
// getBook() (deleted_at IS NULL) shows nothing. Replays reader_book_tree output recorded WITHOUT ("before") and WITH
// ("after") 02-tree-hide-soft-deleted.patch. Not covered: a real backend.
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fx from "./fixtures/softdelete-fixtures.json";
import { DBService } from "@/services/db";
import { control, reset } from "@/lib/insforge";
import { BookReaderPage } from "@/routes/books/BookReaderPage";

const F: any = fx;
let failed = 0;
async function t(name: string, fn: () => Promise<void> | void) { try { reset(); await fn(); console.log("  ok  ", name); } catch (e: any) { failed++; console.log("  FAIL", name, "\n      ", String(e.message).split("\n")[0]); } }
const page = (tree: any) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["book-structure", F.book, "reader-tree"], tree);
  return renderToString(createElement(QueryClientProvider, { client: qc }, createElement(BookReaderPage, { bookId: F.book, onBack: () => {} })));
};
console.log("soft-deleted book:");
for (const actor of ["anon", "stranger", "editor", "owner"]) {
  await t(`WITH patch: ${actor} gets null from getReaderTree and the page says "Book not found"`, async () => {
    control.rpcOverride = () => ({ data: F.after[actor], error: null });
    const tree = await DBService.getReaderTree(F.book, true);
    assert.equal(tree, null);
    const html = page(tree);
    assert.match(html, /Book not found/); assert.ok(!html.includes("Deleted Book") && !html.includes("Deleted step"));
  });
}
await t("WITHOUT patch (documents the gap): only the OWNER receives the deleted book, others get null", async () => {
  const seen: Record<string, boolean> = {};
  for (const actor of ["anon", "stranger", "editor", "owner"]) {
    control.rpcOverride = () => ({ data: F.before[actor], error: null });
    seen[actor] = (await DBService.getReaderTree(F.book, true)) !== null;
  }
  assert.deepEqual(seen, { anon: false, stranger: false, editor: false, owner: true });
  control.rpcOverride = () => ({ data: F.before.owner, error: null });
  assert.match(page(await DBService.getReaderTree(F.book, true)), /Deleted Book/); // the regression the patch removes
});
console.log(failed ? `${failed} failed` : "soft-delete tests passed");
process.exit(failed ? 1 : 0);
