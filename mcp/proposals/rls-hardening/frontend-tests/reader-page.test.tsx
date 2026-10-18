// Renders the REAL BookReaderPage (server-side) with the query cache seeded from recorded reader_book_tree output.
// Checks what a reader actually sees. Not a browser test: no layout, no client interaction, no real network.
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fx from "./fixtures/reader-fixtures.json";
import { BookReaderPage } from "@/routes/books/BookReaderPage";

const F: any = fx;
function render(actor: string, key: string, bookId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["book-structure", bookId, "reader-tree"], F.trees[actor][key]);
  return renderToString(createElement(QueryClientProvider, { client: qc }, createElement(BookReaderPage, { bookId, onBack: () => {} })));
}
let failed = 0;
const t = (name: string, fn: () => void) => { try { fn(); console.log("  ok  ", name); } catch (e: any) { failed++; console.log("  FAIL", name, "\n      ", String(e.message).split("\n")[0]); } };
console.log("BookReaderPage (server render, seeded from recorded SQL output):");
t("anon: shows the published book and step text, no draft text or draft step titles", () => {
  const html = render("anon", "PUB:true", F.ids.books.PUB);
  assert.match(html, /Public Book/); assert.match(html, /PUB-1 published text/);
  for (const m of ["DRAFT_SECRET", "DRAFT-EDIT", "Draft-only step", "Draft in phase D"]) assert.ok(!html.includes(m), m);
});
t("editor: sees the draft-only step in the navigation", () => {
  const html = render("editor", "PUB:true", F.ids.books.PUB);
  assert.match(html, /Draft-only step/); assert.match(html, /Draft in phase D/);
});
t("empty book renders the existing empty state", () => {
  const html = render("anon", "EMPTY:true", F.ids.books.EMPTY);
  assert.match(html, /Empty Book/); assert.match(html, /No phases|No steps/);
});
t("inaccessible book (null tree) renders the existing not-found state, not a blank book", () => {
  const html = render("stranger", "DRAFTBOOK:true", F.ids.books.DRAFTBOOK);
  assert.match(html, /Book not found/); assert.ok(!html.includes("Draft Book") && !html.includes("DRAFT_SECRET"));
});
console.log(failed ? `${failed} failed` : "page tests passed");
process.exit(failed ? 1 : 0);
