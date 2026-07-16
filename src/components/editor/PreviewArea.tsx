import { memo } from "react";
import {
  MoreVertical,
  Globe,
  Lock,
  Users,
  Check,
  Trash2,
} from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

type PreviewAreaProps = {
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  previewMarkdown: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  dbBook: any;
  handleBookVisibilityChange: (visibility: "public" | "private" | "followers") => void;
  handleBookDelete: () => void;
};

export const PreviewArea = memo(function PreviewArea({
  previewContainerRef,
  previewMarkdown,
  menuRef,
  menuOpen,
  setMenuOpen,
  dbBook,
  handleBookVisibilityChange,
  handleBookDelete,
}: PreviewAreaProps) {
  return (
    <div
      ref={previewContainerRef}
      className="hidden min-w-0 flex-1 flex-col xl:flex overflow-hidden"
    >
      <div className="relative flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5 shrink-0 select-none">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[color:var(--color-accent-emerald)]">
            ● auto-updating
          </span>
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Book options"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-hairline bg-popover shadow-2xl">
                <div className="px-3 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Visibility
                </div>
                {([
                  { v: "public", icon: Globe, label: "Public", desc: "Anyone with the link" },
                  { v: "private", icon: Lock, label: "Private", desc: "Only you" },
                  { v: "followers", icon: Users, label: "Followers", desc: "Only followers" },
                ] as const).map(({ v, icon: Icon, label, desc }) => (
                  <button
                    key={v}
                    onClick={() => handleBookVisibilityChange(v)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 cursor-pointer ${
                      (dbBook?.access_level === "PUBLIC" && v === "public") ||
                      (dbBook?.access_level === "PRIVATE" && v === "private") ||
                      (dbBook?.access_level === "FOLLOWERS" && v === "followers")
                        ? "bg-surface-2"
                        : ""
                    }`}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-foreground">
                        {label}
                        {((dbBook?.access_level === "PUBLIC" && v === "public") ||
                          (dbBook?.access_level === "PRIVATE" && v === "private") ||
                          (dbBook?.access_level === "FOLLOWERS" && v === "followers")) && (
                          <Check className="h-3 w-3 text-[color:var(--color-accent-emerald)]" />
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{desc}</div>
                    </div>
                  </button>
                ))}
                <div className="border-t border-hairline">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleBookDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 cursor-pointer font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete book
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-8 select-text">
        <div className="mx-auto max-w-2xl">
          <ErrorBoundary>
            <Markdown>{previewMarkdown}</Markdown>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
});
