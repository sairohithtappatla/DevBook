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

export type ParsedMarkdownStep = {
  title: string;
  slug: string;
  markdown: string;
};

export type ParsedMarkdownPhase = {
  title: string;
  steps: ParsedMarkdownStep[];
};

export type ParsedMarkdownTree = {
  bookTitle: string;
  phases: ParsedMarkdownPhase[];
};

type CurrentMarkdownStep = {
  title: string;
  lines: string[];
};

function slugifyTitle(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

export function parseMarkdownToTree(md: string): ParsedMarkdownTree {
  const lines = md.split(/\r?\n/);
  let bookTitle = "Untitled";
  const phases: ParsedMarkdownPhase[] = [];
  let currentPhase: ParsedMarkdownPhase | null = null;
  let currentStep: CurrentMarkdownStep | null = null;

  const ensurePhase = (title = "Overview") => {
    currentPhase ??= { title, steps: [] };
    if (!phases.includes(currentPhase)) phases.push(currentPhase);
    return currentPhase;
  };

  const startStep = (title = "Overview") => {
    ensurePhase();
    currentStep = { title, lines: [`# ${title}`, ""] };
    return currentStep;
  };

  const flushStep = () => {
    if (!currentStep || !currentPhase) return;

    const markdown = currentStep.lines.join("\n").trim();
    currentPhase.steps.push({
      title: currentStep.title,
      slug: slugifyTitle(currentStep.title),
      markdown: markdown || `# ${currentStep.title}`,
    });
    currentStep = null;
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    const h3 = /^###\s+(.+)/.exec(line);

    if (h1) {
      bookTitle = h1[1].trim();
    } else if (h2) {
      flushStep();
      currentPhase = { title: h2[1].trim(), steps: [] };
      phases.push(currentPhase);
    } else if (h3) {
      flushStep();
      ensurePhase();
      startStep(h3[1].trim());
    } else if (currentStep !== null) {
      (currentStep as CurrentMarkdownStep).lines.push(line);
    } else if (line.trim()) {
      startStep("Overview").lines.push(line);
    }
  }

  flushStep();

  if (phases.length === 0) {
    phases.push({
      title: "Overview",
      steps: [
        {
          title: bookTitle,
          slug: slugifyTitle(bookTitle),
          markdown: md.trim() || `# ${bookTitle}`,
        },
      ],
    });
  }

  for (const phase of phases) {
    if (phase.steps.length === 0) {
      phase.steps.push({
        title: phase.title,
        slug: slugifyTitle(phase.title),
        markdown: `# ${phase.title}`,
      });
    }
  }

  return { bookTitle, phases };
}
