import { useState, useEffect } from "react";
import { Menu, Search, Sun, Moon } from "lucide-react";
import { useSearch } from "@/providers/SearchProvider";
import { useAuth } from "@/hooks/useAuth";

type TopNavigationProps = {
  onMenuClick: () => void;
  showSearch?: boolean;
  title?: string;
};

export function TopNavigation({ onMenuClick, showSearch = true, title }: TopNavigationProps) {
  const { searchQuery, setSearchQuery } = useSearch();
  const { user } = useAuth();

  // Dark/Light theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <header className="h-16 bg-background flex items-center justify-between px-8 shrink-0 z-10 w-full">
      {/* Left side: Hamburger & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-surface-secondary text-text-secondary cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="font-heading text-lg font-bold text-text-primary hidden sm:block select-none tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right side: Search bar & Theme Toggle */}
      <div className="flex items-center gap-10 flex-1 justify-end">
        {showSearch && (
          <div className="relative w-full max-w-[480px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search books, topics, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-10 pr-12 rounded-md border border-border bg-surface text-base text-text-primary placeholder-text-text-muted focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 border border-border bg-surface-secondary rounded text-[10px] text-text-secondary select-none pointer-events-none font-heading font-medium">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-6">
          {/* Theme Toggle (Dark/Light mode) */}
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="p-2 rounded-md hover:bg-surface-secondary text-text-secondary cursor-pointer relative shrink-0"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Profile Avatar (w-10 h-10) */}
          <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex items-center justify-center font-heading font-semibold text-xs shrink-0 select-none cursor-pointer">
            {user?.profile?.avatar_url ? (
              <img
                src={user.profile.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                alt="Profile Placeholder"
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
