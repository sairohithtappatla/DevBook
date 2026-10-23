# Progress Tracker

Update this file after every completed milestone.

This document is the single source of truth for the project's implementation progress.

Every completed milestone must be checked before starting the next one.

---

# Current Status

**Current Phase**

Phase 11 — Security Hardening & MCP (branch v2) — Final Security Review & Remediation Completed; Ready for Formal Production Review

**Last Completed**

Final Security Review & Production-Readiness Remediation (2026-10-20):
- **P0 Attachment Cross-User Authorization (F7/F27):** RESOLVED & VERIFIED ON TEST via `09_secure_attachment_storage.sql`. Enforced RLS on `storage.objects` with helper `can_access_attachment_object()`. Verified on TEST: strangers denied draft/private assets (404), stranger writes/deletes rejected (403/404), owner/editor downloads pass, all test probes cleaned up.
- **P0 Editor Concurrency & Data Integrity (F21):** RESOLVED & VERIFIED via atomic optimistic concurrency control (`updated_at` CAS in single-statement SQL update), `draftContentPatch`, and `mergeStepContent`. 9/9 regression tests pass; remote CAS test on TEST DB confirmed 0 rows returned on stale timestamp.
- **P1 Draft Phase Visibility (S4):** RESOLVED & VERIFIED ON TEST via `08_hide_draft_only_phases.sql` and `phase_is_reader_visible()`.
- **P1 Trigger Security & Search Path:** 100% of 13 `SECURITY DEFINER` functions in `public` have pinned `search_path=public, pg_temp`.
- **P1 Migration Ordering & Rollback Matrix:** Completed audit of migrations `01` through `09` and `001`/`002`, including destructive rollback warnings (exporting `mcp_audit_events` before dropping).
- **Release Gate Review & Verification:**
  - **RG-01 (Reader Integration):** RESOLVED & VERIFIED IN WORKING TREE. Reconciled `useReaderBook` and `getReaderTree()` with editor CAS concurrency protections (`mergeStepContent` / atomic compare-and-set). Verified with `npx tsc -b` (0 errors), `npm run build` (clean Vite production bundle), `oxlint` (0 errors), 9/9 editor tests pass, 17/17 reader integration tests pass, 4/4 SSR reader-page tests pass, softdelete and rollback suites pass, and 29/29 live TEST backend assertions pass.
  - **RG-02 (Production Backup):** OPEN. Pending authorized execution of `npx -y @insforge/cli backups create --project 6ktij8hk --name pre-v2-prod --wait`.
  - **RG-03 (Owner Authorization):** OPEN. Pending formal owner sign-off on migration plan `01`–`09` and skipping `02c`.
  - **RG-04 (MCP Operational Flags):** PENDING PRODUCTION VERIFICATION. Verified `false` on TEST; code defaults strictly to `false` when unset; production inspection required post-authorization.
  - **RG-05 (Reproducible Release Artifact):** PENDING STAGING PACKAGING & ARTIFACT FREEZE. Working tree verified clean; packaging into clean release commit/bundle awaiting authorization.
- **Deliverables Prepared:** Final Findings Report, Attachment Security Report, Editor Concurrency Report, Migration Matrix, Production Preflight Runbook, Pre-Production Release Gate Review, and Evidence Ledger.

**Next Milestone**

Formal Production Review with project owner, followed by authorized execution of the Production Preflight Runbook against production (`6ktij8hk`).

---

# Progress

## Phase 1 — Project Foundation

### Project Structure

* [x] 01 Initialize React + Vite + TypeScript
* [x] 02 Configure Tailwind CSS
* [x] 03 Configure TanStack Router
* [x] 04 Configure TanStack Query
* [x] 05 Configure InsForge Client
* [x] 06 Configure Project Folder Structure
* [x] 07 Configure Theme & Design Tokens
* [x] 08 Configure Global Layout
* [x] 09 Configure Protected Routes

---

## Phase 2 — Design System

### Shared UI Components

* [x] 11 Sidebar
* [x] 12 Top Navigation
* [x] 13 Search Bar
* [x] 14 Buttons
* [x] 15 Cards
* [ ] 16 Dropdowns
* [ ] 17 Dialogs
* [ ] 18 Empty States
* [x] 19 Loading Skeletons
* [x] 20 Toast System

