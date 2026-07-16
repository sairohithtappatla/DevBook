# Progress Tracker

Update this file after every completed milestone.

This document is the single source of truth for the project's implementation progress.

Every completed milestone must be checked before starting the next one.

---

# Current Status

**Current Phase**

Database Integration & Polish

**Last Completed**

Public landing page at /, public reader route at /books/$bookId, and dynamic Auth-Header state

**Currently Working**

Final polish of remaining views and lint verification

**Next Milestone**

Resolve remaining lint warnings and bundle-size follow-up

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

---

# Notes

Record implementation notes, workarounds, and architecture changes that occur during development.

This section should explain **why** a decision was made, not just **what** changed.
