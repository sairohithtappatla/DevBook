# Build Plan

## Core Principle

Every screen is built with realistic mock data first and visually completed before connecting any backend logic.

Every feature must be fully visible, interactive, and approved before wiring it to InsForge.

No backend work should begin before the corresponding UI is complete.

---

# Phase 1 — Foundation

## 01 Landing Page

Build the complete landing page.

**UI**

* Hero section
* Feature cards
* Documentation preview
* CTA section
* Footer

**Logic**

* Logged-out users → Login
* Logged-in users → Home

---

## 02 Authentication

Implement InsForge authentication.

**UI**

* Login page
* Register page

**Logic**

* Email Authentication
* Google OAuth
* GitHub OAuth
* Session persistence
* Route protection

---

## 03 Database Foundation

Create the complete InsForge database before building any features.

**Logic**

Create tables:

* users
* books
* phases
* steps
* attachments
* progress
* followers

Create storage bucket:

* book-assets

Create Row Level Security policies.

---

## 04 Application Layout

Build the application shell.

**UI**

Permanent Sidebar

* Home
* My Books
* My Progress
* My Profile
* Logout

Top Navigation

Responsive layout

Theme

Navigation transitions

No page logic yet.

---

# Phase 2 — Home

## 05 Home Page

Build complete Home UI with mock books.

**UI**

* Search
* Featured Books
* Recently Published
* Continue Learning
* Book Cards

No backend yet.

---

## 06 Home Logic

Wire Home page to InsForge.

**Logic**

* Load published books
* Search books
* Open Book Details
* Get Started button

Clicking Get Started

↓

Creates Progress record if one does not already exist.

---

# Phase 3 — My Books

## 07 My Books UI

Build creator workspace.

**UI**

* Book Grid
* Create Book
* Edit
* Delete
* Preview

Mock data only.

---

## 08 Documentation Editor UI

Build the complete editor interface.

**UI**

* Markdown editor
* Sidebar tree
* Live preview
* Attachments
* Toolbar
* Properties panel

No parsing yet.

---

## 09 Markdown Import

Implement Markdown importing.

**Logic**

Support

* Paste Markdown
* Upload .md file

After clicking Import

Automatically

* Parse Markdown
* Detect Book
* Detect Phases
* Detect Steps

Generate the navigation tree.

No manual creation of sidebar items.

---

## 10 Structure Editing

Creator can modify imported structure.

**Logic**

* Rename Phase
* Rename Step
* Drag Phases
* Drag Steps
* Move Steps
* Delete
* Create Phase
* Create Step

Implemented using dnd-kit.

---

## 11 CRUD Operations

Connect editor to InsForge.

**Logic**

* Create Book
* Update Book
* Delete Book
* Save Markdown
* Save Tree Structure
* Upload Cover
* Upload Attachments

---

## 12 Visibility

Visibility management.

**Logic**

Support

* Public
* Private
* Followers Only
* Selected Followers

---

# Phase 4 — Documentation Reader

## 13 Documentation Reader UI

Build the complete documentation reader.

**UI**

Three-column layout.

Left

* Sidebar Tree

Center

* Documentation

Right

* On This Page

Bottom

* Previous
* Next
* Mark Complete

Mock data only.

---

## 14 Documentation Rendering

Render documentation.

**Logic**

Support

* Markdown
* Images
* Tables
* Code Blocks
* Mermaid
* Blockquotes
* Checklists

Shiki

Mermaid

react-markdown

---

## 15 Attachments

Implement downloadable resources.

**Logic**

Creator uploads

* PDF
* ZIP
* JSON
* Images

Readers download directly.

---

# Phase 5 — Progress

## 16 My Progress UI

Build progress page.

**UI**

* Continue Learning
* Progress Cards
* Completed Books
* Progress Overview

Mock data only.

---

## 17 Progress Logic

Wire progress to database.

**Logic**

Every reader owns independent progress.

Support

* Mark Complete
* Mark Uncompleted
* Continue Reading
* Last Read Step
* Completion Percentage

Automatically update progress.

---

# Phase 6 — Profile

## 18 Profile UI

Build profile page.

**UI**

* Avatar
* About
* Followers
* Following
* Published Books

Mock data only.

---

## 19 Profile Logic

Connect profile.

**Logic**

* Edit Profile
* Upload Avatar
* Update About
* Followers
* Following

---

# Phase 7 — Search

## 20 Search

Implement global search.

**Logic**

Search

* Books
* Creators

Real-time filtering.

---

# Phase 8 — Polish

## 21 Quality Improvements

Complete application polish.

**Tasks**

* Empty states
* Loading states
* Error states
* Skeleton loaders
* Toast notifications
* Keyboard shortcuts
* Accessibility
* Responsive improvements
* Performance optimization

---

# Feature Count

| Phase                          | Features |
| ------------------------------ | -------- |
| Phase 1 — Foundation           | 4        |
| Phase 2 — Home                 | 2        |
| Phase 3 — My Books             | 6        |
| Phase 4 — Documentation Reader | 3        |
| Phase 5 — Progress             | 2        |
| Phase 6 — Profile              | 2        |
| Phase 7 — Search               | 1        |
| Phase 8 — Polish               | 1        |
| **Total**                      | **21**   |
