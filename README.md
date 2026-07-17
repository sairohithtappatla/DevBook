<h1 align="center">
  <svg viewBox="0 0 31.691 31.691" width="48" height="48" style="vertical-align: middle; fill: #FFFFFF; display: inline-block;">
    <path d="M16.868,6.977h2.517v0.695h-2.517V6.977z M19.379,8.124h-2.516v0.697h2.516V8.124z M14.09,6.977h-2.519v0.695h2.519V6.977z M31.691,20.605v1.672h-3.752v4.992h-2.146v-4.992H5.695v5.16H3.547v-5.16H0v-1.672h4.606l-2.522-0.58L5.697,4.254l4.653,1.064 V4.762h4.963v15.844h0.33V4.604h4.962v16.001h0.651V4.604h4.966v16.001H31.691z M6.411,20.322L9.723,5.873L6.208,5.068 l-3.311,14.45L6.411,20.322z M10.35,6.18L7.044,20.607h3.306V6.18z M14.634,18.667h-3.605v1.599h3.605V18.667z M11.627,16.846 v0.648h2.492v-0.648H11.627z M14.119,16.412v-0.647h-2.492v0.647H14.119z M14.634,5.443h-3.605v9.148h3.605V5.443z M19.926,20.107 V5.284H16.32v14.823H19.926z M25.543,5.284h-3.605v14.823h3.605V5.284z M24.66,6.653h-0.695v8.229h0.695V6.653z M23.512,6.636 h-0.697v8.228h0.697V6.636z M7.898,7.223l-1.884,8.225l0.628,0.144l1.884-8.225L7.898,7.223z M6.641,6.977l-1.885,8.224 l0.628,0.144l1.885-8.224L6.641,6.977z M19.379,15.763h-2.516v0.694h2.516V15.763z M16.868,17.693h2.517v-0.694h-2.517V17.693z" />
  </svg>
  <span style="font-size: 2.5rem; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; vertical-align: middle; margin-left: 6px; display: inline-block; color: #FFFFFF;">
    Dev<span style="color: #818CF8;">Book</span>
  </span>
</h1>

<p align="center">
  <strong>Structured, Documentation-First Learning for Developers building with AI.</strong>
</p>

<p align="center">
  <a href="https://github.com/sairohithtappatla/DevBook/releases/tag/v1.0.0">
    <img src="https://img.shields.io/badge/version-1.0.0-indigo.svg?style=flat-skin" alt="Version 1.0.0" />
  </a>
  <a href="https://react.dev">
    <img src="https://img.shields.io/badge/React-19-blue.svg?logo=react&style=flat-skin" alt="React 19" />
  </a>
  <a href="https://tailwindcss.com">
    <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?logo=tailwind-css&style=flat-skin" alt="Tailwind CSS" />
  </a>
  <a href="https://insforge.dev">
    <img src="https://img.shields.io/badge/BaaS-InsForge-FF6B6B.svg?style=flat-skin" alt="InsForge" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-skin" alt="MIT License" />
</p>

<blockquote>
  <p align="center">
    <strong>🔓 100% Free & Open-Source Developer Learning Platform</strong><br />
    No subscriptions, no paywalls. Built for developers who learn best by reading and building.
  </p>
</blockquote>

---

## 💡 The Problem & The Vision

Generative AI assistants write excellent, customized learning plans and software roadmaps. However, **chat windows are a poor place to learn from long-term**. Scrolling through thousands of lines of chat context weeks later to review a specific phase or step is frustrating and inefficient.

**DevBook** solves this by converting AI-generated project plans into structured developer documentation. It automatically parses standard Markdown into an interactive **Book → Phase → Step** hierarchy. The result is a reading experience that feels as clean and professional as reading the official Next.js or FastAPI documentation, complete with syntax-highlighted code blocks, live diagrams, and independent progress tracking.

---

## ✨ Features

- 📖 **Automatic Sidebar Navigation**: Paste Markdown roadmaps to instantly build dynamic, multi-phase navigation trees.
- 🎨 **Next.js-Inspired Reader**: Clean three-column layout featuring sidebar navigation, Markdown viewer, and active TOC.
- ⚡ **Interactive Diagrams & Code**: Code blocks are highlighted natively via Shiki, and Mermaid blocks render live SVGs.
- 🛠️ **Creator Workspace**: Drag, drop, rename, or reorder phases and attach assets (ZIPs, PDFs, images) to steps.
- 📈 **Independent Progress Sync**: Track completion percentages, check off read steps, and auto-resume instantly.
- 👥 **Developer Community**: Public developer profiles, Follow/Unfollow system, and discovery home feeds.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | Modern single-page application |
| **Routing** | TanStack Router | Typesafe client-side page routing |
| **State** | TanStack Query | Server cache state synchronization |
| **Backend** | InsForge | Postgres DB, authentication, and file storage |
| **Styling** | Tailwind CSS + shadcn/ui | Premium developer-focused UI primitives |
| **Editor** | MDXEditor | Notion-style markdown drafting |
| **Rendering** | react-markdown + Shiki + Mermaid | Markdown parsing and document rendering |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/sairohithtappatla/DevBook.git
   cd DevBook
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory and configure your InsForge credentials:
   ```env
   VITE_INSFORGE_URL=https://6ktij8hk.ap-southeast.insforge.app
   VITE_INSFORGE_ANON_KEY=your_anonymous_key_here
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173` to get started!

---

## 📁 Project Directory Structure

```text
devbook/
├── context/               # System guidelines & architectural rules
├── public/                # Static public assets (logos, images)
├── src/
│   ├── app/               # Router, context providers & clients
│   ├── components/        # Presentational UI components & layout shell
│   ├── features/          # Business logic modules
│   ├── hooks/             # Custom React state/utility hooks
│   ├── lib/               # Third-party integrations (Shiki, InsForge, etc.)
│   ├── routes/            # App screens and page compositions
│   ├── services/          # API & database service layers
│   ├── stores/            # Global state managers (Zustand)
│   └── styles/            # Tailwind theme tokens & global styles
└── package.json
```

---

## 📄 License

DevBook is open-source software licensed under the [MIT License](LICENSE).
