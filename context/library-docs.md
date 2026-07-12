# Library Docs

Project-specific usage patterns for every third-party library used in DevBook.

This document defines **how each library should be used in this project**, not how the library works in general.

Always follow these conventions before implementing a feature.

---

# Before Using Any Library

Before writing code:

1. Read **project-overview.md**
2. Read **architecture.md**
3. Read **code-standards.md**
4. Read this file

If an official MCP server or AI skill exists for a library, always prefer that documentation over memory.

Priority

```text
Official Documentation

↓

MCP / AI Skill

↓

library-docs.md

↓

General Knowledge
```

---

# React 19

Purpose

Entire application UI.

Rules

* Functional Components only
* Hooks only
* No class components
* Named exports only
* Keep components small
* Components are presentation only

Never place business logic inside components.

---

# Vite

Purpose

Development server and production build.

Rules

* SPA only
* No SSR
* No server routes
* Environment variables begin with

```text
VITE_
```

Never access process.env directly.

Always use

```ts
import.meta.env
```

---

# TanStack Router

Purpose

Application routing.

Routes live inside

```text
src/routes/
```

Typical routes

```text
/

login

books

books/:slug

books/:bookId/edit

progress

profile/:username
```

Rules

* Route files only contain page composition.
* Business logic belongs inside feature hooks.
* Route loaders only fetch required data.

---

# TanStack Query

Purpose

Server state management.

Pattern

```text
Component

↓

Query Hook

↓

Feature

↓

InsForge
```

Never call InsForge directly inside UI components.

Always create reusable hooks.

Example

```ts
useBooks()

useBook()

useProfile()

useProgress()
```

Mutations

```text
Component

↓

Mutation Hook

↓

InsForge

↓

Invalidate Queries
```

---

# InsForge

Purpose

Authentication

Database

Storage

Rules

* All CRUD operations go through feature functions.
* Never access the database directly from components.
* Always handle database errors.
* Store only public attachment URLs inside the database.
* Every book belongs to exactly one creator.
* Progress belongs to the current authenticated user.

Storage Buckets

```text
covers

attachments

avatars
```

---

# React Hook Form

Purpose

All forms.

Rules

Used for

* Login
* Register
* Profile
* Book Settings
* Metadata Forms

Never use uncontrolled forms.

---

# Zod

Purpose

Validation.

Used for

* Forms
* API responses
* Markdown import validation

Rules

Every form schema belongs beside the feature.

Example

```text
features/books/schema.ts
```

---

# MDXEditor

Purpose

Markdown authoring.

Supports

* Headings
* Lists
* Tables
* Images
* Code Blocks
* Mermaid
* Links

Rules

Always store

Raw Markdown

Never generated HTML.

---

# unified + remark

Purpose

Markdown parsing.

Workflow

```text
Markdown

↓

AST

↓

Book

↓

Phase

↓

Step
```

Hierarchy

```text
#

Book

##

Phase

###

Step
```

Everything under a Step belongs to that Step.

Never manually create sidebar items.

The parser always generates navigation automatically.

---

# react-markdown

Purpose

Documentation rendering.

Supported

* Markdown
* Lists
* Tables
* Images
* Blockquotes
* Checklists

Never use dangerouslySetInnerHTML.

---

# Shiki

Purpose

Syntax highlighting.

Supported

* JavaScript
* TypeScript
* Python
* Java
* C++
* C
* Go
* Rust
* SQL
* JSON
* YAML
* Bash

Rules

Every fenced code block renders through Shiki.

Never use plain `<pre>` blocks.

---

# Mermaid

Purpose

Architecture diagrams.

Workflow

````text
```mermaid

↓

SVG Diagram
````

Never display Mermaid source code to readers.

Always render diagrams automatically.

---

# dnd-kit

Purpose

Drag and Drop.

Supports

* Reorder Phases
* Reorder Steps
* Move Steps between Phases

Rules

Never manually manipulate the DOM.

Update ordering fields only.

---

# Lucide React

Purpose

Icons.

Use throughout the application.

Never mix icon libraries.

---

# Tailwind CSS

Purpose

Styling.

Rules

Only use

* Tailwind utilities
* CSS variables
* Design tokens

Never hardcode colors.

Never use inline styles.

---

# shadcn/ui

Purpose

Reusable UI primitives.

Use for

* Button
* Input
* Dialog
* Dropdown
* Tooltip
* Tabs
* Card
* Sheet
* Popover

Do not rewrite components already provided by shadcn/ui.

---

# Markdown Import Pipeline

Workflow

```text
Paste Markdown

↓

remark Parser

↓

AST

↓

Extract

Book

↓

Phases

↓

Steps

↓

Save

↓

Generate Sidebar
```

The imported Markdown always remains the source of truth.

---

# Documentation Rendering Pipeline

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

Reader
```

---

# File Uploads

Supported

* PDF
* ZIP
* JSON
* Images

Workflow

```text
Upload

↓

InsForge Storage

↓

Public URL

↓

Database

↓

Download Button
```

Readers download only.

---

# Query Pattern

Every feature follows

```text
Component

↓

Hook

↓

Feature

↓

InsForge

↓

TanStack Query Cache
```

Components never call database functions directly.

---

# Approved Libraries

Frontend

* React
* Vite
* TypeScript

Routing

* TanStack Router

State

* TanStack Query

Forms

* React Hook Form
* Zod

Markdown

* MDXEditor
* unified
* remark
* react-markdown

Rendering

* Shiki
* Mermaid

Drag & Drop

* dnd-kit

UI

* Tailwind CSS
* shadcn/ui
* Lucide React

Backend

* InsForge

No additional dependency may be introduced without updating this document.

---

# Project Rules

These rules always apply.

* Raw Markdown is always the source of truth.
* Sidebar navigation is generated automatically.
* Markdown is never converted into editable HTML.
* Components remain presentation-only.
* Features own business logic.
* Readers cannot modify books.
* Readers cannot duplicate books.
* Progress belongs to individual readers.
* Every query uses TanStack Query.
* Every form uses React Hook Form and Zod.
* Every code block uses Shiki.
* Every Mermaid block renders automatically.
* Every uploaded attachment remains downloadable.
