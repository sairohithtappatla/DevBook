# Progress Tracker

Update this file after every completed milestone.

This document is the single source of truth for the project's implementation progress.

Every completed milestone must be checked before starting the next one.

---

# Current Status

**Current Phase**

Home Page

**Last Completed**

Authentication Logic, Session Persistence & Logout

**Currently Working**

Home Page UI

**Next Milestone**

Home Page UI

---

# Progress

## Phase 1 — Project Foundation

### Project Structure

* [ ] 01 Initialize React + Vite + TypeScript
* [ ] 02 Configure Tailwind CSS
* [ ] 03 Install shadcn/ui
* [ ] 04 Configure TanStack Router
* [ ] 05 Configure TanStack Query
* [ ] 06 Configure InsForge Client
* [ ] 07 Configure Project Folder Structure
* [ ] 08 Configure Theme & Design Tokens
* [ ] 09 Configure Global Layout
* [ ] 10 Configure Protected Routes

---

## Phase 2 — Design System

### Shared UI Components

* [ ] 11 Sidebar
* [ ] 12 Top Navigation
* [ ] 13 Search Bar
* [ ] 14 Buttons
* [ ] 15 Cards
* [ ] 16 Dropdowns
* [ ] 17 Dialogs
* [ ] 18 Empty States
* [ ] 19 Loading Skeletons
* [ ] 20 Toast System

---

## Phase 3 — Documentation Engine

### Markdown Infrastructure

* [ ] 21 MDXEditor Integration
* [ ] 22 Markdown Parser
* [ ] 23 Markdown Tree Generator
* [ ] 24 Markdown Renderer
* [ ] 25 Shiki Integration
* [ ] 26 Mermaid Integration
* [ ] 27 Sidebar Tree Generation
* [ ] 28 Documentation Preview
* [ ] 29 Attachment Upload
* [ ] 30 Attachment Download

---

## Phase 4 — Authentication

### Authentication

* [x] 31 Login Page UI
* [x] 32 Register Page UI
* [x] 33 Authentication Logic
* [x] 34 Session Persistence
* [x] 35 Logout

---

## Phase 5 — Home

### Home

* [ ] 36 Home UI
* [ ] 37 Search
* [ ] 38 Book Cards
* [ ] 39 Book Details
* [ ] 40 Get Started

---

## Phase 6 — My Books

### Creator CMS

* [ ] 41 My Books UI
* [ ] 42 Create Book
* [ ] 43 Edit Book
* [ ] 44 Delete Book
* [ ] 45 Import Markdown
* [ ] 46 Manual Editor
* [ ] 47 Drag Phases
* [ ] 48 Drag Steps
* [ ] 49 Publish Book
* [ ] 50 Visibility Settings

---

## Phase 7 — Documentation Reader

### Reader

* [ ] 51 Documentation Reader UI
* [ ] 52 Sidebar Navigation
* [ ] 53 On This Page
* [ ] 54 Previous / Next Navigation
* [ ] 55 Mark Complete
* [ ] 56 Reader Progress Logic

---

## Phase 8 — Progress

### Learning Progress

* [ ] 57 My Progress UI
* [ ] 58 Continue Reading
* [ ] 59 Progress Calculation
* [ ] 60 Completed Books

---

## Phase 9 — Profile

### User Profile

* [ ] 61 Profile UI
* [ ] 62 Edit Profile
* [ ] 63 Followers
* [ ] 64 Following
* [ ] 65 Published Books

---

## Phase 10 — Polish

### Final Production Pass

* [ ] 66 Responsive Improvements
* [ ] 67 Keyboard Shortcuts
* [ ] 68 Accessibility
* [ ] 69 Error States
* [ ] 70 Performance Optimization
* [ ] 71 Final Testing
* [ ] 72 Production Deployment

---

# Decisions Made During Development

Document important implementation decisions here.

Example

* Markdown is the source of truth.
* Sidebar navigation is generated automatically.
* Readers always see the latest published version.
* Login page is implemented as a token-based React screen using `public/login.png` for the brand illustration and `public/logo.svg` for the mark.
* Added the `@/*` TypeScript/Vite alias to support the required absolute import convention.
* Added `lucide-react` because it is the approved icon library in the project architecture and UI registry.

---

# Notes

Record implementation notes, workarounds, and architecture changes that occur during development.

This section should explain **why** a decision was made, not just **what** changed.
