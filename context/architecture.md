# Architecture

## Stack

| Layer               | Tool                                | Purpose                             |
| ------------------- | ----------------------------------- | ----------------------------------- |
| Framework           | React 19 + Vite                     | SPA application                     |
| Language            | TypeScript (Strict)                 | Entire project                      |
| Routing             | TanStack Router                     | Application routing                 |
| Data Fetching       | TanStack Query                      | Server state management             |
| Backend             | InsForge                            | PostgreSQL, Authentication, Storage |
| Styling             | Tailwind CSS + shadcn/ui            | UI system                           |
| Forms               | React Hook Form + Zod               | Form state and validation           |
| Markdown Editor     | MDXEditor                           | Documentation authoring             |
| Markdown Parser     | unified + remark                    | Markdown → structured tree          |
| Markdown Renderer   | react-markdown                      | Documentation rendering             |
| Syntax Highlighting | Shiki                               | Code blocks                         |
| Mermaid             | Mermaid.js                          | Architecture diagrams               |
| Drag & Drop         | dnd-kit                             | Reordering phases and steps         |
| Icons               | Lucide React                        | Icon library                        |
| Deployment          | Vercel / Netlify / Cloudflare Pages | Static hosting                      |

---

# Folder Structure

```text
/
├── AGENTS.md
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── build-plan.md
│   ├── code-standards.md
│   ├── library-docs.md
│   ├── progress-tracker.md
│   ├── ui-rules.md
│   ├── ui-tokens.md
│   └── ui-registry.md
│
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── query-client.ts
│   │
│   ├── routes/
│   │   ├── login/
│   │   ├── home/
│   │   ├── books/
│   │   │   ├── index.tsx
│   │   │   ├── create.tsx
│   │   │   ├── edit.$bookId.tsx
│   │   │   └── view.$slug.tsx
│   │   ├── progress/
│   │   └── profile/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── books/
│   │   ├── editor/
│   │   ├── reader/
│   │   ├── profile/
│   │   └── progress/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── books/
│   │   ├── markdown/
│   │   ├── progress/
│   │   ├── profile/
│   │   └── followers/
│   │
│   ├── lib/
│   │   ├── insforge.ts
│   │   ├── markdown-parser.ts
│   │   ├── markdown-renderer.tsx
│   │   ├── mermaid.ts
│   │   ├── shiki.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   ├── types/
│   ├── styles/
│   └── assets/
│
└── public/
```

---

# System Boundaries

| Folder     | Owns                                            |
| ---------- | ----------------------------------------------- |
| routes     | Pages only. No business logic.                  |
| features   | Business logic, queries, mutations, validation. |
| components | UI only. No direct database calls.              |
| lib        | Third-party libraries and shared utilities.     |
| hooks      | Shared React hooks.                             |
| types      | Shared TypeScript types.                        |

---

# Application Flow

## Reading Documentation

```text
User

↓

Home

↓

Select Book

↓

Documentation Reader

↓

Read Documentation

↓

Mark Step Complete

↓

Progress Updated
```

---

## Creating Documentation

```text
Creator

↓

Create Book

↓

Paste Markdown
or
Upload .md File

↓

Parse Markdown

↓

Generate Book Tree

↓

Creator Reviews Structure

↓

Edit / Drag / Rename

↓

Publish
```

---

## Markdown Import Flow

```text
Markdown

↓

remark + unified

↓

Markdown AST

↓

Book

↓

Phase

↓

Step

↓

Store in Database
```

The imported Markdown automatically generates the complete navigation tree.

No manual sidebar creation is required.

---

## Documentation Rendering Flow

```text
Markdown

↓

react-markdown

↓

Shiki

↓

Mermaid

↓

Documentation Components

↓

Reader UI
```

---

## Progress Flow

```text
Reader

↓

Mark Complete

↓

Update Progress

↓

Refresh Progress

↓

Update Home

↓

Update My Progress
```

Each reader maintains independent progress.

---

# Markdown Parsing Rules

The parser follows a strict hierarchy.

```text
#      → Book

##     → Phase

###    → Step

Everything below a Step belongs to that Step until another heading appears.
```

Example

```markdown
# Workflow Engine

## Phase 0

### Install Node

content...

### Setup Project

content...

## Phase 1

### Express

content...
```

Automatically becomes

```text
Workflow Engine

Phase 0

Install Node

Setup Project

Phase 1

Express
```

---

# Documentation Editor

The editor supports two workflows.

## Import Markdown

* Paste Markdown
* Upload .md file
* Automatic parsing
* Automatic sidebar generation

---

## Manual Writing

* Create Book
* Add Phase
* Add Step
* Write Markdown
* Upload Attachments

---

# Drag & Drop

Supported operations

* Reorder Phases
* Reorder Steps
* Move Steps between Phases
* Rename
* Delete
* Add New Phase
* Add New Step

Implemented using dnd-kit.

---

# Rendering Pipeline

Documentation supports

* Markdown
* Code Blocks
* Tables
* Images
* Blockquotes
* Checklists
* Mermaid Diagrams

Rendered using react-markdown.

Code blocks rendered with Shiki.

Mermaid blocks rendered as SVG diagrams.

---

# Attachments

Each book may contain downloadable resources.

Examples

* PDF
* ZIP
* JSON
* Images

Files are stored in InsForge Storage.

Readers can download them directly.

---

# Database Collections

## users

Stores

* Profile
* Avatar
* About
* Followers
* Following

---

## books

Stores

* Title
* Description
* Cover
* Visibility
* Creator
* Raw Markdown
* Published Status

---

## phases

Stores

* Book
* Title
* Position

---

## steps

Stores

* Phase
* Title
* Markdown Content
* Position

---

## attachments

Stores

* Book
* File Name
* Storage URL
* File Type

---

## progress

Stores

* User
* Book
* Completed Steps
* Percentage
* Last Read Step

---

# Authentication

Provider

* InsForge Authentication

Supported

* Email
* Google OAuth
* GitHub OAuth

Protected Routes

```text
/books

/books/create

/books/edit

/progress

/profile
```

Public Routes

```text
/

/login

/books/:slug
```

---

# Query Pattern

All server communication goes through TanStack Query.

```text
Component

↓

Query Hook

↓

InsForge

↓

Cache

↓

UI
```

Mutations

```text
Form

↓

Mutation Hook

↓

InsForge

↓

Invalidate Query

↓

Fresh UI
```

---

# Storage Pattern

Book

↓

Attachments

↓

InsForge Storage

↓

Public or Protected URL

↓

Download Button

---

# Invariants

Rules that must never be violated.

* Raw Markdown is always the source of truth.
* Sidebar navigation is always generated from parsed Markdown.
* Creators never manually build the navigation tree.
* Readers cannot edit published books.
* Readers cannot duplicate books.
* Progress belongs to each individual reader.
* Markdown parsing must preserve heading hierarchy.
* All code blocks use Shiki.
* All Mermaid blocks render automatically.
* Attachments are always downloadable.
* UI components never access the database directly.
* Business logic lives inside the feature layer.
* Components remain presentation-only.
* Every drag-and-drop operation updates the ordering fields without recreating records.