---

## Phase 3 — Documentation Engine

### Markdown Infrastructure

* [x] 21 MDXEditor Integration
* [x] 22 Markdown Parser
* [x] 23 Markdown Tree Generator
* [x] 24 Markdown Renderer
* [x] 25 Shiki Integration
* [x] 26 Mermaid Integration
* [x] 27 Sidebar Tree Generation
* [x] 28 Documentation Preview
* [x] 29 Attachment Upload
* [x] 30 Attachment Download

---

## Phase 4 — Authentication

### Authentication

* [x] 31 Login Page UI
* [x] 32 Register Page UI
* [x] 33 Authentication Logic
* [x] 34 Session Persistence
* [x] 35 Logout

---

## Phase 5 — Home

### Home

* [x] 36 Home UI
* [x] 37 Search
* [x] 38 Book Cards
* [x] 39 Book Details
* [x] 40 Get Started

---

## Phase 6 — My Books

### Creator CMS

* [x] 41 My Books UI
* [x] 42 Create Book
* [x] 43 Edit Book
* [x] 44 Delete Book
* [x] 45 Import Markdown
* [x] 46 Manual Editor
* [x] 47 Drag Phases
* [x] 48 Drag Steps
* [x] 49 Publish Book
* [x] 50 Visibility Settings

---

## Phase 7 — Documentation Reader

### Reader

* [x] 51 Documentation Reader UI
* [x] 52 Sidebar Navigation
* [x] 53 On This Page
* [x] 54 Previous / Next Navigation
* [x] 55 Mark Complete
* [x] 56 Reader Progress Logic

---

## Phase 8 — Progress

### Learning Progress

* [x] 57 My Progress UI
* [x] 58 Continue Reading
* [x] 59 Progress Calculation
* [x] 60 Completed Books

---

## Phase 9 — Profile

### User Profile

* [x] 61 Profile UI
* [x] 62 Edit Profile
* [x] 63 Followers
* [x] 64 Following
* [x] 65 Published Books

---

## Phase 10 — Polish

### Final Production Pass

* [x] 66 Responsive Improvements
* [ ] 67 Keyboard Shortcuts
* [x] 68 Accessibility
* [x] 69 Error States
* [x] 70 Performance Optimization
* [x] 71 Final Testing
* [x] 72 Production Deployment (Build Verification)

---

## Phase 11 — Security Hardening & MCP (branch v2, NOT in production)

### Database access rules (mcp/proposals/rls-hardening/final/)

* [x] 73 RLS hardening SQL 01–07 incl. 02b legacy-step data fix and 07 strict reader rule, each with a rollback (local PostgreSQL 15.18 checks pass)
* [x] 74 01–04 verified on the InsForge TEST project devbook-rls-test (recorded 2026-10-19: rollback and re-apply 0 differences, contract check 78/78)
* [x] 75 02b, 07, 06, MCP 002 and the 2026-10-20 MCP changes verified on the TEST project (authorized run 2026-10-20; evidence: context/mcp-test-evidence.md §E)
* [ ] 76 Production preflight (drift check against rollback texts, Q1–Q11) and backup
* [ ] 77 Production: apply 01, 02, 02b
* [ ] 78 Production: deploy website with both reader patches applied to src/
* [ ] 79 Production: apply 03 + 04 together, smoke tests (optional 05, 06)
* [ ] 80 Merge v2 into main

### MCP server (mcp/devbook-mcp/)

* [x] 81 Read, draft and single-step publish tools with personal access tokens (49 local tests pass; remediation ledger: context/mcp-remediation-ledger.md)
* [x] 82 Verified on the TEST project with write/publish flags switched off again (recorded 2026-10-19)
* [ ] 83 Production rollout (planned for later, not in the first rollout)
* [x] 83b Website editor keep-published fix implemented locally in src/ with regression tests (uncommitted)
* [ ] 83a Website editor keep-published fix verified in a browser (needs a TEST website deployment)

### Later

* [x] 84 Storage: RLS enforcement on `storage.objects` with `can_access_attachment_object()` for `book-assets` bucket (RESOLVED & VERIFIED ON TEST)
* [ ] 85 OAuth for MCP clients without custom headers

