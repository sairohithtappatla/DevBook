# Proposal: stop draft Markdown reaching readers (NOT applied)

Nothing here is applied to `src/`. Files:
- `db.ts.patch`: `getBookStructure` change plus a new `getBookPublicationStatus` (`patch -p1 < db.ts.patch` from the repo root; dry-run verified against the current tree).
- `reader-visibility.ts` -> would become `src/lib/reader-visibility.ts` (pure functions, no imports).
- `reader-visibility.test.ts` -> would become `tests/reader-visibility.test.ts`, outside `src/` so `tsc -b` stays untouched (a test inside `src/` breaks the app build: no Node types in the app tsconfig).

Run: `node --test "tests/*.test.ts"` (Node >= 22.18, no new dependency; a bare directory argument fails). Optional `package.json` script needs your approval.

## Rule (approved by you; reader mode only, editor mode unchanged)

Inputs: the step's `content` and the parent book's `publication_status`.

| # | Condition (first match wins) | Reader gets |
|---|------------------------------|-------------|
| 1 | `publishedMarkdown` is a string (even `""`) | `publishedMarkdown` |
| 2 | `status === "Published"` (no `publishedMarkdown`) | `markdown` |
| 3 | `status === "Draft"` | `""`, step hidden, **regardless of book status** |
| 4 | `status` missing (`undefined`, `null`, `""`), has a `markdown` string, and book is exactly `"PUBLISHED"` | `markdown` (legacy) |
| 5 | anything else (Archived, unknown status such as `"published"`, missing status in a non-PUBLISHED or unknown book, no content) | `""`, step hidden |

Two functions implement it: `readerMarkdown()` returns the string (`""` for rows 3 and 5, as specified) and `isReaderVisible()` says whether the step appears at all. `getBookStructure` drops steps that are not visible (and phases left empty), so hidden drafts do not show up as blank pages with their titles in the sidebar. If you would rather show blank stubs, only the `isReaderVisible` check in the patch changes.

## Evidence (scratch copy of the repo; your working tree is untouched)
- New regression tests: **13/13 pass**. Cases include: a published book containing an explicit Draft step; a legacy step with missing status in PUBLISHED / DRAFT / ARCHIVED / null / unknown-case books; `publishedMarkdown` priority across all statuses; `""` as an explicit published value; Archived and unknown statuses; malformed JSON values; a mixed published book exposing only the allowed steps.
- `npx tsc -b`: exit 0. `npx oxlint` on the three files: no output. `npx vite build`: succeeds.
- Old code on the same inputs: explicit Draft step in a PUBLISHED book returned `"SECRET DRAFT"` (the leak); legacy step was shown regardless of book status.

## Live-data results (2026-10-18), settling most assumptions below
- Production has 5 books (all PUBLISHED/PUBLIC) and 106 steps: 105 `Published` with `publishedMarkdown`, **1 `Published` without it** (rule row 2 shows it), **0 with missing status, 0 Draft, 0 Archived**. So the legacy missing-status clause (row 4) affects **no current data**; it stays only as a safety net. Anonymous visitors can read the books' status (assumption 2 holds).
- **Important:** anonymous API readers can read `steps.content.markdown` for any readable book (`select_steps` is row-level). No pending unpublished edits exist today, so nothing is exposed right now, but this patch alone does not prevent a future draft from being readable through the API. See `context/mcp-phase2-design.md`, "Updates from the live schema".

## Assumptions that still need verification
1. **Seeded rows' real shape.** The rule assumes legacy rows have a missing status. If the seeded books use another spelling (for example lowercase `"published"`), row 5 hides them. Checklist C10 groups by exact status text, so any variant appears in its output.
2. **Anonymous visitors can read `books.publication_status`.** The patch adds one small `select` (run in parallel with the phases query). If RLS stops anonymous reads of the `books` row, the status is `null` and legacy steps fail closed (hidden), so seeded books would render empty for logged-out visitors. Check with `db policies` and `anon-read-probe.mjs`.
3. **Archived steps.** Row 1 follows your rule literally, so an Archived step that has `publishedMarkdown` is still shown. The app never creates Archived steps (the value exists only in type unions), and C10 will show whether any exist.
4. **The app's step writers.** Verified from code: parser, editor add-step and editor import write `status: "Draft"`; `"Published"` is written only by the whole-book publish, together with `publishedMarkdown`. Rows outside those paths (MCP, SQL, seeds) are not covered by this assumption.
5. **Casing.** `"Published"`/`"Draft"` are matched exactly.

## What this does NOT fix
Frontend filtering is correctness, not security. The browser still downloads the whole `steps.content` JSON (including draft `markdown`) for any row RLS lets that caller read, and anyone can query the API directly with the public anon key. `anon-read-probe.mjs` and `db policies` answer whether that is possible; if it is, the real fix is server-side (a reader view that exposes only published fields, or tighter policies), written after the policy output is known. It also does not gate readers on the book's status for steps that have `publishedMarkdown`: a step published inside a book that is not PUBLISHED is still shown if the row is readable.

## Behaviour changes to review
1. Owners previewing from the editor ("Preview" opens the reader) see only what readers see. The editor has its own preview pane.
2. `getStepCounts` (progress denominators) still counts draft steps, so a book with unpublished drafts can show a wrong completion percentage. Separate small fix, not included.
3. Visible steps are returned with `status: "Published"` in reader mode (the reader ignores it today).
