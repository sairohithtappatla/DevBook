import mermaid from "mermaid";

let mermaidInitialized = false;

export function initMermaid() {
  if (mermaidInitialized) return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "JetBrains Mono, monospace",
      themeVariables: {
        fontSize: "12px",
        primaryColor: "#EFF6FF",
        primaryTextColor: "#1E3A8A",
        lineColor: "#2563EB"
      }
    });
    mermaidInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Mermaid:", error);
  }
}

/**
 * Renders a Mermaid chart definition to an SVG string.
 */
export async function renderMermaid(code: string, elementId: string): Promise<string> {
  initMermaid();
  try {
    const cleanCode = code.trim();
    const { svg } = await mermaid.render(elementId, cleanCode);
    return svg;
  } catch (error) {
    console.error("Mermaid rendering failed:", error);
    return `<div class="p-4 border border-danger-light bg-danger-light/10 text-danger text-xs font-semibold rounded-lg">
      Failed to render architecture diagram. Click to review Mermaid source syntax.
    </div>`;
  }
}
