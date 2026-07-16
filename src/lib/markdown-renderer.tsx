import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCodeSync, highlightCode } from "./shiki";
import { renderMermaid } from "./mermaid";
import { Copy, Check, Info, AlertTriangle, AlertCircle, Sparkles } from "lucide-react";

type AsyncCodeBlockProps = {
  code: string;
  lang: string;
};

function AsyncCodeBlock({ code, lang }: AsyncCodeBlockProps) {
  const [html, setHtml] = useState<string>(() => highlightCodeSync(code, lang));
  const [svg, setSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isMermaid, setIsMermaid] = useState(lang === "mermaid");

  useEffect(() => {
    setIsMermaid(lang === "mermaid");
  }, [lang]);

  useEffect(() => {
    if (isMermaid) {
      const elementId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      renderMermaid(code, elementId).then((renderedSvg) => {
        setSvg(renderedSvg);
      });
    } else {
      highlightCode(code, lang).then((renderedHtml) => {
        setHtml(renderedHtml);
      });
    }
  }, [code, lang, isMermaid]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isMermaid) {
    if (!svg) {
      return (
        <div className="w-full flex items-center justify-center p-8 bg-surface-secondary border border-border-light rounded-xl font-mono text-[11px] text-text-secondary select-none">
          Generating architecture diagram...
        </div>
      );
    }
    return (
      <div className="my-5 w-full flex justify-center overflow-x-auto bg-surface p-6 border border-border rounded-xl shadow-xs">
        <div className="mermaid-rendered max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    );
  }

  return (
    <div className="my-5 bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-sm relative group">
      <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-slate-800 select-none">
        <span className="text-[11px] font-mono font-semibold text-slate-400">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <div className="code-render-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Custom blockquote component to render GitHub-style callouts
function CustomBlockquote({ children }: { children: React.ReactNode }) {
  // Extract text nodes to check for alerts
  const textContent = String(children);
  const isAlert = textContent.includes("[!NOTE]") ||
                  textContent.includes("[!TIP]") ||
                  textContent.includes("[!WARNING]") ||
                  textContent.includes("[!CAUTION]") ||
                  textContent.includes("[!IMPORTANT]");

  if (!isAlert) {
    return (
      <blockquote className="pl-4 py-2 border-l-4 border-border bg-surface-secondary text-[14px] text-text-secondary rounded-r-lg my-4 italic">
        {children}
      </blockquote>
    );
  }

  // Parse type of callout
  let alertTitle = "Note";
  let Icon = Info;
  let borderClass = "border-[#2563EB] bg-[#EFF6FF]";
  let textClass = "text-[#1E40AF]";

  if (textContent.includes("[!NOTE]")) {
    alertTitle = "Note";
    Icon = Info;
    borderClass = "border-primary bg-primary-light";
    textClass = "text-primary";
  } else if (textContent.includes("[!TIP]")) {
    alertTitle = "Tip";
    Icon = Sparkles;
    borderClass = "border-[#16A34A] bg-[#F0FDF4]";
    textClass = "text-[#16A34A]";
  } else if (textContent.includes("[!WARNING]")) {
    alertTitle = "Warning";
    Icon = AlertTriangle;
    borderClass = "border-warning bg-[#FEF3C7]";
    textClass = "text-[#D97706]";
  } else if (textContent.includes("[!CAUTION]") || textContent.includes("[!IMPORTANT]")) {
    alertTitle = textContent.includes("[!IMPORTANT]") ? "Important" : "Caution";
    Icon = AlertCircle;
    borderClass = "border-danger bg-[#FEE2E2]";
    textClass = "text-danger";
  }

  // Remove alert header from text
  const cleanChildren = React.Children.map(children, (child: any) => {
    if (typeof child === "string" || (child && typeof child === "object" && "props" in child && typeof child.props?.children === "string")) {
      const targetStr = typeof child === "string" ? child : child.props.children;
      const cleaned = targetStr
        .replace(/\[!NOTE\]|\[!TIP\]|\[!WARNING\]|\[!CAUTION\]|\[!IMPORTANT\]/g, "")
        .trim();
      if (typeof child === "string") return cleaned;
      return { ...child, props: { ...child.props, children: cleaned } };
    }
    return child;
  });

  return (
    <div className={`border-l-4 p-4 rounded-r-xl my-4 select-none ${borderClass}`}>
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1.5 ${textClass}`}>
        <Icon className="w-4 h-4" />
        <span>{alertTitle}</span>
      </div>
      <div className="text-[13.5px] text-text-secondary leading-relaxed font-sans select-text">
        {cleanChildren}
      </div>
    </div>
  );
}

type MarkdownRendererProps = {
  markdown: string;
};

export function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  return (
    <div className="prose-docs select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render code fences using AsyncCodeBlock
          code({ className, children, ...props }) {
            const isInline = !className;
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1] : "";
            const codeText = String(children).replace(/\n$/, "");

            if (isInline) {
              return (
                <code className="bg-surface-secondary px-1.5 py-0.5 border border-border rounded text-[12px] font-mono text-[#D97706]" {...props}>
                  {children}
                </code>
              );
            }

            return <AsyncCodeBlock code={codeText} lang={lang} />;
          },
          // Customize blockquotes
          blockquote({ children }) {
            return <CustomBlockquote>{children}</CustomBlockquote>;
          },
          h2({ children }) {
            const text = React.Children.toArray(children).join("");
            const id = text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
            return <h2 id={id} className="text-2xl font-bold tracking-tight text-text-primary mt-6 mb-2 border-t border-border-light pt-4">{children}</h2>;
          },
          h3({ children }) {
            const text = React.Children.toArray(children).join("");
            const id = text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
            return <h3 id={id} className="text-xl font-bold tracking-tight text-text-primary mt-4 mb-2">{children}</h3>;
          },
          // Style lists
          ul({ children }) {
            return <ul className="list-disc pl-5 my-3 space-y-1 text-[14px] text-text-secondary font-sans">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-3 space-y-1 text-[14px] text-text-secondary font-sans">{children}</ol>;
          },
          // Style links
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium font-sans">
                {children}
              </a>
            );
          },
          // Style tables
          table({ children }) {
            return (
              <div className="overflow-x-auto my-5 border border-border rounded-xl">
                <table className="w-full text-left border-collapse text-[13px] font-sans">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-surface-secondary border-b border-border text-text-primary font-semibold">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-4 py-2">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-2 border-b border-border-light text-text-secondary">{children}</td>;
          }
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
