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
  creator: { username: string; name: string; avatar: string; bio?: string };
  cover: string;
  visibility: "public" | "private" | "followers";
  status: "published" | "draft";
  updatedAt: string;
  phases: Phase[];
  attachments: Attachment[];
};

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
