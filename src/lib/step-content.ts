// Rules for writing a step's `content` JSON from the editor.
//
// `content` holds BOTH the editable draft (`markdown`) and what readers see (`publishedMarkdown`). An ordinary save
// (autosave, metadata edit) must only touch draft fields: publishing is a separate, explicit action. Saves are merged into
// the step's CURRENT server content (see DBService.updateStep), so any key a save does not send keeps its server value.

// The only keys an ordinary editor save may write. Deliberately NOT included:
//   publishedMarkdown  - only the explicit Publish action sets it
//   status             - changes only with Publish; a stale editor must not flip it
export const DRAFT_CONTENT_KEYS = ["slug", "markdown", "description", "difficulty", "estimatedTime", "visibility"] as const;
export type DraftContentKey = (typeof DRAFT_CONTENT_KEYS)[number];

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Keeps only draft keys with a defined value. `undefined` must never reach the database: JSON drops it, and with a
// whole-object write that silently deleted the key (the bug that removed publishedMarkdown on autosave).
export function draftContentPatch(fields: Partial<Record<DraftContentKey, unknown>> & Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of DRAFT_CONTENT_KEYS) if (fields[key] !== undefined) out[key] = fields[key];
  return out;
}

// Overlays `patch` on the server's current content. Keys absent from the patch, or `undefined` in it, keep the server value.
export function mergeStepContent(serverContent: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = isPlainObject(serverContent) ? { ...serverContent } : {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) merged[key] = value;
  return merged;
}
