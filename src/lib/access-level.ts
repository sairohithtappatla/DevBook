// Single source of truth for books.access_level (enum access_level in the database).
// Every value the database accepts is listed here; nothing else may be written to the column.
export const ACCESS_LEVELS = ["PUBLIC", "UNLISTED", "PRIVATE", "FOLLOWERS_ONLY", "SELECTED_USERS"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type VisibilityLabel = "Public" | "Unlisted" | "Followers" | "Selected" | "Private" | "Unknown";

const LABELS: Record<AccessLevel, VisibilityLabel> = {
  PUBLIC: "Public",
  UNLISTED: "Unlisted",
  PRIVATE: "Private",
  FOLLOWERS_ONLY: "Followers",
  SELECTED_USERS: "Selected",
};

// Levels the visibility menu may WRITE. SELECTED_USERS needs a list of users (book_access) that this app has no
// screen for, so it is displayed and preserved but never chosen from the menu.
export const SELECTABLE_ACCESS_LEVELS: readonly AccessLevel[] = ["PUBLIC", "UNLISTED", "FOLLOWERS_ONLY", "PRIVATE"];

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}

// A value outside the enum is shown as "Unknown", never silently as another level.
export function visibilityLabel(level: unknown): VisibilityLabel {
  return isAccessLevel(level) ? LABELS[level] : "Unknown";
}

// Lower-case form used by the reader's Book type. Unknown values fall back to the most restrictive label.
export function readerVisibility(level: unknown): "public" | "unlisted" | "private" | "followers" | "selected" {
  switch (level) {
    case "PUBLIC": return "public";
    case "UNLISTED": return "unlisted";
    case "FOLLOWERS_ONLY": return "followers";
    case "SELECTED_USERS": return "selected";
    default: return "private";
  }
}
