# UI Rules

Global UI and UX rules for DevBook.

This document defines the visual language, interaction patterns, spacing, layout, and behavior of every screen.

Every page, component, and interaction must follow these rules.

If a design decision is not covered here, follow the existing design system rather than inventing a new pattern.

---

# Design Philosophy

DevBook is **not** an admin dashboard.

It is **not** a social media platform.

It is **not** a marketing website.

It is a **developer documentation platform**.

The experience should feel like reading:

* Notion
* Next.js Documentation
* FastAPI Documentation
* Vercel
* Linear
* GitHub

Priorities

1. Clarity
2. Readability
3. Simplicity
4. Consistency
5. Performance

Never design for decoration.

Always design for usability.

---

# Theme

Single Light Theme only.

Background

```text
#FFFFFF
```

Sidebar

```text
#FAFAFA
```

Primary Text

```text
#111111
```

Secondary Text

```text
#666666
```

Borders

```text
#EAEAEA
```

Accent

```text
#2563EB
```

Success

```text
#16A34A
```

Warning

```text
#F59E0B
```

Danger

```text
#DC2626
```

No gradients.

No glassmorphism.

No neumorphism.

---

# Typography

Primary Heading Font

JetBrains Mono

Used for

* Page Titles
* Documentation Titles
* Section Headings

Body Font

Work Sans

Used for

* Paragraphs
* Buttons
* Navigation
* Forms
* Descriptions

Code

JetBrains Mono

Only.

Never mix fonts.

---

# Layout

Desktop First

Primary Design Width

```text
1440px
```

Maximum Content Width

```text
1400px
```

Application Layout

```text
┌────────────────────────────────────────────┐
│ Sidebar │ Main Content │ Optional Right Bar│
└────────────────────────────────────────────┘
```

Sidebar

Always visible on desktop.

Never floating.

Never collapses automatically.

---

# Sidebar

Contains only

```text
Home

My Books

My Progress

My Profile

Logout
```

No nested navigation.

No badges.

No advertisements.

No analytics.

---

# Top Navigation

Used inside every page.

Contains

* Breadcrumb
* Search (when required)
* Context Actions
* User Avatar

Height

```text
72px
```

Always white.

---

# Cards

Every major content block lives inside a card.

Properties

* White background
* Thin border
* Soft shadow
* Rounded corners

Never use colored card backgrounds.

Color belongs inside content.

---

# Buttons

Supported Variants

Primary

Secondary

Ghost

Outline

Danger

Primary button always represents the most important action.

Examples

* Get Started
* Publish
* Save

Never create one-off button styles.

---

# Forms

Every input follows identical styling.

Supported

* Input
* Textarea
* Search
* Select
* Checkbox
* Radio
* Toggle

Validation appears below the field.

Never use browser default styling.

---

# Documentation Reader

Always uses

Three-column layout

```text
Sidebar

↓

Documentation

↓

On This Page
```

The documentation column receives the highest visual priority.

The documentation should resemble Next.js and FastAPI documentation.

---

# Documentation Editor

Always uses

Four-column layout

```text
Structure

↓

Markdown Editor

↓

Live Preview

↓

Properties
```

Everything fits within one desktop viewport.

The creator should never lose context while editing.

---

# Markdown

Markdown is always the source of truth.

Never edit rendered HTML.

Navigation is always generated automatically from Markdown headings.

---

# Navigation Tree

Generated automatically.

Supports

* Collapse
* Expand
* Drag
* Rename
* Delete

Only available in the editor.

Readers cannot modify navigation.

---

# Code Blocks

Every code block

* Uses Shiki
* Shows language
* Has Copy button
* Supports line numbers

Never render plain `<pre>` elements.

---

# Mermaid

Mermaid diagrams always render automatically.

Readers should never see Mermaid syntax.

---

# Images

Images

* Rounded corners
* Responsive
* Never exceed content width
* Click to enlarge

---

# Tables

Documentation tables

* Horizontal scrolling when necessary
* Sticky header optional
* Clean borders
* No zebra stripes

---

# Empty States

Every page requires an empty state.

Examples

Home

"No books published yet."

My Books

"Create your first learning book."

Progress

"You haven't started any books."

Always include a meaningful CTA.

---

# Loading

Never use full-page spinners.

Use

* Skeletons
* Placeholder Cards
* Placeholder Sidebar

The layout should remain stable while loading.

---

# Dialogs

Use dialogs for

* Delete Confirmation
* Logout Confirmation
* Publish Confirmation

Never use browser alerts.

---

# Drag & Drop

Only used in Documentation Editor.

Supports

* Reorder Phases
* Reorder Steps
* Move Steps

Show drop indicators while dragging.

Never animate excessively.

---

# Motion

Motion should be subtle.

Allowed

* Fade
* Slide
* Scale

Duration

150–250ms

Never use bouncing animations.

Never animate large layouts.

---

# Responsive Rules

Primary target

Desktop

Secondary

Tablet

Mobile

Documentation layout may collapse on smaller screens.

Sidebar becomes a drawer on mobile.

---

# Accessibility

Every interactive element must have

* Visible focus state
* Keyboard support
* Proper labels
* Sufficient contrast

Icons never replace text entirely.

---

# Error States

Errors should always

* Explain the problem
* Suggest the next action

Never display raw API or database errors.

---

# Spacing

Use a consistent spacing scale.

```text
4
8
12
16
20
24
32
40
48
64
```

Never invent custom spacing values.

---

# Design Consistency

Before building a new screen

Ask

1. Does a similar component already exist?
2. Can an existing layout be reused?
3. Does this follow ui-registry.md?
4. Does this use ui-tokens.md?

If yes

Reuse.

Never redesign existing patterns.

---

# Do Nots

* Never mix typography styles.
* Never hardcode colors.
* Never hardcode spacing.
* Never introduce new button styles.
* Never create duplicate components.
* Never use gradients.
* Never use glassmorphism.
* Never use neumorphism.
* Never use multiple accent colors.
* Never create inconsistent border radii.
* Never prioritize visual effects over readability.
* Never make documentation harder to read for the sake of aesthetics.

---

# UI Goal

Every screen should feel like it belongs to the same product.

A user should immediately recognize DevBook by its consistency, typography, spacing, documentation-first layout, and clean developer-focused experience.
