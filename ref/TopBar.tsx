import { type ReactNode } from "react";
import { Search, Sun, Moon } from "lucide-react";
import { useTheme, useMounted } from "@/stores/theme";

type Crumb = { label: string; to?: string };

export function TopBar({
  crumbs = [],
  right,
}: {
  crumbs?: Crumb[];
  right?: ReactNode;
}) {
  const [theme, , toggle] = useTheme();
  const mounted = useMounted();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-hairline bg-background/75 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="opacity-30">/</span>}
            <span
              className={
                i === crumbs.length - 1
                  ? "text-foreground"
                  : "hover:text-foreground transition-colors"
              }
            >
              {c.label}
            </span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="flex h-8 min-w-[240px] items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Search docs, books, snippets…</span>
          <kbd className="ml-auto rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>
        {right}
      </div>
    </header>
  );
}