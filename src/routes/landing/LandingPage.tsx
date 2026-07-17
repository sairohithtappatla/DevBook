import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useBooks, useBookStepCounts } from "@/hooks/useBooks";
import { BookCard, type BookData } from "@/components/books/BookCard";
import { LogIn, Compass, ChevronRight, Sun, Moon, RefreshCw ,BookOpen} from "lucide-react";
import { useTheme } from "@/stores/theme";

const CATEGORIES = [
  "All",
  "Backend",
  "DevOps",
  "System Design",
  "Databases",
  "API Design",
  "Architecture"
];

function mapDBBookToBookData(dbBook: any, stepCounts?: Record<string, number>): BookData {
  let username = (dbBook.creator?.name || "user").toLowerCase().replace(/\s+/g, "_");
  try {
    if (dbBook.creator?.bio?.startsWith("{")) {
      const parsed = JSON.parse(dbBook.creator.bio);
      if (parsed.username) {
        username = parsed.username;
      }
    }
  } catch (e) {
    // Ignore
  }

  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "",
    cover_url: dbBook.cover_url || "workflow",
    steps_count: stepCounts?.[dbBook.id] || 0,
    author: {
      name: dbBook.creator?.name || "Unknown Author",
      avatar_url: dbBook.creator?.avatar_url || "https://api.dicebear.com/9.x/glass/svg?seed=creator",
      username
    },
    created_at: dbBook.created_at,
    tags: dbBook.tags || []
  };
}


export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [theme, , toggleTheme] = useTheme();
  const { data: dbBooks = [], refetch: refetchBooks, isFetching: isFetchingBooks } = useBooks();
  const bookIds = useMemo(() => dbBooks.map((book) => book.id), [dbBooks]);
  const { data: stepCounts, refetch: refetchCounts, isFetching: isFetchingCounts } = useBookStepCounts(bookIds);

  const handleRefresh = async () => {
    await Promise.all([refetchBooks(), refetchCounts()]);
  };

  const [selectedCategory, setSelectedCategory] = useState("All");

  // We map all public books
  const books = useMemo(() => {
    return dbBooks.map((b) => mapDBBookToBookData(b, stepCounts));
  }, [dbBooks, stepCounts]);

  const filteredBooks = useMemo(() => {
    if (selectedCategory === "All") return books;
    return books.filter((b) => b.tags?.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()));
  }, [books, selectedCategory]);

  const handleBookSelect = (book: BookData) => {
    navigate({ to: `/books/${book.id}` });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-40 w-full border-b border-hairline bg-background/80 backdrop-blur-xs px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate({ to: "/" })}>
          <img
            src="/logo.svg"
            alt="DevBook Logo"
            className="w-10 h-10 dark:invert shrink-0 transition-transform hover:scale-105"
          />
          <span className="font-heading text-2xl font-extrabold tracking-tight">devbook</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Theme Toggle (Dark/Light mode) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-surface-secondary text-text-secondary cursor-pointer shrink-0 w-9 h-9 flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => navigate({ to: "/home" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-black text-white dark:bg-white dark:text-black px-4 text-xs font-bold hover:opacity-90 cursor-pointer transition-opacity"
            >
              Go to Dashboard <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/login" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-black text-white dark:bg-white dark:text-black px-4 text-xs font-bold hover:opacity-90 cursor-pointer transition-opacity"
            >
              <LogIn className="w-3.5 h-3.5" /> Login
            </button>
          )}
        </div>
      </header>

      {/* Main Landing Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 space-y-12">
        {/* Hero Section */}
        <section className="text-center max-w-2xl mx-auto space-y-4">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            Smarter Developer guides.
          </h1>
          <p className="font-body text-base text-text-secondary leading-relaxed">
            Beautifully structured, step-by-step developer guides for modern stacks and architecture. Start reading instantly.
          </p>
        </section>

        {/* Categories Bar */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-text-secondary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary select-none">
                Explore Handbooks
              </h2>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isFetchingBooks || isFetchingCounts}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBooks || isFetchingCounts ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                    : "bg-surface border border-hairline text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Books Grid */}
        {filteredBooks.length === 0 ? (
          <div className="border border-dashed border-hairline rounded-2xl p-16 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No handbooks found in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => handleBookSelect(book)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} devbook. Developed by <span className="text-sm font-bold">SaiRohith </span>. All rights reserved.</p>
      </footer>

    </div>
  );
}
