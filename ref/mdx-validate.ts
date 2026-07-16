import mermaid from "mermaid";

export type MdxIssue = {
  kind: "mermaid" | "link" | "image" | "embed";
  line: number;
  message: string;
  snippet?: string;
};

const MD_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
const MD_IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;
// crude iframe/embed tag detection
const EMBED = /<(iframe|embed|video|audio|object)\b[^>]*>/gi;

function lineOf(source: string, index: number) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function isValidUrl(raw: string): boolean {
  const url = raw.trim().split(/\s+/)[0] ?? "";
  if (!url) return false;
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("mailto:") || url.startsWith("tel:")) return true;
  if (url.startsWith("data:")) return true;
  try {
    // relative paths (foo/bar.md) are OK
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return /^[\w./\-#?=&%]+$/.test(url);
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function validateMdx(source: string): Promise<MdxIssue[]> {
  const issues: MdxIssue[] = [];

  // Images
  for (const m of source.matchAll(MD_IMAGE)) {
    const [full, , url] = m;
    if (!url || !url.trim()) {
      issues.push({
        kind: "image",
        line: lineOf(source, m.index ?? 0),
        message: "Image is missing a source URL.",
        snippet: full,
      });
    } else if (!isValidUrl(url)) {
      issues.push({
        kind: "image",
        line: lineOf(source, m.index ?? 0),
        message: `Image URL looks malformed: "${url.trim()}"`,
        snippet: full,
      });
    }
  }

  // Links (skip image matches — they start with !)
  for (const m of source.matchAll(MD_LINK)) {
    const idx = m.index ?? 0;
    if (idx > 0 && source[idx - 1] === "!") continue;
    const [full, , url] = m;
    if (!url || !url.trim()) {
      issues.push({
        kind: "link",
        line: lineOf(source, idx),
        message: "Link has an empty URL.",
        snippet: full,
      });
    } else if (!isValidUrl(url)) {
      issues.push({
        kind: "link",
        line: lineOf(source, idx),
        message: `Link URL looks malformed: "${url.trim()}"`,
        snippet: full,
      });
    }
  }

  // Unbalanced link brackets — catches `[text](url` without closing
  const unbalanced = source.match(/\[[^\]]+\]\([^)]*$/gm);
  if (unbalanced) {
    for (const raw of unbalanced) {
      const idx = source.indexOf(raw);
      issues.push({
        kind: "link",
        line: lineOf(source, idx),
        message: "Unclosed link — missing `)`.",
        snippet: raw,
      });
    }
  }

  // Embeds — flag iframes without src
  for (const m of source.matchAll(EMBED)) {
    const [tag] = m;
    if (!/\ssrc=/.test(tag)) {
      issues.push({
        kind: "embed",
        line: lineOf(source, m.index ?? 0),
        message: `<${m[1]}> tag has no src attribute.`,
        snippet: tag,
      });
    }
  }

  // Mermaid blocks
  const mermaidBlock = /```mermaid\s*\n([\s\S]*?)```/g;
  for (const m of source.matchAll(mermaidBlock)) {
    const [, body] = m;
    try {
      await mermaid.parse(body);
    } catch (err) {
      issues.push({
        kind: "mermaid",
        line: lineOf(source, m.index ?? 0),
        message: err instanceof Error ? err.message.split("\n")[0] : "Invalid mermaid syntax.",
        snippet: body.split("\n")[0]?.slice(0, 80),
      });
    }
  }

  return issues;
}

export function summarizeDiff(before: string, after: string) {
  const b = before.split(/\r?\n/);
  const a = after.split(/\r?\n/);
  let added = 0;
  let removed = 0;
  // trivial line-count diff — good enough for a summary
  const bSet = new Map<string, number>();
  for (const l of b) bSet.set(l, (bSet.get(l) ?? 0) + 1);
  for (const l of a) {
    const n = bSet.get(l) ?? 0;
    if (n > 0) bSet.set(l, n - 1);
    else added++;
  }
  for (const n of bSet.values()) removed += n;
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  return {
    linesBefore: b.length,
    linesAfter: a.length,
    added,
    removed,
    wordsDelta: words(after) - words(before),
    charsDelta: after.length - before.length,
  };
}
