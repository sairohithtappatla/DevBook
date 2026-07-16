import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { BookGrid } from "@/components/books/BookGrid";
import type { BookData } from "@/components/books/BookCard";
import { useSearch } from "@/providers/SearchProvider";
import { CategoriesWidget } from "@/components/home/CategoriesWidget";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBooks } from "@/hooks/useBooks";

function mapDBBookToBookData(dbBook: any): BookData {
  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "",
    cover_url: dbBook.cover_url || "workflow",
    steps_count: 12,
    author: {
      name: "DevBook Creator",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
    },
    created_at: dbBook.created_at,
    tags: dbBook.tags
  };
}

type FeaturedBooksPageProps = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onBookSelect?: (book: BookData) => void;
};

export function FeaturedBooksPage({
  selectedCategory,
  onSelectCategory,
  onBookSelect,
}: FeaturedBooksPageProps) {
  const { data: dbBooks = [] } = useBooks();

  const { searchQuery } = useSearch();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);

  // Filter books by query and category
  const filteredDBBooks = dbBooks.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCategory === "All") return true;

    return (book.tags || []).some(tag => tag.toLowerCase() === selectedCategory.toLowerCase());
  });

  const filteredBooks = filteredDBBooks.map(mapDBBookToBookData);

  // Calculate dynamic page sizes based on columns to keep EXACTLY 4 rows per page:
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let cols = 1;
      if (width >= 1280) cols = 4;
      else if (width >= 1024) cols = 3;
      else if (width >= 640) cols = 2;
      
      setPageSize(cols * 4); // Always 4 rows!
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredBooks.length / pageSize);
  const visibleBooks = filteredBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <PageContainer className="flex flex-col justify-start space-y-6 pb-6">
      {/* Header filter row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <p className="text-sm font-medium text-text-secondary select-none">
          Explore all published developer roadmaps
        </p>
        <CategoriesWidget
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          layout="horizontal"
          showTitle={false}
          className="w-full md:w-auto"
        />
      </div>

      {/* Main content grid */}
      <div className="space-y-6">
        <BookGrid books={visibleBooks} onBookClick={onBookSelect} className="w-full" />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6 border-t border-border/60">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-border hover:bg-surface-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-text-primary" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-8 h-8 px-2 rounded-md text-xs font-semibold font-sans transition-colors cursor-pointer border ${
                    currentPage === page
                      ? "bg-text-primary text-white border-text-primary"
                      : "border-border hover:bg-surface-secondary text-text-secondary"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-border hover:bg-surface-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-text-primary" />
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
