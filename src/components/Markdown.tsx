import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Copy, Check } from "lucide-react";
import { codeToHtml } from "shiki/bundle/web";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isThemeDark, setIsThemeDark] = useState(() => {
    return document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isCurrentlyDark = document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
      setIsThemeDark(isCurrentlyDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        const cleanCode = code.trim();
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isThemeDark ? "dark" : "default",
          themeVariables: isThemeDark
            ? {
                background: "#000000",
                primaryColor: "#000000",
                primaryBorderColor: "#ffffff",
                primaryTextColor: "#ffffff",
                textColor: "#ffffff",
                lineColor: "#ffffff",
                fontFamily: "Geist, system-ui, sans-serif",
              }
            : {
                background: "#ffffff",
                primaryColor: "#ececff",
                primaryBorderColor: "#9370db",
                primaryTextColor: "#333333",
                textColor: "#333333",
                lineColor: "#333333",
                fontFamily: "Geist, system-ui, sans-serif",
              },
          securityLevel: "loose",
        });

        const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanCode);
        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        console.error("Mermaid rendering failed:", err);
        if (active) {
          setError(err?.message || "Failed to render diagram");
        }
      }
    };
    render();
    return () => {
      active = false;
    };
  }, [code, isThemeDark]);

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 text-xs font-semibold rounded-lg my-4">
        Failed to render architecture diagram.
        <pre className="mt-2 text-[11px] font-mono opacity-80 whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 bg-surface-2 animate-pulse rounded-lg my-4 text-xs text-muted-foreground text-center">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="my-4 rounded-lg border border-hairline bg-[var(--color-surface)] p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
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

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");

  useEffect(() => {
    let active = true;
    codeToHtml(code, { lang: mapLang(lang), theme: "github-dark-dimmed" })
      .then((html) => {
        if (active) {
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        /* ignore and fall back to plain rendering */
      });
    return () => {
      active = false;
    };
  }, [code, lang]);

  return (
    <div className="code-block-wrap">
      <CodeHeader lang={lang} code={code} />
      {highlightedHtml ? (
        <div 
          className="shiki-pre-container"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }} 
        />
      ) : (
        <pre className="shiki-pre">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;

    // Anchor <h2>/<h3> smooth-scroll offset for hash links
    ref.current.querySelectorAll<HTMLElement>("h2, h3").forEach((h) => {
      h.style.scrollMarginTop = "5rem";
    });
  }, [children]);

  return (
    <div ref={ref} className="prose-docs">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          if (url.startsWith("data:") || url.startsWith("http:") || url.startsWith("https:") || url.startsWith("mailto:") || url.startsWith("tel:")) {
            return url;
          }
          return "";
        }}
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
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-mermaid/.exec(className || "");
            if (match) {
              return <Mermaid code={String(children).trim()} />;
            }
            const langMatch = /language-(\w+)/.exec(className || "");
            if (langMatch) {
              return <CodeBlock lang={langMatch[1]} code={String(children).trim()} />;
            }
            return <code className={className} {...props}>{children}</code>;
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