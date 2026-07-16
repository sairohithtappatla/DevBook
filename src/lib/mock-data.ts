export type Step = {
  id: string;
  title: string;
  slug: string;
  content: string;
};

export type Phase = {
  id: string;
  title: string;
  slug: string;
  steps: Step[];
};

export type Attachment = {
  id: string;
  name: string;
  size: string;
  kind: "pdf" | "zip" | "json" | "image";
};

export type Book = {
  slug: string;
  title: string;
  description: string;
  category: string;
  creator: { username: string; name: string; avatar: string };
  cover: string;
  visibility: "public" | "private" | "followers";
  status: "published" | "draft";
  updatedAt: string;
  phases: Phase[];
  attachments: Attachment[];
};

const sample = (title: string, id: string) => `# ${title}

This step walks through everything you need to complete **${title}**. Follow the
instructions in order — every command is idempotent, so you can safely re-run
them if something breaks.

## Prerequisites

Before you begin, make sure you have:

- A recent version of Node.js (\`>= 20\`) installed
- A working \`git\` install
- Roughly 15 minutes and a fresh terminal

> Tip: keep this page open in one tab and your editor in the other. You'll
> switch between them constantly.

## Install dependencies

Run the following in the project root:

\`\`\`bash
# install runtime + dev dependencies
bun install
bun add zod drizzle-orm
bun add -d @types/node vitest
\`\`\`

Once installed, verify the versions:

\`\`\`bash
bun --version
node --version
\`\`\`

## Write the handler

Create \`src/${id}.ts\` with the following:

\`\`\`ts
import { z } from "zod";

const Input = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export async function handle(raw: unknown) {
  const parsed = Input.parse(raw);
  // TODO: replace with real persistence
  return { ok: true, echo: parsed };
}
\`\`\`

### Why validation first?

Parsing at the boundary keeps the rest of your code honest. Anything that
reaches the domain layer is guaranteed to match the schema, which means fewer
defensive checks scattered through your handlers.

## Verify

Run the tests:

\`\`\`bash
bun test
\`\`\`

You should see all green. If you don't, re-read the error carefully — it will
usually tell you exactly which field failed validation.

---

When you're satisfied, mark this step complete and move to the next one.
`;

const mermaidStep = `# Architecture at a glance

Before you start writing code, it helps to have a shared mental model of how
the pieces fit together.

## Request lifecycle

\`\`\`mermaid
flowchart LR
  Client -->|HTTP| Edge
  Edge -->|RPC| Server
  Server -->|SQL| DB[(Postgres)]
  Server -->|Cache| Redis[(Redis)]
  Server -->|Event| Queue[[Queue]]
\`\`\`

Every request enters through the edge layer, gets authenticated, and is then
forwarded to the core server. The server owns all writes to the database and
publishes events to the queue for async work.

## Data model

The core tables you'll touch in this project:

| Table | Purpose |
| --- | --- |
| \`users\` | Identity, one row per human |
| \`sessions\` | Live tokens issued by the auth flow |
| \`projects\` | Top-level container owned by a user |
| \`events\` | Append-only audit log |

## Next

Once you've read this, continue to the setup step.
`;

function phase(title: string, idx: number, steps: string[]): Phase {
  return {
    id: `p${idx}`,
    title,
    slug: `phase-${idx}`,
    steps: steps.map((s, i) => ({
      id: `p${idx}-s${i}`,
      title: s,
      slug: s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      content: i === 0 && idx === 0 ? mermaidStep : sample(s, `p${idx}s${i}`),
    })),
  };
}

