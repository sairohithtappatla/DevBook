# UI Tokens

Design tokens for DevBook.

This document defines every reusable design value used throughout the application.

Never hardcode colors, spacing, typography, border radius, shadows, or transitions inside components.

Every component should consume these tokens.

---

# How To Use

DevBook uses **Tailwind CSS v4**.

All design tokens are defined using `@theme` inside `globals.css`.

Never create colors inside components.

Never use Tailwind default color utilities.

Correct

```tsx
className="bg-background text-foreground border-border"
```

Also Correct

```tsx
style={{ color: "var(--color-text-primary)" }}
```

Never

```tsx
className="bg-white text-black"
```

Never

```tsx
className="bg-blue-500"
```

---

# globals.css

```css
@import "tailwindcss";

@theme {

  /* Fonts */

  --font-heading: "JetBrains Mono", monospace;
  --font-body: "Work Sans", sans-serif;
  --font-code: "JetBrains Mono", monospace;

  /* Backgrounds */

  --color-background: #FFFFFF;
  --color-sidebar: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F8F9FA;

  /* Borders */

  --color-border: #EAEAEA;
  --color-border-light: #F1F3F5;

  /* Typography */

  --color-text-primary: #111111;
  --color-text-secondary: #666666;
  --color-text-muted: #9CA3AF;

  /* Brand */

  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-primary-light: #EFF6FF;

  /* Status */

  --color-success: #16A34A;
  --color-success-light: #DCFCE7;

  --color-warning: #F59E0B;
  --color-warning-light: #FEF3C7;

  --color-danger: #DC2626;
  --color-danger-light: #FEE2E2;

  /* Documentation */

  --color-code-background: #0F172A;
  --color-code-foreground: #F8FAFC;

  /* Shadows */

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);

  --shadow-md: 0 8px 24px rgba(0,0,0,0.08);

  /* Radius */

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

}
```

---

# Color Usage

## Page

| Element           | Token                  |
| ----------------- | ---------------------- |
| Page Background   | `bg-background`        |
| Sidebar           | `bg-sidebar`           |
| Cards             | `bg-surface`           |
| Secondary Surface | `bg-surface-secondary` |

---

## Borders

| Element        | Token                 |
| -------------- | --------------------- |
| Default Border | `border-border`       |
| Subtle Border  | `border-border-light` |

---

## Typography

| Element        | Token                 |
| -------------- | --------------------- |
| Main Text      | `text-text-primary`   |
| Secondary Text | `text-text-secondary` |
| Muted Text     | `text-text-muted`     |

---

## Brand

| Usage             | Token          |
| ----------------- | -------------- |
| Primary Buttons   | `bg-primary`   |
| Links             | `text-primary` |
| Active Navigation | `text-primary` |
| Focus Ring        | `ring-primary` |
| Active Horizontal Category | `bg-black text-white dark:bg-white dark:text-black` |

---

## Success

Used for

* Completed Steps
* Success Messages
* Progress Indicators

---

## Warning

Used for

* Draft Books
* Unsaved Changes

---

## Danger

Used for

* Delete
* Remove
* Destructive Actions

---

# Typography

## Page Title

Font

JetBrains Mono

Size

36px

Weight

600

---

## Section Heading

JetBrains Mono

28px

600

---

## Card Title

JetBrains Mono

20px

600

---

## Body

Work Sans

16px

400

---

## Small Text

Work Sans

14px

400

---

## Caption

Work Sans

12px

400

---

## Code

JetBrains Mono

15px

400

---

# Spacing Scale

| Token    | Value |
| -------- | ----- |
| space-1  | 4px   |
| space-2  | 8px   |
| space-3  | 12px  |
| space-4  | 16px  |
| space-5  | 20px  |
| space-6  | 24px  |
| space-8  | 32px  |
| space-10 | 40px  |
| space-12 | 48px  |
| space-16 | 64px  |

Never invent custom spacing values.

---

# Layout Tokens

Maximum Width

```text
1440px
```

Sidebar Width

```text
280px
```

Top Navigation Height

```text
72px
```

Documentation Width

```text
820px
```

Editor Sidebar

```text
300px
```

Right Inspector

```text
300px
```

---

# Border Radius

| Token       | Value  |
| ----------- | ------ |
| Small       | 8px    |
| Medium      | 12px   |
| Large       | 16px   |
| Extra Large | 20px   |
| Pill        | 9999px |

---

# Shadows

Cards

```text
shadow-sm
```

Dropdown

```text
shadow-md
```

Dialog

```text
shadow-md
```

Never use heavy shadows.

---

# Buttons

## Primary

Background

```text
bg-primary
```

Text

```text
white
```

Radius

```text
rounded-md
```

Height

```text
40px
```

---

## Secondary

White

Border

Border Token

Primary Text

---

## Ghost

Transparent

Hover

Surface Secondary

---

## Danger

Danger Background

White Text

---

# Inputs

Height

```text
40px
```

Radius

```text
rounded-md
```

Border

```text
border-border
```

Focus

```text
ring-primary
```

Placeholder

```text
text-text-muted
```

---

# Cards

Background

Surface

Border

Border Token

Radius

16px

Padding

24px

Shadow

Small

---

# Documentation

## Code Block

Background

```text
code-background
```

Text

```text
code-foreground
```

Padding

24px

Radius

16px

Copy Button

Top Right

---

## Callout

Info

```text
Blue Left Border
Light Blue Background
```

Success

```text
Green Left Border
Light Green Background
```

Warning

```text
Orange Left Border
Light Orange Background
```

Danger

```text
Red Left Border
Light Red Background
```

---

## Mermaid

Always centered.

Maximum width

100%

---

## Images

Radius

16px

Shadow

Small

Responsive

Always.

---

# Progress

Completed

```text
Success
```

Current

```text
Primary
```

Not Started

```text
Border
```

---

# Motion

Hover

150ms

Dropdown

180ms

Dialog

200ms

Drag

150ms

Never exceed

250ms

---

# Z-Index

| Layer    | Value |
| -------- | ----- |
| Content  | 1     |
| Header   | 10    |
| Sidebar  | 20    |
| Dropdown | 40    |
| Dialog   | 100   |
| Toast    | 999   |

---

# Responsive Breakpoints

| Device        | Width  |
| ------------- | ------ |
| Mobile        | 640px  |
| Tablet        | 768px  |
| Laptop        | 1024px |
| Desktop       | 1280px |
| Large Desktop | 1440px |

---

# Icon Sizes

Small

16px

Medium

20px

Large

24px

Extra Large

32px

Use Lucide React only.

---

# Invariants

* Never use hardcoded colors.
* Never use Tailwind default color palettes.
* Never use system fonts.
* Never mix font families.
* Never create custom spacing values.
* Never create custom shadows.
* Never introduce new border radii.
* Every screen must use the same layout tokens.
* Every component must consume these tokens.
* UI consistency is more important than visual experimentation.
