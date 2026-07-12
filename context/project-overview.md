# Project Overview

## About the Project

DevBook is a documentation-first learning platform built for developers who learn by building real software projects with AI. Instead of leaving AI-generated roadmaps inside long chat conversations, DevBook transforms them into structured, interactive documentation that feels like reading the Next.js or FastAPI documentation.

Creators can write documentation manually or import AI-generated Markdown. DevBook automatically parses the Markdown into a structured **Book → Phase → Step** hierarchy, generating the navigation tree without requiring manual organization. Creators can then reorganize the structure, edit content, attach supporting files, and publish the documentation.

Readers discover books through the home feed, start learning with a single click, and track their own progress independently while always viewing the latest published version.

---

## The Problem It Solves

Modern AI assistants generate excellent learning roadmaps, but chats are a poor place to learn from long-term.

Developers frequently generate complete project plans with ChatGPT or Claude, only to lose them inside long conversations. Revisiting a specific phase weeks later usually means scrolling through thousands of lines of chat.

DevBook solves this by converting AI-generated Markdown into structured developer documentation with automatic navigation, searchable content, progress tracking, and a professional documentation reading experience.

---

## Pages

```text
/                       → Home
/login                  → Authentication
/books                  → My Books
/books/new              → Create Book
/books/:slug/edit       → Documentation Editor
/books/:slug            → Documentation Reader
/progress               → My Progress
/profile/:username      → Public Profile
/profile/me             → My Profile
```

---

## Navigation

Permanent left sidebar.

```text
Home

My Books

My Progress

My Profile

Logout
```

Minimal top navigation inside each page.

---

## Core User Flow

### Authentication

* User signs in using InsForge Authentication
* Successful login redirects to Home
* First login automatically creates user profile

---

### Home

* Displays published learning books
* Search books
* View book information
* Click **Get Started**
* Book is automatically added to My Progress

---

### Documentation Reader

* Professional documentation layout
* Left sidebar generated from imported Markdown
* Main documentation content
* Right "On This Page" navigation
* Syntax highlighted code blocks
* Mermaid diagrams rendered automatically
* Downloadable attachments
* Previous / Next navigation
* Mark Complete / Mark Uncompleted

---

### My Books

Creator workspace.

Users can:

* Create books
* Import Markdown
* Write documentation manually
* Upload attachments
* Edit books
* Preview documentation
* Delete books
* Publish books

---

### Documentation Editor

Users can create documentation in two ways:

#### Import Markdown

* Paste Markdown
* Upload .md file
* DevBook automatically parses the document
* Creates Book → Phase → Step hierarchy
* Generates sidebar navigation
* Creator reviews and edits before publishing

#### Start Empty

* Create documentation manually
* Add phases
* Add steps
* Write Markdown
* Upload attachments

---

### Markdown Import Flow

User pastes AI-generated Markdown.

Example:

```markdown
# Build Backend

## Phase 0

### Install Node

### Setup Project

## Phase 1

### Express

### PostgreSQL
```

DevBook automatically creates:

```text
Book

├── Phase 0
│     ├── Install Node
│     └── Setup Project
│
└── Phase 1
      ├── Express
      └── PostgreSQL
```

No manual sidebar creation required.

---

### Structure Editing

After importing:

* Rename phases
* Rename steps
* Drag and reorder phases
* Drag and reorder steps
* Move steps between phases
* Delete unnecessary sections
* Add new phases
* Add new steps

The Markdown import serves as the initial structure, while the visual editor allows creators to reorganize everything before publishing.

---

### Attachments

Creators may upload supporting files.

Supported examples:

* PDF
* ZIP
* JSON
* Images
* Other downloadable resources

Readers can download all attached files directly from the documentation page.

---

### Publishing

Visibility options:

* Public
* Private
* Followers Only
* Selected Followers

Readers always see the latest published version.

---

### My Progress

Shows books the user has started.

Displays:

* Overall progress
* Phase progress
* Completed steps
* Remaining steps

Users may mark any step as:

* Completed
* Uncompleted

Progress belongs to each reader independently.

---

### My Profile

Displays:

* Avatar
* Name
* About
* Published books
* Followers
* Following

Followers and Following open dedicated pages.

---

## Data Architecture

### Book

Stores:

* Title
* Description
* Cover
* Visibility
* Creator
* Raw Markdown
* Publication Status

---

### Parsed Structure

Generated automatically from Markdown.

```text
Book

↓

Phase

↓

Step

↓

Markdown Content
```

Used for:

* Sidebar navigation
* Routing
* Progress tracking
* Documentation rendering

---

### Attachments

Stores downloadable resources associated with a book.

---

### Reader Progress

Each reader has independent progress.

Stores:

* Current book
* Completed steps
* Completion percentage
* Last visited step

---

## Features In Scope

* Authentication
* Public user profiles
* Followers / Following
* Home feed
* Book discovery
* Search
* Markdown editor
* Markdown import
* Automatic Markdown parsing
* Automatic sidebar generation
* Drag-and-drop phase management
* Drag-and-drop step management
* Documentation preview
* Documentation reader
* Syntax highlighting
* Mermaid rendering
* Image support
* Downloadable attachments
* CRUD operations for books
* Visibility controls
* Reader progress tracking
* Responsive desktop-first UI

---

## Features Out of Scope

* AI-generated documentation
* AI review of code
* Course locking
* Certificates
* Assignments
* Quizzes
* Comments
* Notes
* Book duplication
* Real-time collaborative editing
* Version history
* Notifications
* Messaging
* Payments
* Mobile application

---

## Target User

Developers who learn by building real software projects with AI assistance and want a structured, professional documentation experience instead of learning inside chat conversations.

---

## Success Criteria

* AI-generated Markdown can be imported with a single action.
* Sidebar navigation is generated automatically.
* Creators can reorganize imported content visually before publishing.
* Readers can begin learning in one click.
* Every reader maintains independent progress.
* Documentation feels comparable in quality to Next.js and FastAPI documentation.
* Code blocks, Mermaid diagrams, and Markdown render accurately.
* Supporting files are downloadable.
* The platform remains clean, minimal, and focused on learning rather than project management or social networking.