export const BOOKS: Book[] = [
  {
    slug: "nextjs-saas-from-zero",
    title: "Build a Next.js SaaS from Zero",
    description:
      "Ship a production-grade SaaS with auth, billing, teams, and background jobs — using Next.js 15, Drizzle, and Stripe.",
    category: "Frontend",
    creator: {
      username: "leerob",
      name: "Lee Robinson",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=leerob",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=nextjs&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "2 days ago",
    attachments: [
      { id: "a1", name: "starter-template.zip", size: "3.2 MB", kind: "zip" },
      { id: "a2", name: "architecture.pdf", size: "812 KB", kind: "pdf" },
    ],
    phases: [
      phase("Phase 0 · Foundations", 0, ["Architecture Overview", "Install Node", "Setup Project"]),
      phase("Phase 1 · Auth & Data", 1, ["Drizzle Schema", "Auth.js Setup", "Session Middleware"]),
      phase("Phase 2 · Billing", 2, ["Stripe Products", "Webhook Handler", "Customer Portal"]),
      phase("Phase 3 · Ship", 3, ["Deploy to Vercel", "Observability", "Launch Checklist"]),
    ],
  },
  {
    slug: "fastapi-production-backend",
    title: "FastAPI Production Backend",
    description:
      "A pragmatic path to a real Python backend — async SQLAlchemy, Pydantic v2, background workers, tests, and Docker.",
    category: "Backend",
    creator: {
      username: "tiangolo",
      name: "Sebastián Ramírez",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=tiangolo",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=fastapi&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "5 days ago",
    attachments: [
      { id: "a1", name: "openapi.json", size: "68 KB", kind: "json" },
    ],
    phases: [
      phase("Phase 0 · Setup", 0, ["Project Layout", "Poetry & Ruff"]),
      phase("Phase 1 · Data", 1, ["Async SQLAlchemy", "Alembic Migrations", "Repositories"]),
      phase("Phase 2 · API", 2, ["Routers", "Dependency Injection", "Auth"]),
      phase("Phase 3 · Ops", 3, ["Docker", "CI Pipeline", "Deploying"]),
    ],
  },
  {
    slug: "llm-agents-in-production",
    title: "LLM Agents in Production",
    description:
      "Design, evaluate, and ship agent systems that actually work — tool use, retrieval, evals, and cost control.",
    category: "AI",
    creator: {
      username: "hwchase",
      name: "Harrison Chase",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=hwchase",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=agents&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "1 week ago",
    attachments: [],
    phases: [
      phase("Phase 0 · Concepts", 0, ["What is an Agent", "Choosing a Model"]),
      phase("Phase 1 · Tools", 1, ["Function Calling", "Retrieval", "Memory"]),
      phase("Phase 2 · Evaluation", 2, ["Golden Sets", "Trace Analysis", "Regression Guardrails"]),
    ],
  },
  {
    slug: "kubernetes-for-app-devs",
    title: "Kubernetes for Application Developers",
    description:
      "The k8s you actually need: pods, deployments, services, ingress, secrets, and a real GitOps workflow.",
    category: "DevOps",
    creator: {
      username: "kelseyhightower",
      name: "Kelsey Hightower",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=kelsey",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=k8s&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "2 weeks ago",
    attachments: [
      { id: "a1", name: "manifests.zip", size: "1.1 MB", kind: "zip" },
    ],
    phases: [
      phase("Phase 0 · Primitives", 0, ["Pods", "Deployments", "Services"]),
      phase("Phase 1 · Traffic", 1, ["Ingress", "TLS", "Rate Limits"]),
      phase("Phase 2 · GitOps", 2, ["Argo CD", "Progressive Delivery"]),
    ],
  },
  {
    slug: "rust-web-services",
    title: "Rust Web Services with Axum",
    description:
      "Build fast, safe HTTP services in Rust. Axum, Tokio, SQLx, tracing, and everything in between.",
    category: "Backend",
    creator: {
      username: "davidpdrsn",
      name: "David Pedersen",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=david",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=rust&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "3 weeks ago",
    attachments: [],
    phases: [
      phase("Phase 0 · Setup", 0, ["Cargo Workspace", "Toolchain"]),
      phase("Phase 1 · HTTP", 1, ["Handlers", "Extractors", "Middleware"]),
      phase("Phase 2 · Data", 2, ["SQLx", "Migrations"]),
    ],
  },
  {
    slug: "design-systems-for-engineers",
    title: "Design Systems for Engineers",
    description:
      "Ship a token-driven UI system your whole team will actually use. Tailwind v4, shadcn, and disciplined patterns.",
    category: "Frontend",
    creator: {
      username: "shadcn",
      name: "shadcn",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=shadcn",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=design&backgroundColor=0a0a0a",
    visibility: "public",
    status: "published",
    updatedAt: "1 month ago",
    attachments: [],
    phases: [
      phase("Phase 0 · Foundations", 0, ["Design Tokens", "Typography"]),
      phase("Phase 1 · Components", 1, ["Primitives", "Composition"]),
    ],
  },
  {
    slug: "postgres-for-app-devs",
    title: "Postgres for App Developers",
    description:
      "Indexes, transactions, migrations, and the queries you'll actually write. No DBA background required.",
    category: "Backend",
    creator: {
      username: "you",
      name: "You",
      avatar: "https://api.dicebear.com/9.x/glass/svg?seed=me",
    },
    cover: "https://api.dicebear.com/9.x/shapes/svg?seed=pg&backgroundColor=0a0a0a",
    visibility: "private",
    status: "draft",
    updatedAt: "just now",
    attachments: [],
    phases: [
      phase("Phase 0 · Modeling", 0, ["Schemas", "Constraints"]),
      phase("Phase 1 · Performance", 1, ["Indexes", "Explain Plans"]),
    ],
  },
];

export const CATEGORIES = ["All", "Frontend", "Backend", "AI", "DevOps"] as const;

export function getBook(slug: string): Book | undefined {
  return BOOKS.find((b) => b.slug === slug);
}

export function findStep(
  book: Book,
  phaseSlug: string,
  stepSlug: string,
): { phase: Phase; step: Step; phaseIndex: number; stepIndex: number } | null {
  const pi = book.phases.findIndex((p) => p.slug === phaseSlug);
  if (pi === -1) return null;
  const p = book.phases[pi];
  const si = p.steps.findIndex((s) => s.slug === stepSlug);
  if (si === -1) return null;
  return { phase: p, step: p.steps[si], phaseIndex: pi, stepIndex: si };
}

export function flattenSteps(book: Book) {
  return book.phases.flatMap((p) => p.steps.map((s) => ({ phase: p, step: s })));
}

export const CURRENT_USER = {
  username: "you",
  name: "You",
  avatar: "https://api.dicebear.com/9.x/glass/svg?seed=me",
  about:
    "Backend engineer, learning by shipping. Building agents, backends, and the occasional side project.",
  followers: 128,
  following: 42,
  socials: {
    github: "https://github.com/you",
    linkedin: "https://linkedin.com/in/you",
    portfolio: "https://you.dev",
    email: "you@devbook.dev",
  },
};

export type PersonRef = {
  username: string;
  name: string;
  avatar: string;
  bio?: string;
};

export const PEOPLE: PersonRef[] = [
  { username: "leerob", name: "Lee Robinson", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=leerob", bio: "VP DX" },
  { username: "tiangolo", name: "Sebastián Ramírez", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=tiangolo", bio: "FastAPI" },
  { username: "hwchase", name: "Harrison Chase", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=hwchase", bio: "LangChain" },
  { username: "kelseyhightower", name: "Kelsey Hightower", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=kelsey", bio: "Infra" },
  { username: "davidpdrsn", name: "David Pedersen", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=david", bio: "Axum" },
  { username: "shadcn", name: "shadcn", avatar: "https://api.dicebear.com/9.x/glass/svg?seed=shadcn", bio: "UI systems" },
];

export const DEFAULT_SOCIALS = {
  github: "",
  linkedin: "",
  portfolio: "",
  email: "",
};

export function parseMarkdownToTree(md: string) {
  const lines = md.split(/\r?\n/);
  let bookTitle = "Untitled";
  const phases: { title: string; steps: string[] }[] = [];
  let currentPhase: { title: string; steps: string[] } | null = null;
  for (const line of lines) {
    const h1 = /^#\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    const h3 = /^###\s+(.+)/.exec(line);
    if (h1) bookTitle = h1[1].trim();
    else if (h2) {
      currentPhase = { title: h2[1].trim(), steps: [] };
      phases.push(currentPhase);
    } else if (h3 && currentPhase) currentPhase.steps.push(h3[1].trim());
  }
  return { bookTitle, phases };
}
