# Code Standards

Implementation rules and engineering conventions for the entire project.

These rules are mandatory throughout the project and exist to keep the codebase clean, predictable, and maintainable.

---

# Engineering Mindset

Every implementation should follow these principles.

* Understand the feature completely before writing code.
* Read **project-overview.md**, **architecture.md**, and **build-plan.md** before starting any new feature.
* Build only what the current phase requires.
* UI always comes before logic.
* Logic always comes before optimization.
* Every feature must be testable before moving to the next.
* Prefer readable code over clever abstractions.
* Keep components small and focused.
* Every feature should feel production-ready.

---

# TypeScript

* Strict mode enabled.
* Never use `any`.
* Prefer `unknown` when necessary.
* Every function must have explicit parameter and return types.
* Prefer `type` over `interface` unless extension is required.
* Use `const` by default.
* Every async function must handle errors.
* Never leave floating promises.

---

# React Standards

* Functional Components only.
* Hooks only.
* No class components.
* Never use default exports.
* Always use named exports.

Example

```tsx
export function BookCard() {}
```

Never

```tsx
export default function BookCard() {}
```

---

# Component Structure

Every component follows this order.

```tsx
// External Imports

// Internal Imports

// Types

// Component

// Helper Functions
```

Props are declared immediately above the component.

```tsx
type Props = {
    title: string;
};

export function BookCard({ title }: Props) {}
```

---

# Folder Naming

Folders

* kebab-case

Examples

```text
my-books

documentation-reader

markdown-editor
```

Component Files

PascalCase

```text
BookCard.tsx

Sidebar.tsx

DocumentationViewer.tsx
```

Utility Files

camelCase

```text
markdownParser.ts

queryClient.ts

insforge.ts
```

---

# Import Rules

Always use aliases.

Correct

```tsx
import { Sidebar } from "@/components/layout/Sidebar";
```

Never

```tsx
import "../../../components/layout/Sidebar";
```

---

# Routing

TanStack Router only.

Every page belongs inside

```text
src/routes/
```

No routing logic inside components.

---

# Data Fetching

All server communication must go through TanStack Query.

Never call InsForge directly inside UI components.

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

---

# Business Logic

Business logic belongs inside

```text
src/features/
```

Components never contain business logic.

Components only

* display data
* collect input
* call hooks

---

# Forms

Every form uses

* React Hook Form
* Zod validation

No uncontrolled forms.

No manual validation.

---

# Styling

Only use

* Tailwind CSS
* shadcn/ui
* CSS Variables from ui-tokens.md

Never

* Inline styles
* Random colors
* Hardcoded spacing

Example

Correct

```tsx
className="bg-background text-foreground"
```

Never

```tsx
className="bg-[#ffffff]"
```

---

# Markdown

Raw Markdown is always the source of truth.

Never edit generated HTML.

Workflow

```text
Markdown

↓

Parser

↓

Tree

↓

Renderer
```

The navigation tree is always generated from parsed Markdown.

Never manually synchronize sidebar items.

---

# Markdown Parsing

Only

```text
#

##

###
```

control hierarchy.

```text
#

Book

##

Phase

###

Step
```

Everything below a Step belongs to that Step.

---

# Documentation Rendering

Render using

* react-markdown
* remark
* Shiki
* Mermaid

Never render raw HTML directly.

---

# Drag & Drop

Use dnd-kit only.

Supported operations

* Move Phase
* Move Step
* Reorder Phase
* Reorder Step

Never manipulate DOM manually.

---

# Attachments

Supported

* PDF
* ZIP
* JSON
* Images

Files always upload to InsForge Storage.

Readers download only.

Readers never edit attachments.

---

# Query Keys

Every TanStack Query key must be centralized.

Example

```tsx
books

book

profile

progress

followers
```

Never hardcode query keys in multiple places.

---

# Error Handling

Every async operation

```tsx
try

↓

catch

↓

Return friendly message
```

Never expose raw errors to users.

Always log context.

Example

```text
[BookEditor]

[MarkdownParser]

[Profile]
```

---

# Environment Variables

Never hardcode

* URLs
* Keys
* Secrets

Everything comes from

```text
.env.local
```

Example

```text
VITE_INSFORGE_URL

VITE_INSFORGE_ANON_KEY

VITE_STORAGE_BUCKET
```

---

# Comments

Don't explain

"What"

Explain

"Why"

Good

```tsx
// Store raw Markdown so the parser can be regenerated later.
```

Bad

```tsx
// Create a variable.
```

---

# Dependencies

Before installing a package ask

1. Can React do this?
2. Can TanStack do this?
3. Does shadcn/ui already provide it?

Approved libraries

* React
* Vite
* TypeScript
* TanStack Router
* TanStack Query
* Tailwind CSS
* shadcn/ui
* React Hook Form
* Zod
* MDXEditor
* unified
* remark
* react-markdown
* Shiki
* Mermaid
* dnd-kit
* Lucide React

No additional libraries without updating this document.

---

# Invariants

These rules must never be broken.

* Raw Markdown is always the source of truth.
* Sidebar navigation is generated automatically.
* Components never contain business logic.
* Features own business logic.
* Readers cannot edit books.
* Readers cannot duplicate books.
* Progress belongs to each reader independently.
* Every page is fully designed before backend integration.
* Every feature is completed before starting the next one.
* UI consistency always takes priority over adding more features.
