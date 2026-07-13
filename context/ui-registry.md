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

