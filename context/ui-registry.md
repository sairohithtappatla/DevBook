# UI Registry

Living document.

This file is the single source of truth for every reusable UI component used throughout DevBook.

Every new component must be registered here after implementation.

The goal is visual consistency across the entire application.

---

# How To Use

Before building any screen

1. Read **ui-rules.md**
2. Read **ui-tokens.md**
3. Read this registry.

If a component already exists

→ Reuse it.

Do not create another variation.

If a new component is required

→ Build it

→ Register it here

→ Reuse it everywhere.

---

# Component Rules

Every reusable component must contain

* Name
* Purpose
* File Location
* Props
* Variants
* States
* Usage Notes

Never duplicate components.

---

# Layout Components

## AppSidebar

Purpose

Main application navigation.

Used In

* Home
* My Books
* My Progress
* My Profile
* Documentation Reader
* Documentation Editor

Contains

* Logo
* Navigation
* User Section

Variants

* Expanded
* Collapsed

Location

```text
src/components/layout/AppSidebar.tsx
```

---

## TopNavigation

Purpose

Top navigation bar.

Contains

* Breadcrumb
* Search
* Actions
* User Avatar

Location

```text
src/components/layout/TopNavigation.tsx
```

---

## PageContainer

Purpose

Standard page wrapper.

Used on every page.

Responsible for

* Width
* Padding
* Responsive spacing

---

# Navigation Components

## SidebarItem

Purpose

Single navigation item.

States

* Default
* Hover
* Active

---

## Breadcrumb

Purpose

Displays current navigation hierarchy.

Example

```text
My Books

>

Workflow Engine

>

Editor
```

---

# Book Components

## BookCard

Purpose

Displays a learning book.

Used In

* Home
* My Books
* Profile

Contains

* Cover
* Title
* Description
* Author
* Reading Time
* Visibility
* Get Started

Variants

* Feed
* Grid
* Compact

---

## BookGrid

Purpose

Responsive grid layout for Book Cards.

---

## BookCover

Purpose

Displays book thumbnail.

Fallback

Gradient placeholder.

---

# Documentation Components

## DocumentationSidebar

Purpose

Automatically generated navigation tree.

Hierarchy

```text
Book

↓

Phase

↓

Step
```

Supports

* Collapse
* Expand
* Drag (Editor Only)

---

## DocumentationContent

Purpose

Main reading area.

Supports

* Markdown
* Images
* Tables
* Lists
* Blockquotes
* Code
* Mermaid

---

## OnThisPage

Purpose

Displays current page headings.

Generated automatically.

---

## CodeBlock

Purpose

Syntax-highlighted code.

Supports

* Copy Button
* Line Numbers
* Language Label

Rendered with

Shiki

---

## MermaidDiagram

Purpose

Render Mermaid blocks.

Output

SVG

---

## MarkdownPreview

Purpose

Live documentation preview.

Used only in Documentation Editor.

---

# Editor Components

## MarkdownEditor

Purpose

Primary editing experience.

Supports

* Toolbar
* Markdown
* Image Upload
* Tables
* Mermaid
* Undo
* Redo

---

## StructureTree

Purpose

Editable documentation tree.

Supports

* Drag Phase
* Drag Step
* Rename
* Delete
* Add Phase
* Add Step

Generated from Markdown.

---

## Toolbar

Purpose

Markdown formatting actions.

Contains

* Heading
* Bold
* Italic
* List
* Table
* Code
* Image
* Mermaid

---

## PropertiesPanel

Purpose

Book metadata editor.

Contains

* Title
* Description
* Visibility
* Reading Time
* Cover

---

# Progress Components

## ProgressCard

Purpose

Displays learning progress.

Contains

* Progress Bar
* Percentage
* Continue Button

Variants

* In Progress
* Completed

---

## ProgressBar

Purpose

Displays completion percentage.

Sizes

* Small
* Medium
* Large

---

# Profile Components

## ProfileHeader

Purpose

Displays

* Avatar
* Name
* Bio
* Followers
* Following
* Books

---

## UserCard

Purpose

Follower / Following item.

---

# Shared Components

## LoginPage

Purpose

Full authentication entry screen matching the approved login reference.

Used In

* Login

Location

```text
src/routes/login/LoginPage.tsx
```

Props

None.

Variants

* Desktop split layout
* Responsive stacked layout

States

* Dynamic Modes: `login`, `signup`, `forgot-password` (handled in local state)
* Default, Hover, Focus on inputs/buttons
* Password visibility toggle

Usage Notes

