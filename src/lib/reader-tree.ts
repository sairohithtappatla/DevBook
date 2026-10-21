// Contract of the database function public.reader_book_tree(target_book_id uuid, include_drafts boolean) -> jsonb
// (mcp/proposals/rls-hardening/final/02_reader_objects.sql) and its mapping onto the shapes the reader UI already uses.
//
// Output of the function:
//   null                                   book missing, not readable by the caller, or soft-deleted (hidden from everyone, owner included)
//   { book, phases }
//   book   = { id, title, slug, description, cover_url, publication_status, access_level, estimated_read_time,
//              difficulty, tags, created_by, created_at, updated_at, creator: {id,name,avatar_url,bio} | null }
//   phases = [{ id, title, position, steps: [step...] }]   only phases that contain at least one visible step
//   step   = { id, title, position, slug, description, difficulty, estimatedTime, visibility, status, markdown,
//              publishedMarkdown, attachments: [{ id, file_name, storage_path, file_type, file_size }] }
//            slug/description/difficulty/estimatedTime/visibility/publishedMarkdown may be JSON null.
//   include_drafts=false (or caller may not view drafts): only published text; status "Published"; markdown == publishedMarkdown.
//   include_drafts=true and caller is OWNER/EDITOR/REVIEWER: also unpublished steps; markdown is the DRAFT text and
//   publishedMarkdown is the published text or null.
import type { DBBook, DBUser } from "@/services/db";

export type ReaderTreeAttachment = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number | null;
};

export type ReaderTreeStep = {
  id: string;
  title: string;
  position: number;
  slug: string | null;
  description: string | null;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | null;
  estimatedTime: number | null;
  visibility: "Public" | "Followers" | "Selected" | "Private" | null;
  status: string;
  markdown: string;
  publishedMarkdown: string | null;
  attachments: ReaderTreeAttachment[];
};

export type ReaderTree = {
  book: Omit<DBBook, "creator"> & { creator: DBUser | null };
  phases: { id: string; title: string; position: number; steps: ReaderTreeStep[] }[];
};

// Same shape DBService.getBookStructure() returns today (plus attachments, which the UI does not use yet).
export type ReaderStructurePhase = {
  id: string;
  title: string;
  steps: {
    id: string;
    title: string;
    slug: string;
    markdown: string;
    publishedMarkdown: string | undefined;
    description: string;
    status: string;
    difficulty: string;
    estimatedTime: number;
    visibility: string;
    attachments: ReaderTreeAttachment[];
  }[];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// null stays null ("no access / not found"); anything that is not the documented shape throws instead of rendering a
// wrong book.
export function parseReaderTree(raw: unknown): ReaderTree | null {
  if (raw === null || raw === undefined) return null;
  if (!isObj(raw) || !isObj(raw.book) || typeof raw.book.id !== "string" || !Array.isArray(raw.phases)) {
    throw new Error("Unexpected reader_book_tree response");
  }
  for (const p of raw.phases) {
    if (!isObj(p) || typeof p.id !== "string" || !Array.isArray(p.steps)) throw new Error("Unexpected reader_book_tree response");
    for (const s of p.steps) {
      if (!isObj(s) || typeof s.id !== "string" || typeof s.title !== "string") throw new Error("Unexpected reader_book_tree response");
    }
  }
  return raw as unknown as ReaderTree;
}

export function treeToBook(tree: ReaderTree): DBBook {
  return { ...tree.book, creator: tree.book.creator ?? null };
}

// Mirrors getBookStructure(bookId, isReaderView = true): published text wins when present, otherwise the current text,
// and the same defaults apply to missing metadata.
export function treeToStructure(tree: ReaderTree): ReaderStructurePhase[] {
  return [...tree.phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.id,
      title: p.title,
      steps: [...p.steps]
        .sort((a, b) => a.position - b.position)
        .map((s) => {
          const published = s.publishedMarkdown === null ? undefined : s.publishedMarkdown;
          return {
            id: s.id,
            title: s.title,
            slug: s.slug || "",
            markdown: published !== undefined ? published : s.markdown || "",
            publishedMarkdown: published,
            description: s.description || "",
            status: s.status || "Draft",
            difficulty: s.difficulty || "Beginner",
            estimatedTime: s.estimatedTime || 10,
            visibility: s.visibility || "Public",
            attachments: s.attachments ?? [],
          };
        }),
    }));
}

// Every step id the caller can see in this tree (what resetBookProgress must clear).
export function treeStepIds(tree: ReaderTree | null): string[] {
  return tree ? tree.phases.flatMap((p) => p.steps.map((s) => s.id)) : [];
}
