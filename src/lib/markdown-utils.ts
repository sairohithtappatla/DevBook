export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