Uses the public `login.png` illustration as the left brand panel background and `logo.svg` in the brand mark. The right panel dynamically renders the sign-in form, sign-up form (adds Name input), or forgot-password form (email only) depending on the active state. Standardized inputs, social buttons, primary submit buttons, and trust messages are used throughout. All colors stay on DevBook tokens.

### LoginPage Pattern

File: `src/routes/login/LoginPage.tsx`
Last updated: 2026-07-13

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | `bg-surface-secondary`, `bg-surface`, `bg-code-background`            |
| Border           | `border border-border`                                                |
| Border radius    | `rounded-xl`, `rounded-md`, `rounded-full`                            |
| Text primary     | `text-text-primary`, `text-code-foreground`                           |
| Text secondary   | `text-text-secondary`, `text-text-muted`, `text-code-foreground/85`   |
| Spacing          | `p-5`, `px-8 py-8`, `gap-2`, `gap-3.5`, `gap-6`                       |
| Hover state      | `hover:bg-surface-secondary`, `hover:bg-[#1E293B] dark:hover:bg-[#2D3748]` |
| Focus state      | `focus:ring-2 focus:ring-primary`, `focus-within:ring-2`              |
| Shadow           | `shadow-xs`, `shadow-md`                                              |
| Accent usage     | `text-primary`, `accent-primary`                                      |
| Animation        | `animate-fade-in` (200ms cubic-bezier transition)                     |

**Pattern notes:**
Login uses a two-panel documentation-product auth pattern: a dark asset-backed brand panel paired with a quiet white form panel. Inputs and buttons keep the same `h-11`/`h-12`, `rounded-md`, `border-border`, and token focus ring pattern. Handles inline OTP input fields with `gap-2` spacing and automated navigation. The layout transitions smoothly using the custom `@keyframes fadeIn` 200ms fade transition.

## SearchBar

Used on

* Home
* My Books

---

## EmptyState

Used when data does not exist.

Examples

* No Books
* No Progress
* No Followers

---

## LoadingSkeleton

Used while loading.

Never use spinners for page loads.

---

## ConfirmDialog

Used for

* Delete Book
* Logout
* Remove Attachment

---

## FileUploader

Purpose

Upload

* Markdown
* Images
* Attachments

Supports

* Drag & Drop
* Click Upload

---

## VisibilityBadge

Variants

* Public
* Private
* Followers
* Selected

---

## Avatar

Used everywhere.

Sizes

* Small
* Medium
* Large

---

## Button

Variants

* Primary
* Secondary
* Ghost
* Outline
* Danger

Never create custom button styles.

Always reuse this component.

---

## Input

Variants

* Text
* Search
* Password
* Multiline

---

## Card

Base container for

* Books
* Progress
* Settings

---

# Icons

Use only

Lucide React

Never mix icon libraries.

---

# Naming Convention

Components

```text
PascalCase
```

Examples

```text
BookCard

DocumentationSidebar

ProgressCard
```

Hooks

```text
camelCase
```

Examples

```text
useBooks

useProfile

useProgress
```

---

# Registry Update Rules

Whenever a new reusable component is created

Update this document with

* Component Name
* Purpose
* Location
* Props
* Variants
* States

No component should exist without being registered.

---

# Component Invariants

* Every reusable UI element belongs in this registry.
* Never duplicate an existing component.
* Prefer composition over creating new variants.
* Every component must follow ui-rules.md and ui-tokens.md.
* Shared components are always preferred over page-specific implementations.
* Documentation components must remain reusable between the Reader and the Editor.
* Visual consistency is more important than introducing new styles.

---

### LoginPage

