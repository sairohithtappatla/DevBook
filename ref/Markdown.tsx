import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Copy, Check } from "lucide-react";
import { createRoot } from "react-dom/client";
import { codeToHtml } from "shiki";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    background: "#0d0d0d",
    primaryColor: "#161616",
    primaryTextColor: "#ededed",
    primaryBorderColor: "#333",
    lineColor: "#666",
    fontFamily: "JetBrains Mono, monospace",
  },
  securityLevel: "loose",
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function Markdown({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;

    // Mermaid render
    const blocks = ref.current.querySelectorAll("pre code.language-mermaid");
    blocks.forEach(async (el, i) => {
      const pre = el.parentElement as HTMLElement;
      const code = el.textContent ?? "";
      const id = `mmd-${Date.now()}-${i}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrap = document.createElement("div");
        wrap.className =
          "my-4 rounded-lg border border-hairline bg-[var(--color-code-bg)] p-4 overflow-x-auto";
        wrap.innerHTML = svg;
        pre.replaceWith(wrap);
      } catch {
        // leave as code block if it fails
      }
    });

    // Wrap remaining code blocks with header + copy button, syntax-highlight via Shiki
    const pres = ref.current.querySelectorAll("pre:not([data-wrapped])");
    pres.forEach((pre) => {
      const codeEl = pre.querySelector("code");
      if (!codeEl) return;
      const classes = Array.from(codeEl.classList);
      const langClass = classes.find((c) => c.startsWith("language-"));
      if (langClass === "language-mermaid") return;
      const lang = langClass?.replace("language-", "") ?? "text";
      const raw = codeEl.textContent ?? "";
      pre.setAttribute("data-wrapped", "true");

      const wrap = document.createElement("div");
      wrap.className = "code-block-wrap";
      const headerHost = document.createElement("div");
      wrap.appendChild(headerHost);
      pre.parentNode?.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      const root = createRoot(headerHost);
      root.render(<CodeHeader lang={lang} code={raw} />);

      // Shiki highlight — replace <pre><code> content
      codeToHtml(raw, { lang: mapLang(lang), theme: "github-dark-dimmed" })
        .then((html) => {
          const holder = document.createElement("div");
          holder.innerHTML = html;
          const shikiPre = holder.querySelector("pre");
          if (shikiPre) {
            pre.className = "shiki-pre";
            pre.innerHTML = shikiPre.innerHTML;
          }
        })
        .catch(() => {
          /* leave as-is */
        });
    });

    // Anchor <h2>/<h3> smooth-scroll offset for hash links
    ref.current.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
      h.style.scrollMarginTop = "5rem";
    });
  }, [children]);

  return (
    <div ref={ref} className="prose-docs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, ...p }) => {
            const text = String(children);
            return (
              <h2 id={slugify(text)} {...p}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...p }) => {
            const text = String(children);
            return (
              <h3 id={slugify(text)} {...p}>
                {children}
              </h3>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const LANG_ALIAS: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  text: "plaintext",
  txt: "plaintext",
  "c++": "cpp",
  cxx: "cpp",
  cc: "cpp",
  py: "python",
  rs: "rust",
  golang: "go",
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
};
function mapLang(l: string): string {
  return LANG_ALIAS[l.toLowerCase()] ?? l.toLowerCase();
}

function CodeHeader({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block-header">
      <span className="uppercase tracking-widest">{lang}</span>
      <button
        className="copy-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          } catch {}
        }}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </button>
    </div>
  );
}

export function extractHeadings(md: string) {
  const out: { depth: 2 | 3; text: string; id: string }[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m2 = /^##\s+(.+)/.exec(line);
    const m3 = /^###\s+(.+)/.exec(line);
    if (m2) out.push({ depth: 2, text: m2[1].trim(), id: slugify(m2[1].trim()) });
    else if (m3) out.push({ depth: 3, text: m3[1].trim(), id: slugify(m3[1].trim()) });
  }
  return out;
}