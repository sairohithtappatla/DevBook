// READ-ONLY. Shows what an ANONYMOUS visitor can read from books/steps. Prints counts only, never text.
// Run from the repo root after `npm ci`:
//   node --env-file=.env.local mcp/tools/anon-read-probe.mjs
// Uses only the public anon key your website already ships in its JS bundle. Issues SELECTs only.
import { createClient } from "@insforge/sdk";

const baseUrl = process.env.VITE_INSFORGE_URL;
const anonKey = process.env.VITE_INSFORGE_ANON_KEY;
if (!baseUrl || !anonKey) {
  console.error("Missing VITE_INSFORGE_URL / VITE_INSFORGE_ANON_KEY (load them with --env-file=.env.local).");
  process.exit(2);
}
const client = createClient({ baseUrl, anonKey });

const books = await client.database.from("books").select("id,publication_status,access_level,deleted_at").limit(1000);
const steps = await client.database.from("steps").select("id,content").limit(5000);

const bookBuckets = {};
for (const b of books.data ?? []) {
  const k = `${b.publication_status}/${b.access_level}${b.deleted_at ? "/deleted" : ""}`;
  bookBuckets[k] = (bookBuckets[k] ?? 0) + 1;
}

const stepBuckets = { published_with_text: 0, published_flag_no_text: 0, draft_only_text: 0, empty_or_other: 0 };
let unpublishedTextExposed = 0;
for (const s of steps.data ?? []) {
  const c = s.content ?? {};
  const hasPub = typeof c.publishedMarkdown === "string";
  const hasDraft = typeof c.markdown === "string" && c.markdown.length > 0;
  if (hasPub) stepBuckets.published_with_text++;
  else if (c.status === "Published") stepBuckets.published_flag_no_text++;
  else if (hasDraft) stepBuckets.draft_only_text++;
  else stepBuckets.empty_or_other++;
  // Text an anonymous caller can fetch that is not the published text.
  if (hasDraft && (!hasPub || c.markdown !== c.publishedMarkdown)) unpublishedTextExposed++;
}

console.log(JSON.stringify({
  booksError: books.error?.message ?? null,
  booksVisibleToAnon: bookBuckets,
  stepsError: steps.error?.message ?? null,
  stepsVisibleToAnon: (steps.data ?? []).length,
  stepBuckets,
  stepsWhereAnonCanReadNonPublishedText: unpublishedTextExposed,
}, null, 2));
