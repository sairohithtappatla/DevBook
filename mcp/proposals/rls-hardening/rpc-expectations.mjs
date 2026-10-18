// Hand-written expectations for reader_book_tree on the seeded fixture (same titles/markers as
// frontend-tests/generate-fixtures.mjs). Used by rpc-contract-check.mjs against a REAL test project and verified locally
// against the outputs recorded from the sandbox SQL (rpc-expectations.test.mjs). Written from the approved rules, not copied
// from the recorded output.
export const ACTORS = ["anon", "stranger", "viewer", "reviewer", "editor", "owner"];
export const BOOKS = ["PUB", "EMPTY", "UNL", "DRAFTBOOK", "DELETED"];
const DRAFT_VIEWERS = ["owner", "editor", "reviewer"];      // approved decision D-a
const MEMBER_OF = { PUB: ["owner", "editor", "reviewer", "viewer"], EMPTY: ["owner"], UNL: ["owner"], DRAFTBOOK: ["owner"], DELETED: ["owner"] };
const DRAFT_MARKERS = ["DRAFT_SECRET", "DRAFT-EDIT"];

// -> null | { phases: [[phaseTitle, [stepTitle...]]...], drafts: boolean }
export function expected(actor, book, includeDrafts, { softDeletePatch = true } = {}) {
  const member = MEMBER_OF[book].includes(actor);
  const seesDrafts = includeDrafts && DRAFT_VIEWERS.includes(actor) && member;
  switch (book) {
    case "PUB":
      return { drafts: seesDrafts, phases: [["Phase A", seesDrafts ? ["Published step", "Draft-only step"] : ["Published step"]], ["Phase B", ["Legacy step"]], ...(seesDrafts ? [["Phase D (draft only)", ["Draft in phase D"]]] : [])] };
    case "EMPTY": return { drafts: false, phases: [] };
    case "UNL": return { drafts: false, phases: [["Unlisted phase", ["Unlisted step"]]] };          // direct link: everyone, incl. anon
    case "DRAFTBOOK": return member ? { drafts: seesDrafts, phases: [["Draft phase", ["Step of a draft book"]]] } : null; // DRAFT book: members only
    case "DELETED": return softDeletePatch || !member ? null : { drafts: seesDrafts, phases: [["Deleted phase", ["Deleted step"]]] };
    default: throw new Error("unknown book " + book);
  }
}

// -> list of problems (empty = matches). `tree` is the `data` of the RPC response.
export function verify(actor, book, includeDrafts, tree, opts = {}) {
  const p = [];
  const exp = expected(actor, book, includeDrafts, opts);
  if (exp === null) { if (tree !== null) p.push(`expected null, got a tree`); return p; }
  if (tree === null || typeof tree !== "object") return [`expected a tree, got ${tree === null ? "null" : typeof tree}`];
  if (!tree.book || typeof tree.book.id !== "string" || !Array.isArray(tree.phases)) return ["response is not { book, phases }"];
  for (const k of ["id", "title", "slug", "publication_status", "access_level", "created_by", "creator"]) if (!(k in tree.book)) p.push(`book.${k} missing`);
  const got = tree.phases.map((ph) => [ph.title, ph.steps.map((s) => s.title)]);
  if (JSON.stringify(got) !== JSON.stringify(exp.phases)) p.push(`structure ${JSON.stringify(got)} != ${JSON.stringify(exp.phases)}`);
  for (const ph of tree.phases) for (const s of ph.steps) {
    for (const k of ["id", "title", "position", "status", "markdown", "publishedMarkdown", "attachments"]) if (!(k in s)) p.push(`step.${k} missing (${s.title})`);
    if (s.title === "Published step") {
      if (exp.drafts) { if (s.markdown !== "DRAFT-EDIT-1 newer unpublished text" || s.publishedMarkdown !== "PUB-1 published text") p.push("draft-viewer step text wrong"); }
      else if (s.markdown !== "PUB-1 published text" || s.publishedMarkdown !== "PUB-1 published text" || s.status !== "Published") p.push("reader step text wrong");
      const files = s.attachments.map((a) => a.file_name).sort().join();
      if (files !== "pub.pdf") p.push(`attachments of Published step: ${files}`);
    }
    if (s.title === "Legacy step" && s.markdown !== "LEGACY text of a step without status") p.push("legacy step text wrong");
    if (s.title === "Draft-only step") { if (!exp.drafts) p.push("draft-only step present for a non-draft reader"); else if (s.attachments.map((a) => a.file_name).join() !== "draft.pdf") p.push("draft attachment missing"); }
  }
  // DRAFTBOOK/DELETED: their (published-status) step text deliberately contains a marker; for them the member check above is the leak test.
  if (!exp.drafts && book !== "DRAFTBOOK" && book !== "DELETED") { const j = JSON.stringify(tree); for (const m of [...DRAFT_MARKERS, "draft.pdf"]) if (j.includes(m)) p.push(`leak: ${m}`); }
  return p;
}
