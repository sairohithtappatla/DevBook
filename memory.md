# Memory — Framer Carousel & Decoupled Featured Books View

Last updated: 2026-07-13 23:57 IST

## What was built

- **Framer Motion Horizontal Carousel**:
  - Implemented a custom draggable and spring-animated horizontal slider component (`FramerCarousel`) inside [HomePage.tsx](file:///d:/Project/devbook/src/routes/home/HomePage.tsx) using `framer-motion`.
  - Added spring-damping physics (`damping: 30, stiffness: 220`) and diagonal swipe drag bounds.
  - Bound vertical mouse wheel movements to scroll the carousel track smoothly, releasing intercept control at scrolling boundaries.
  - Guarded card clicks using a drag tracking ref to prevent accidental redirects when swiping cards.

- **Decoupled Featured Books Route**:
  - Created [FeaturedBooksPage.tsx](file:///d:/Project/devbook/src/routes/featured/FeaturedBooksPage.tsx) to host the full 24-book project catalog browse grid and dynamic pagination rules (`columns * 4`) independently.
  - Configured [App.tsx](file:///d:/Project/devbook/src/App.tsx) case `"featured"` to mount the new standalone route.

- **Header Page Titles & Global Search Integration**:
  - Expanded [TopNavigation.tsx](file:///d:/Project/devbook/src/components/layout/TopNavigation.tsx) and [AppShell.tsx](file:///d:/Project/devbook/src/components/layout/AppShell.tsx) with a `title` prop to render page names next to the drawer menu trigger.
  - Enabled the top header search bar for both `"home"` and `"featured"` tabs, removing duplicate inline search elements from the catalog.

- **Inline Horizontal Categories & Highlighting**:
  - Refactored [CategoriesWidget.tsx](file:///d:/Project/devbook/src/components/home/CategoriesWidget.tsx) to support a `layout="horizontal"` mode that disables vertical transformations on desktop screens and hides the title label.
  - Placed category filters inline horizontally next to the subtitle inside `FeaturedBooksPage.tsx`.
  - Styled selected category buttons to render a contrast black background (`bg-black text-white` / `dark:bg-white dark:text-black`) when in horizontal layout.

- **Clean Single-Column Layout (Featured Books)**:
  - Configured `getRightPanelContent()` in `App.tsx` to return `null` on the `"featured"` tab, removing the right panel sidebar so the catalog grid expands to full width.

## Decisions made

- **Single Global Search Context**: Used the header search component for all search actions to keep the main view content clean.
- **Dynamic Row Pagination**: Calculated catalog sizes at runtime (`pageSize = cols * 4`) to ensure exactly 4 rows render per page across all viewport widths.

## Problems solved

- **Card Click Redirection Conflicts**: Addressed card click redirects firing during carousel swipes by deferring selection callbacks until drag animations fully complete.
- **Page Scroll Intercept Locks**: Solved vertical mouse wheel scrolls getting trapped on the horizontal carousel by detecting bounds and releasing native vertical page scroll when hitting the start or end of the track.

## Current state

- Draggable carousels, horizontal header alignments, decoupled routing, and paginated lists compile and build with zero errors.

## Next session starts with

- Moving to **Phase 3 — Documentation Engine** (Markdown rendering, MDXEditor configuration, react-markdown, Shiki syntax highlighter, and Mermaid rendering).

## Open questions

- None.
