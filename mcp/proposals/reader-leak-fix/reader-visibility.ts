export type ReaderStepContent = {
  markdown?: string;
  publishedMarkdown?: string;
  status?: string | null;
};

/** `books.publication_status` of the step's parent book; anything but "PUBLISHED" counts as unpublished. */
export type ReaderBookStatus = string | null | undefined;

// null = the step must not be shown to readers at all.
function resolveReaderMarkdown(content: ReaderStepContent | null | undefined, bookStatus: ReaderBookStatus): string | null {
  if (!content) return null;

  // Explicitly published text always wins, even when it is an empty string.
  if (typeof content.publishedMarkdown === "string") return content.publishedMarkdown;

  const markdown = typeof content.markdown === "string" ? content.markdown : "";
  if (content.status === "Published") return markdown;

  // An explicit Draft never falls back to its draft text, whatever the book status is.
  if (content.status === "Draft") return null;

  // The app always writes a status ("Draft" on creation, "Published" on publish), so a missing one
  // can only be a legacy/seeded row. Trust it only when its parent book is itself PUBLISHED and it
  // actually has text; a row with no `markdown` at all has nothing to show.
  const statusMissing = content.status === undefined || content.status === null || content.status === "";
  if (statusMissing && bookStatus === "PUBLISHED" && typeof content.markdown === "string") return markdown;

  return null;
}

/** Markdown a reader may see. Empty string when nothing may be shown. */
export function readerMarkdown(content: ReaderStepContent | null | undefined, bookStatus: ReaderBookStatus): string {
  return resolveReaderMarkdown(content, bookStatus) ?? "";
}

/** Whether the step should appear to readers at all (an intentionally empty published step does). */
export function isReaderVisible(content: ReaderStepContent | null | undefined, bookStatus: ReaderBookStatus): boolean {
  return resolveReaderMarkdown(content, bookStatus) !== null;
}
