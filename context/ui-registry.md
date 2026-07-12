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
