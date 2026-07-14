export type StepData = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  description: string;
  status: "Published" | "Draft" | "Archived";
  estimatedTime: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  visibility: "Public" | "Followers" | "Selected" | "Private";
  isCompleted?: boolean;
};

export type PhaseData = {
  id: string;
  title: string;
  steps: StepData[];
};

export type ParsedBook = {
  title: string;
  phases: PhaseData[];
};

/**
 * Parses raw Markdown text into a structured Book -> Phase -> Step hierarchy.
 *
 * Rules:
 * # Heading -> Book Title
 * ## Heading -> Phase Title
 * ### Heading -> Step Title
 * Everything below a Step belongs to that Step until another heading.
 */
export function parseMarkdown(markdown: string): ParsedBook {
  const lines = markdown.split("\n");
  let bookTitle = "Untitled Book";
  const phases: PhaseData[] = [];
  let currentPhase: PhaseData | null = null;
  let currentStep: StepData | null = null;
  let currentStepContent: string[] = [];

  let phaseIndex = 0;
  let stepIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      // Flush previous step
      if (currentStep) {
        currentStep.markdown = currentStepContent.join("\n").trim();
        if (currentPhase) {
          currentPhase.steps.push(currentStep);
        }
      }
      currentStep = null;
      bookTitle = line.substring(2).trim();
    } else if (line.startsWith("## ")) {
      // Flush previous step
      if (currentStep) {
        currentStep.markdown = currentStepContent.join("\n").trim();
        if (currentPhase) {
          currentPhase.steps.push(currentStep);
        }
      }
      currentStep = null;

      const phaseTitle = line.substring(3).trim();
      currentPhase = {
        id: `phase-${phaseIndex++}-${Date.now()}`,
        title: phaseTitle,
        steps: []
      };
      phases.push(currentPhase);
    } else if (line.startsWith("### ")) {
      // Flush previous step
      if (currentStep) {
        currentStep.markdown = currentStepContent.join("\n").trim();
        if (currentPhase) {
          currentPhase.steps.push(currentStep);
        }
      }

      const stepTitle = line.substring(4).trim();
      const slug = stepTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      currentStep = {
        id: `step-${stepIndex++}-${Date.now()}`,
        title: stepTitle,
        slug: slug,
        markdown: "",
        description: `Learn how to set up ${stepTitle.toLowerCase()}.`,
        status: "Draft",
        estimatedTime: 10,
        difficulty: "Beginner",
        visibility: "Public",
        isCompleted: false
      };
      currentStepContent = [line];
    } else {
      if (currentStep) {
        currentStepContent.push(line);
      }
    }
  }

  // Flush the final step
  if (currentStep) {
    currentStep.markdown = currentStepContent.join("\n").trim();
    if (currentPhase) {
      currentPhase.steps.push(currentStep);
    }
  }

  return {
    title: bookTitle,
    phases
  };
}
