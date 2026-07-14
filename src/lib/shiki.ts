import { createHighlighter } from "shiki";

let highlighterPromise: Promise<any> | null = null;
let highlighterInstance: any = null;

async function initHighlighter() {
  if (highlighterInstance) return highlighterInstance;
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "one-dark-pro"],
      langs: ["javascript", "typescript", "python", "json", "bash", "sql", "html", "css"]
    }).then((h) => {
      highlighterInstance = h;
      return h;
    });
  }
  return highlighterPromise;
}

/**
 * Highlights a block of code asynchronously.
 * Falls back to basic HTML escaping if highlighter is not ready.
 */
export async function highlightCode(code: string, lang: string, theme: "light" | "dark" = "light"): Promise<string> {
  try {
    const hl = await initHighlighter();
    return hl.codeToHtml(code, {
      lang,
      theme: theme === "light" ? "github-light" : "one-dark-pro"
    });
  } catch (error) {
    console.error("Shiki highlighting failed:", error);
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return `<pre className="p-4 bg-[#0F172A] rounded-xl overflow-x-auto text-[13px] font-mono text-slate-200"><code>${escaped}</code></pre>`;
  }
}

/**
 * Sync syntax highlight helper. Attempts to highlight, falls back to raw code blocks if shiki isn't initialized yet.
 */
export function highlightCodeSync(code: string, lang: string, theme: "light" | "dark" = "light"): string {
  if (highlighterInstance) {
    try {
      return highlighterInstance.codeToHtml(code, {
        lang,
        theme: theme === "light" ? "github-light" : "one-dark-pro"
      });
    } catch (e) {
      // Fallback below
    }
  } else {
    // Proactively kick off loading Shiki in the background
    initHighlighter().catch(() => {});
  }

  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return `<pre class="shiki-fallback p-4 bg-[#0F172A] rounded-xl overflow-x-auto text-[13px] font-mono text-slate-200"><code>${escaped}</code></pre>`;
}