---

# Decisions Made During Development

Document important implementation decisions here.

Example

* Markdown is the source of truth.
* Sidebar navigation is generated automatically.
* Readers always see the latest published version.
* Login page is implemented as a token-based React screen using `public/login.png` for the brand illustration and `public/logo.svg` for the mark.
* Added the `@/*` TypeScript/Vite alias to support the required absolute import convention.
* Added `lucide-react` because it is the approved icon library in the project architecture and UI registry.
* Restored the global typography tokens to the documented pairing: Work Sans for body/navigation UI and JetBrains Mono for headings/code.
* Scoped Roboto and compact 12px labels to the fixed-width sidebar so navigation text fits without changing sidebar width.
* Refined sidebar typography only: 16px brand, 13px nav labels, and inherited text colors while preserving existing sidebar width and nav item geometry.
* Rebuilt My Books as a middle-only content workspace with no top navigation bar: header row, tabs/filters, tokenized data table, and pagination.
* Matched My Books typography to the reference with a single Roboto workspace font and explicit 24px/13px/12px/11px text scale.

* Seeded 8 public, published books across 4 users (Sai Rohit + Alice, Bob, and Charlie) with full markdown content, code blocks, and Mermaid diagrams to allow end-to-end testing of the reader and search features.
* Implemented dynamic pagination in the My Books workspace to show 5 books per page, resetting the current page index on active tab changes.
* Replaced the My Books table's Steps column with a Category column showing the parsed book category. Used the same clean BookThumb styling inside a 100px height cover frame for all Home page and Featured Books cards.
* Redesigned the My Progress table to add the Author column and Category column next to the Book column, and styled column widths to reduce column gaps.
* Wired the Progress Reset button to prompt the user with a confirmation modal, resetting progress to zero in both localStorage and the database on confirmation.
* Restructured category labels across both pages to map strictly to Backend, DevOps, System Design, Databases, API Design, Architecture, or others.
* Removed the Stats Cards Row (In Progress, Completed, Starred widgets) from the My Progress page, increased items per page to 6, and adjusted column widths to minimize gaps.
* Standardized BookThumb to use inline Tailwind solid background colors and added category-matching soft gradient backgrounds to BookCard headers to ensure high-contrast visual clarity.
* Removed all star icon indicators and star metrics from the user Profile page books tab layout.
* Replaced the hardcoded books tab list inside the Profile page with live database books filtered by the user ID.
* Reordered My Books table columns to: Book, Category, Visibility, Updated, Status, Actions.
* Redesigned the Book Editor workspace to use resizable panels, Zen Mode (Ctrl+Shift+E), Notion-style step title input, invisible toolbar, shrunk status bar, and grayscale typography-only panels.
* Restyled the Book Reader page layout, typography, and sidebar interactions to match the Next.js docs style precisely (1400px container, 284px left sidebar, 240px right sidebar, 640px center prose max-width, 15px body text size, 3rem h1 header, and Geist variable fonts). Added matching prose styles to the editor preview pane.
* Implemented scroll synchronization between the Markdown editor scroll container and the preview pane, utilizing programmatic flag locks (`isSyncingEditor` and `isSyncingPreview`) to prevent recursive feedback loops, ensuring synchronization works seamlessly during text entry and typing.
* Integrated drag-and-drop file drop listeners on the editor container and updated the inline editor image upload system to send assets directly to the `attachments` InsForge Storage bucket, automatically injecting formatted Markdown links at the cursor position.
* Added dark mode style overrides in `index.css` to fix the MDXEditor select dropdowns/triggers so that the code block language selector displays with a dark background (#1f1f23) and high contrast text in dark mode.
* Reordered MDXEditor plugins to load `markdownShortcutPlugin` after the code block and codeMirror plugins so typing three backticks (```) followed by space or enter at the beginning of a line correctly transforms into a code block.
* Refactored `Markdown.tsx` to render all code and mermaid blocks natively inside custom `ReactMarkdown` components, completely removing manual DOM manipulations to prevent React virtual DOM crashes.
* Integrated browser-optimized `shiki/bundle/web` and generated unique rendering IDs for Mermaid in its execution loop to support React Strict Mode.
* Configured Mermaid theme backgrounds to align with general theme surface variables (`var(--color-surface)`), ensuring diagrams remain fully readable in both light and dark mode contexts.
* Created a unified `insertTextAtCursor` editor helper and attached an `onPaste` handler to support copy-pasting images/files and dropping them directly inside both Rich Editor and Raw Markdown modes.
* Aligned the Book Reader page with the real database tables by querying `useBookStructure` and mapping the step and book properties to the mock data format (e.g., mapping `s.markdown` -> `step.content` and `tags` -> `category`) to ensure visual components remain consistent and stable.
* Replaced the Book Reader page's global scroll listener with an `IntersectionObserver` scoped to a memoized On This Page component, keeping TOC highlight updates out of the main reader render path.
* Memoized the shared Markdown renderer, added Shiki and Mermaid content caches, lazy-loaded markdown images, and cleared copy-button reset timers on unmount to reduce repeated reader rendering work.
* Moved shared book parsing/navigation helpers into `src/lib/book-utils.ts`, removed live `mock-data.ts` imports from reader/editor flows, and replaced reader mock fallbacks with loading/not-found states.
* Added creator data to book queries, batched step-count fetching, and updated home, featured, progress, profile, and my-books mappings to use DB-backed author/category/step metadata instead of fixed mock values.
* Changed progress reset cache handling to invalidate the scoped `step-progresses` query instead of clearing every cached step-progress row for the user.
* Hardened the Book Editor for copy-paste/import workflows by preserving imported Markdown step bodies, supporting `.md` file upload/drop in the import pane, inserting dropped Markdown files at the cursor, and routing rich-editor image uploads through InsForge attachments instead of base64 data URLs.
* Fixed phase/step synchronization in the Book Editor by updating local state on mutation success and switching TanStack Query mutations to invalidate queries directly, preventing cache drift.
* Hardened auth state checking in `AuthService.getCurrentUser` to gracefully handle unauthenticated sessions without throwing unhandled errors.
* Auto-calculated next positions in `DBService` for created phases and steps to prevent duplicate positions.
* (v2, 2026-10-20) Draft text is visible only to OWNER, EDITOR and REVIEWER; VIEWERs and everyone else read published text through `reader_book_tree` and the `reader_*` views. DRAFT, ARCHIVED and soft-deleted books are hidden from non-members; UNLISTED books open only by link.
* (v2, 2026-10-20) Legacy steps without `publishedMarkdown` get their current reader text frozen as `publishedMarkdown` (02b), so later edits stay drafts.
* (v2, 2026-10-20) Editor saves never write publishedMarkdown or status: autosave sends draft fields only and DBService.updateStep merges them into the current server content with a compare-and-set on updated_at (fixes autosave deleting published text).
* (v2, 2026-10-20) MCP publishing is owner-only; step metadata (title, description, difficulty, time) stays live, so the MCP needs the `publish` scope to change it on a step readers can see.
* (v2, 2026-10-20) Draft-only and empty phases are hidden from readers and non-draft members via migration 08 (`phase_is_reader_visible`); only phases with at least one published step (reader_markdown IS NOT NULL) are visible to discoverers of the book, matching `reader_book_tree`.
* (v2, 2026-10-20) Skip 02c for production by default: steps marked Published without publishedMarkdown should remain hidden under 07 until explicitly reviewed and published by authors in the fixed editor.
* (v2, 2026-10-22) PRODUCTION (`6ktij8hk`): applied 01, 02, 02b (0 rows frozen), 07 and 06 as tracked migrations, after backup `c6ce979c-de15-4c0e-83cb-d29de42f3ffa`. The old site's anonymous view (books, phases, steps, members, attachments) was identical to the pre-migration snapshot after every file. 02c NOT applied: "routing flow" step `e7a376a7…` stays hidden in the reader objects (105 of 106 steps) until its owner republishes it or approves 02c. 03, 04 and 08 are pending the v2 website deploy.
* (v2, 2026-10-22) Release preflight, read-only: production identity and the 5 migration records confirmed; backup `c6ce979c…` status completed (restore exists but overwrites current data); anonymous snapshot unchanged. Live site `devbook.rohith.engineer` (Vercel) still serves pre-v2 code (no `reader_book_tree` in its bundles). `origin/main` = `332a3ac`, a fast-forward ancestor of `origin/v2` = `31ef157e8db31db617ef3e2bb7646c9cb06d3b55`; no new env vars or `vercel.json` changes. On 31ef157: `tsc -b` clean, oxlint 0 errors, `vite build` OK, frontend suites editor-save 9/9, reader-integration 17/17, reader-page, soft-delete and rollback/access-level all pass. No MCP function, secrets or tables exist on production.
* (v2, 2026-10-22) `main` fast-forwarded to `992711f` (= v2) and pushed. The live site did NOT redeploy: after 15+ minutes it still serves the pre-v2 bundle, and GitHub shows no Vercel deployment, status or webhook for this or earlier commits, so Vercel is not deploying from this repository's `main` automatically. 03, 04 and 08 stay unapplied until the v2 site is live.
* (v2, 2026-10-22) MCP on PRODUCTION (owner decision: all tools incl. publish, durable limits + audit): migrations `20261022115640_mcp-tokens` (001) and `20261022115747_mcp-ops` (002) applied (tables RLS on, no anon/authenticated privileges, `mcp_rate_take` not executable by them); secrets `DEVBOOK_MCP_API_KEY`, `DEVBOOK_MCP_CONFIRM_KEY` set without printing; function `devbook-mcp` deployed at `https://6ktij8hk.function2.insforge.app/devbook-mcp`, deployed code identical to `mcp/devbook-mcp/handler.ts`; no token -> 401 with `x-request-id`. One owner token (prefix `FdjIqo7j`, read/draft/publish, expires 2027-01-20) registered by hash. Flags WRITE_TOOLS, PUBLISH_TOOL, DURABLE_LIMITS, DURABLE_AUDIT = true; 6/6 parallel `tools/list` probes show all 11 tools; `search_books` returns the owner's 3 books; a shared rate-limit row was written. No write or publish was performed on production content. Emergency stop: revoke the token (`node mcp/tools/mcp-token.mjs --revoke-prefix FdjIqo7j`), then set the flags to false.
* (v2, 2026-10-22) WEBSITE DEPLOYED: the Vercel project `devbook` is deployed from the CLI with prebuilt output (never from GitHub; it has no Vercel env vars). Built locally from `992711f` with `vercel build --yes --prod`, passing the PRODUCTION `VITE_INSFORGE_URL`/`VITE_INSFORGE_ANON_KEY` explicitly (the repo's `.env.local` points at TEST); output checked: production host and key present, no TEST reference, `reader_book_tree` present. `vercel deploy --prebuilt --prod` -> `devbook-3j7cyeth8-sairohiths-projects.vercel.app`, serving devbook.rohith.engineer (bundle `index-CsQ-_0pI.js`). Future deploys must be built the same way.
* (v2, 2026-10-22) PRODUCTION 03, 04, 08 applied after the v2 site was live: `20261022121700_policy-switch`, `20261022121808_helper-guard`, `20261022121920_hide-draft-only-phases`. Anonymous reader trees identical before/after (5 books, 14 phases, 105 steps, 0 unpublished steps; routing flow empty). Anonymous base tables: books 5 (unchanged), phases 15 -> 14, steps 106 -> 0 rows, members/attachments/invitations/mcp_tokens/backups 401, insert into books refused, updates/deletes affect 0 rows, `can_edit_book`/`can_delete_book`/`can_read_book` for the owner return false to anon, `can_manage_members` denied. Database still has 106 steps. Signed-in role tests and browser checks NOT TESTED yet (production requires email verification; it was not turned off).
* (v2, 2026-10-22) PRODUCTION role smoke 42/42 PASS on a throwaway book with two verified throwaway accounts (`sairohithtappatla45+dbk-owner@gmail.com`, `+dbk-stranger@gmail.com`; email verification stayed on). Throwaway book deleted, its MCP token (`4InXwuab`) revoked, credentials file removed; real data unchanged (5 books, 15 phases, 106 steps). The two accounts and their profile rows still exist (auth users cannot be deleted through the API; remove them in the InsForge dashboard if wanted). Evidence: `context/evidence-ledger.md` EVD-34..43. Open: routing flow step republish by its owner; browser checks.
* (v2, 2026-10-23) Vercel is now connected to GitHub: pushes to `main` build on Vercel (GitHub status "Vercel success" for `ff80496`; production deployment `devbook-rerdmvv4o`). The live bundle targets the production backend with the production key, has no TEST reference and calls `reader_book_tree`. Vercel env: `VITE_INSFORGE_URL` is set for Production only, so Preview builds have no backend URL until it is added for Preview.
* (v2, 2026-10-23) "routing flow" step 0.1 republished by its owner in the fixed editor (publishedMarkdown = draft; 02c never applied); readers now see 15 phases / 107 steps. Attachments are permanently out of scope (migration 09 not planned for production).
* (v2, 2026-10-23) Lint cleanup, no behaviour change: `src/` has 0 oxlint warnings. Contexts and hooks moved out of component files for fast refresh (`providers/auth-context.ts`, `providers/toast-context.ts`, `providers/search-context.ts`, `hooks/useSearch.ts`); route components moved from `app/router.tsx` to `app/route-components.tsx` (reader/editor use their route ids as strings); unused catch bindings removed. Editor selection effects now read the latest phases through one `phasesRef` updated in a layout effect, so they still run only when the selection changes (adding `phases` as a dependency would reload the step on every autosave refetch and overwrite typing); the duplicate `phasesRef` that updated in a later passive effect was removed. tsc, build and all frontend suites pass. The only remaining repo warnings are the two intentional control-character regexes in `mcp/devbook-mcp/handler.ts` (input validation; left untouched so the deployed function stays identical to the file).
* (v2, 2026-10-23) "Connect DevBook" (MCP OAuth 2.1) + Settings → MCP Connect, built and verified on TEST (not yet on production). New: `mcp/devbook-mcp/sql/003_mcp_oauth.sql` (+ rollback), edge function `mcp/devbook-oauth/handler.ts` (metadata, dynamic registration, token endpoint; PKCE S256, single-use codes, rotating refresh tokens with replay revocation), MCP 401 now advertises `resource_metadata`, consent page `/oauth/authorize`, `/settings` with connected apps (disconnect), personal tokens (created in the browser, hash-only on the server, permissions default all with read required) and per-client connect instructions; `vercel.json` proxies `/mcp`, `/.well-known/oauth-*`, `/oauth/token|register` to the production functions; Vite dev proxy for the same routes via `DEVBOOK_FUNCTIONS_ORIGIN`. Evidence EVD-44..51 (65/65 end-to-end on TEST). LIVE on production 2026-10-23 (migration `20261023121657_mcp-oauth`, both functions deployed, website `f4ba1a2`); public checks 14/14 (EVD-52..57). Server URL for users: https://devbook.rohith.engineer/mcp.
* (v2, 2026-10-23) MCP book tools live on production: `create_book` (DRAFT book owned by the caller, same shape as the website's New book; same title returns the existing book) and `publish_book` (owner-only, publish scope, two-phase confirmation; PUBLIC or UNLISTED). Multi-domain sign-in: both functions read `DEVBOOK_PUBLIC_ORIGINS` and answer for the domain a request came through (`origin_host` hint added by vercel.json), else the first entry; tokens work through every domain. Evidence EVD-58..62. Pending: push the vercel.json host hints, then reorder the list to `https://devbook-45.vercel.app,https://devbook.rohith.engineer` (vercel.app = permanent default; the free custom domain can simply be removed from the list if it lapses).


---

# Notes

Record implementation notes, workarounds, and architecture changes that occur during development.

This section should explain **why** a decision was made, not just **what** changed.

* (v2) Rollout order is fixed: 01, 02, 02b, then the patched website, then 03 + 04 together. 03 before the patched website would show empty books to non-editors, and rolling the website back before 03 has the same effect. Full procedure: `mcp/proposals/rls-hardening/final/PRODUCTION-RUNBOOK.md`.
* (v2) The TEST baseline was reconstructed from a 2026-10-18 production export, not exported from production directly; the runbook's drift check guards the rollback files against later production changes.
