import assert from "node:assert/strict";
import { test } from "node:test";
import { isReaderVisible, readerMarkdown, type ReaderStepContent } from "../src/lib/reader-visibility.ts";

const BOOKS = ["PUBLISHED", "DRAFT", "ARCHIVED", null, undefined] as const;

test("publishedMarkdown wins over newer draft text for every status and book status", () => {
  for (const status of ["Published", "Draft", undefined, null, ""] as const) {
    for (const book of BOOKS) {
      const c: ReaderStepContent = { status, markdown: "DRAFT EDIT", publishedMarkdown: "PUBLISHED" };
      assert.equal(readerMarkdown(c, book), "PUBLISHED", `status=${status} book=${book}`);
      assert.equal(isReaderVisible(c, book), true);
    }
  }
});

test("an empty-string publishedMarkdown is an explicit published value", () => {
  const c = { status: "Published", markdown: "draft", publishedMarkdown: "" };
  assert.equal(readerMarkdown(c, "PUBLISHED"), "");
  assert.equal(isReaderVisible(c, "PUBLISHED"), true);
});

test("explicit Published without publishedMarkdown falls back to markdown, whatever the book status", () => {
  for (const book of BOOKS) {
    const c = { status: "Published", markdown: "LEGACY PUBLISHED" };
    assert.equal(readerMarkdown(c, book), "LEGACY PUBLISHED", `book=${book}`);
    assert.equal(isReaderVisible(c, book), true);
  }
});

test("explicit Draft never shows markdown, even inside a PUBLISHED book (the leak)", () => {
  for (const book of BOOKS) {
    const c = { status: "Draft", markdown: "SECRET DRAFT" };
    assert.equal(readerMarkdown(c, book), "", `book=${book}`);
    assert.equal(isReaderVisible(c, book), false, `book=${book}`);
  }
});

test("a step the editor just added to a published book stays hidden", () => {
  const added = { status: "Draft", markdown: "# Untitled Step\n\nStart writing documentation here..." };
  assert.equal(isReaderVisible(added, "PUBLISHED"), false);
  assert.equal(readerMarkdown(added, "PUBLISHED"), "");
});

test("legacy step with missing status shows markdown only when the parent book is PUBLISHED", () => {
  for (const status of [undefined, null, ""] as const) {
    const c = { status, markdown: "LEGACY" };
    assert.equal(readerMarkdown(c, "PUBLISHED"), "LEGACY", `status=${JSON.stringify(status)}`);
    assert.equal(isReaderVisible(c, "PUBLISHED"), true);
    for (const book of ["DRAFT", "ARCHIVED", null, undefined, "published", "Published"] as const) {
      assert.equal(readerMarkdown(c, book), "", `status=${JSON.stringify(status)} book=${book}`);
      assert.equal(isReaderVisible(c, book), false);
    }
  }
});

test("legacy missing-status row with no markdown key at all is hidden; an empty markdown string is shown", () => {
  assert.equal(isReaderVisible({ status: undefined }, "PUBLISHED"), false);
  assert.equal(isReaderVisible({ markdown: "" }, "PUBLISHED"), true);
  assert.equal(readerMarkdown({ markdown: "" }, "PUBLISHED"), "");
});

test("content with no status key at all behaves like a missing status", () => {
  assert.equal(readerMarkdown({ markdown: "LEGACY" }, "PUBLISHED"), "LEGACY");
  assert.equal(readerMarkdown({ markdown: "LEGACY" }, "DRAFT"), "");
});

test("Archived and unknown statuses without publishedMarkdown are hidden even in a PUBLISHED book", () => {
  for (const status of ["Archived", "Review", "published", "PUBLISHED"]) {
    const c = { status, markdown: "X" };
    assert.equal(readerMarkdown(c, "PUBLISHED"), "", status);
    assert.equal(isReaderVisible(c, "PUBLISHED"), false, status);
  }
});

test("null, undefined and empty content are hidden", () => {
  for (const c of [null, undefined, {}]) {
    assert.equal(readerMarkdown(c, "PUBLISHED"), "");
    assert.equal(isReaderVisible(c, "PUBLISHED"), false);
  }
});

test("malformed JSON cannot leak a draft: non-string publishedMarkdown on a Draft step", () => {
  const bad = { status: "Draft", markdown: "SECRET", publishedMarkdown: 5 } as unknown as ReaderStepContent;
  assert.equal(readerMarkdown(bad, "PUBLISHED"), "");
  assert.equal(isReaderVisible(bad, "PUBLISHED"), false);
});

test("non-string markdown on a Published step yields an empty string, not a crash", () => {
  const bad = { status: "Published", markdown: 5 } as unknown as ReaderStepContent;
  assert.equal(readerMarkdown(bad, "PUBLISHED"), "");
});

test("a published book containing mixed steps exposes only the allowed ones", () => {
  const steps: { title: string; content: ReaderStepContent }[] = [
    { title: "published", content: { status: "Published", markdown: "d1", publishedMarkdown: "p1" } },
    { title: "explicit draft", content: { status: "Draft", markdown: "SECRET" } },
    { title: "legacy no status", content: { markdown: "legacy" } },
    { title: "edited published", content: { status: "Published", markdown: "NEW DRAFT", publishedMarkdown: "OLD LIVE" } },
    { title: "archived", content: { status: "Archived", markdown: "gone" } },
  ];
  const shown = steps.filter((s) => isReaderVisible(s.content, "PUBLISHED")).map((s) => [s.title, readerMarkdown(s.content, "PUBLISHED")]);
  assert.deepEqual(shown, [["published", "p1"], ["legacy no status", "legacy"], ["edited published", "OLD LIVE"]]);
  const inDraftBook = steps.filter((s) => isReaderVisible(s.content, "DRAFT")).map((s) => s.title);
  assert.deepEqual(inDraftBook, ["published", "edited published"]);
});