File: [LoginPage.tsx](file:///d:/Project/devbook/src/routes/login/LoginPage.tsx)
Last updated: 2026-07-13

| Property         | Class                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Background       | `bg-background` (right panel), `bg-surface-secondary` / `dark bg-[#010409]` (wrapper), `bg-code-background` (left brand panel) |
| Border           | `border-border`                                                  |
| Border radius    | `rounded-[24px]` (main container), `rounded-md` (inputs, buttons), `rounded-xl` (interactive overlays) |
| Text — primary   | `text-text-primary` (light/dark form labels & body headers), `text-white` (brand headers) |
| Text — secondary | `text-text-secondary` (light/dark subtitles & form helpers)      |
| Spacing          | `gap-3.5` (form fields), `gap-2` (OTP boxes), `px-8 lg:px-12` (panel margins) |
| Hover state      | `hover:bg-[#1E293B] dark:hover:bg-[#2D3748]` (submit buttons), `hover:bg-surface-secondary` (OAuth/theme buttons) |
| Shadow           | `shadow-md` (main container), `shadow-xs` (buttons)              |
| Accent usage     | `text-primary`, `bg-primary`, `accent-primary`, text color `#818CF8` (brand subtitle) |

**Pattern notes:**
- Implements a modern multi-state auth interface inside a single wrapper (Login, Sign-Up with OTP verification, Forgot Password with OTP validation & Password reset) using inline transitions to prevent layout shifts.
- Button loaders are rendered inline inside submit buttons rather than using page blurs.
- Theme switching is implemented via class-based re-mapping of tailwind tokens (`.dark`).

### AppShell Layout

File: [AppShell.tsx](file:///d:/Project/devbook/src/components/layout/AppShell.tsx)
Last updated: 2026-07-13

| Property | Value / Pattern |
| --- | --- |
| Max Width | `w-screen h-screen overflow-hidden` (strict viewport lock) |
| Left Sidebar | `w-[180px]` permanent (`>= 1024px`), drawer (`< 1024px`) |
| Top Nav | Height `h-16` (64px) fixed, contains search context integration |
| Right Panel | `w-[300px]` permanent (`>= 1280px`), hidden/relocated (`< 1280px`) |
| Scrollbars | Low contrast webkit scrollbars (`6px` wide, border-color color) |

**Pattern notes:**
- Pins header and sidebars, making only the CenterFeed scrollable using `ScrollArea`.
- Restricts vertical layouts using React responsive rendering, keeping only a single instance of widgets (e.g. Categories, TopCreators) active at a time.

### BookCard & BookGrid

File: [BookCard.tsx](file:///d:/Project/devbook/src/components/books/BookCard.tsx)
Last updated: 2026-07-13

| Property | Style / Tokens |
| --- | --- |
| Card Border | `border border-border rounded-xl shadow-xs` |
| Hover State | `hover:border-primary/30 hover:shadow-sm transition-all` |
| Cover Banner | Aspect `video` w-full border-b border-border |
| Fallbacks | Pseudo-random gradient generation based on Title string |

**Pattern notes:**
- Dynamic aspect-ratio responsive grid layout resizing between 1-4 columns based on breakpoints.
- Flexible variants: `"grid"`, `"feed"`, or `"compact"` list item.

### FramerCarousel

File: [HomePage.tsx](file:///d:/Project/devbook/src/routes/home/HomePage.tsx) (FramerCarousel component)
Last updated: 2026-07-13

| Property | Value / Pattern |
| --- | --- |
| Drag Direction | `x` (horizontal only) |
| Friction / Stiffness | Spring configuration `{ damping: 30, stiffness: 220, mass: 0.8 }` |
| Boundaries Elasticity | `dragElastic={0.08}` |
| Touch Action | `pan-y` (allows vertical page swipes on touch screens) |

**Pattern notes:**
- Maps horizontal motion physics using `useSpring` and `useMotionValue`.
- Intercepts vertical mouse wheel scroll to slide the carousel horizontally.
- Detects start and end boundaries to release parent page scrolling.

### FeaturedBooksPage Route

File: [FeaturedBooksPage.tsx](file:///d:/Project/devbook/src/routes/featured/FeaturedBooksPage.tsx)
Last updated: 2026-07-13

| Property | Style / Pattern |
| --- | --- |
| Layout Mode | Single-column, right sidebar removed |
| Page Size | Responsive columns * 4 (maintains exactly 4 rows per page) |
| Subtitle Row | Inline Categories widget on horizontal layout |
| Active Highlights | Contrast black highlights (`bg-black text-white`) |

**Pattern notes:**
- Multi-column grid layout containing catalog items.
- Incorporates dynamic pagination controls.
- Uses top navigation header for search inputs.

### ProgressPage

File: [ProgressPage.tsx](file:///d:/Project/devbook/src/routes/progress/ProgressPage.tsx)
Last updated: 2026-07-14

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | `bg-surface-secondary` (wrapper), `bg-surface` (cards)                 |
| Border           | `border border-border`                                                |
| Border radius    | `rounded-xl`                                                          |
| Text — primary   | `text-text-primary`                                                   |
| Text — secondary | `text-text-secondary`                                                 |
| Spacing          | `p-4` (card padding), `gap-4` (grid/layout gaps)                      |
| Hover state      | `hover:shadow-xs`                                                     |
| Shadow           | `shadow-xs`, `shadow-sm`                                              |
| Accent usage     | `bg-[#111827] text-white` (primary CTA buttons), `bg-[#16A34A]` (progress bar) |

**Pattern notes:**
- Integrates progress tracking lists with responsive container heights.
- Handles client pagination and grid-to-list layout patterns.

### ProgressRightPanel

File: [ProgressRightPanel.tsx](file:///d:/Project/devbook/src/routes/progress/ProgressRightPanel.tsx)
Last updated: 2026-07-14

| Property         | Class                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Background       | `bg-surface` (cards)                                                  |
| Border           | `border border-border`, `border-border/40`                            |
| Border radius    | `rounded-xl`                                                          |
| Text — primary   | `text-text-primary`                                                   |
| Text — secondary | `text-text-secondary`, `text-text-muted`                              |
| Spacing          | `p-4` (card padding), `gap-4` (panel container gap)                   |
| Hover state      | `hover:bg-surface-secondary`                                          |
| Shadow           | `shadow-xs`                                                           |

**Pattern notes:**
- Displays dashboard widgets (Calendar, Donut Graph, Recent Achievements list) using proportional `flex-1` heights.
- Locks bounds to the single viewport without inducing overflow scroll.

### BookEditorPage

File: [BookEditorPage.tsx](file:///d:/Project/devbook/src/routes/books/BookEditorPage.tsx)
Last updated: 2026-07-14

| Property         | Class / Style |
| ---------------- | ------------- |
| Background       | `bg-surface` (workspace), `bg-sidebar` (left/right columns), `bg-surface-secondary` (toolbars, footer) |
| Border           | `border-r border-border`, `border-l border-border`, `border-b border-border` |
| Text — primary   | `text-text-primary` (active headers/text) |
| Text — secondary | `text-text-secondary` (descriptions/subtitles) |
| Layout           | Three columns: Navigation tree (280px), Workspace (flex-1), Inspector (300px) |
| Motion           | Transition-all hover states, fade-in transition on code preview renders |

**Pattern notes:**
- Workspace coordinates a split view (Edit + Live Preview), Edit-only view, and Full preview view.
- Auto-saving state debounces changes in 1.5 seconds.
- Keyboard shortcut `Ctrl+K` toggles CMD navigation popup modal.

### BookReaderPage

File: [BookReaderPage.tsx](file:///d:/Project/devbook/src/routes/books/BookReaderPage.tsx)
Last updated: 2026-07-14

| Property         | Class / Style |
| ---------------- | ------------- |
| Background       | `bg-surface` (workspace), `bg-sidebar` (left/right columns), `bg-surface-secondary` (inline widgets) |
| Border           | `border-r border-border`, `border-l border-border`, `border-b border-border` |
| Text — primary   | `text-text-primary` (active headers/text) |
| Text — secondary | `text-text-secondary` (descriptions/subtitles) |
| Layout           | Three columns: Navigation tree (280px), Workspace (flex-1), Widget Inspector (300px) |
| Motion           | Transition-all hover states on card button pagination |

**Pattern notes:**
- Edge-to-edge fullscreen documentation reader with progress calculations.
- Central search matches step lists with jump redirects.
- Keyboard shortcut `Ctrl+K` toggles CMD search step overlay modal.

### Global Typography Tokens

File: [index.css](file:///d:/Project/devbook/src/index.css)
Last updated: 2026-07-14

| Property         | Class / Token |
| ---------------- | ------------- |
| Body font        | `--font-body: "Work Sans", sans-serif` |
| Sans utility     | `--font-sans: "Work Sans", sans-serif` |
| Heading font     | `--font-heading: "JetBrains Mono", monospace` |
| Code font        | `--font-code: "JetBrains Mono", monospace` |
| Applied root     | `html`, `body` use `var(--font-body)` |

**Pattern notes:**
- Sidebar navigation and other `font-sans` body UI should resolve to Work Sans.
- Page titles, documentation titles, and section headings should continue using `font-heading`.
- Code-oriented surfaces should continue using `font-code`.

### Sidebar Compact Typography

File: [Sidebar.tsx](file:///d:/Project/devbook/src/components/layout/Sidebar.tsx)
Last updated: 2026-07-14

| Property         | Class / Token |
| ---------------- | ------------- |
| Sidebar font     | `font-sidebar`, `--font-sidebar: "Roboto", sans-serif` |
| Brand text       | `text-base font-semibold leading-none text-text-primary` |
| Navigation text  | `text-[13px] leading-none font-medium`, active `font-semibold` |
| Label color      | `text-current` inherited from button state |
| Spacing          | Existing sidebar spacing retained; typography-only changes allowed |
| Background       | `bg-white`, active `bg-surface-secondary` |
| Text colors      | `text-text-primary`, `text-text-secondary` |
| Hover state      | `hover:bg-surface-secondary hover:text-text-primary` |

**Pattern notes:**
- Sidebar keeps the existing width and nav item geometry; only font family, font size, and text color should be changed for typography fit work.
- Hit areas remain at `h-10` for nav buttons and `h-9` for logout.

### MyBooks Middle Section

File: [MyBooksPage.tsx](file:///d:/Project/devbook/src/routes/books/MyBooksPage.tsx)
Last updated: 2026-07-14

| Property         | Class / Token |
| ---------------- | ------------- |
| Content shell    | `.page-content-container.my-books-page`, `padding: 40px`, `font-family: var(--font-workspace)` |
| Header layout    | `.my-books-header-row`, `gap: 24px`, `margin-bottom: 32px` |
| Title            | `.page-title`, `24px / 1.2`, `font-weight: 600`, `text-primary` |
| Description      | `.page-subtext`, `13px / 20px`, `text-secondary`, `margin-top: 6px` |
| Primary action   | `.btn-create-book`, `40px` height, `13px`, `font-weight: 600`, `bg-text-primary` |
| Tabs             | `.tabs-filters-row`, `.tab-btn`, active `2px` text-primary underline |
| Filters          | `.filter-dropdown`, `32px` height, `12px`, token border and surface background |
| Table            | `.data-table-container`, `8px` radius, token border, surface background |
| Table header     | `.data-table th`, `11px`, uppercase, token muted text, `12px 20px` padding |
| Table rows       | `.data-table td`, `16px 20px` padding, `border-light` dividers |
| Table title      | `.table-book-title`, `13px / 18px`, `font-weight: 600` |
| Table metadata   | `.table-book-desc` `12px / 20px`; `.table-book-phases` and date subtext `11px / 16px` |
| Badges/status    | `.badge` and `.status-line`, `12px / 16px`, token status colors |

**Pattern notes:**
- My Books is rendered as the exact middle workspace content with no top navigation bar on this tab.
- The content follows the provided reference class structure: header row, tabs/filter row, data table, actions, and pagination.
- Typography uses scoped CSS classes rather than utility composition so Roboto, text sizes, row padding, and tab/table spacing remain exact for the middle section.
- Colors use DevBook tokens instead of raw hex/default Tailwind palettes.

### CreateBookCTA

File: [CreateBookCTA.tsx](file:///d:/Project/devbook/src/components/home/CreateBookCTA.tsx)
Last updated: 2026-07-14

| Property         | Class |
| ---------------- | ----- |
| Background       | `bg-white` |
| Border           | None |
| Border radius    | `rounded-xl` (container), `rounded-md` (button) |
| Text — primary   | `text-text-primary` |
| Text — secondary | `text-text-secondary` |
| Spacing          | `p-3`, `mt-3`, `space-y-5` (wrapper layout), `space-y-3` (text stack) |
| Hover state      | `hover:bg-black/90` (button) |
| Shadow           | None |
| Accent usage     | `bg-text-primary` (button background), `text-white` (button text) |

**Pattern notes:**
- Rendered inside the home page dashboard/widgets area.
- Highlights a clear call to action to create a book with an prominent icon (`Sparkles` at `w-8 h-8`).
- Uses standard typography (`font-heading` for title, `font-sans` for description).
- Clean spacing with `mt-3` and card padding `p-3` for desktop fit.

### ProfilePage

File: [ProfilePage.tsx](file:///d:/Project/devbook/src/routes/profile/ProfilePage.tsx)
Last updated: 2026-07-14

| Property         | Class |
| ---------------- | ----- |
| Background       | `bg-surface` (card panels), `page-content-container my-books-page` (wrapper) |
| Border           | `border border-border`, `border-t border-border/40` |
| Border radius    | `rounded-xl` (main container), `rounded-lg` (buttons), `rounded-full` (avatar) |
| Text — primary   | `text-text-primary`, `font-heading text-lg font-bold` |
| Text — secondary | `text-text-secondary`, `text-xs` |
| Spacing          | `space-y-3` (outer elements), `px-4 pb-4 pt-2` (banner container), `gap-4` (avatar layouts) |
| Hover state      | `hover:bg-surface-secondary` (buttons), `hover:text-text-primary` (links) |
| Shadow           | `shadow-xs`, `shadow-sm` |
| Accent usage     | `bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600` (cover background) |

**Pattern notes:**
- Merges profile banner card, bio, social links and pagination inside a unified, border-to-border layout shell.
- Lifts the main card component using negative margins (`-mt-6 md:-mt-8`) to overlap transparent navigation zones correctly.
- Features standard table-tab pagination footers and matches tabs navigation styling (`tabs-filters-row`, `tab-btn`) with the My Books page.
