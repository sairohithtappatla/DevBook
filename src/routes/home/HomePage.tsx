import { useRef, useEffect, useState } from "react";
import { BookDetailsModal } from "@/components/modals/BookDetailsModal";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/ui/Section";
import { HeroSection } from "@/components/home/HeroSection";
import type { BookData } from "@/components/books/BookCard";
import { BookCard } from "@/components/books/BookCard";
import { useSearch } from "@/providers/SearchProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CategoriesWidget } from "@/components/home/CategoriesWidget";
import { TopCreatorsWidget } from "@/components/home/TopCreatorsWidget";
import { CreateBookCTA } from "@/components/home/CreateBookCTA";
import { useBooks } from "@/hooks/useBooks";

import type { BookData as ModalBookData } from "@/components/modals/BookDetailsModal";

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

function mapDBBookToModalBookData(dbBook: any): ModalBookData {
  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "",
    coverType: dbBook.cover_url || "workflow",
    difficulty: dbBook.difficulty === "BEGINNER" ? "Beginner" : dbBook.difficulty === "INTERMEDIATE" ? "Intermediate" : "Advanced",
    estimatedTime: `${dbBook.estimated_read_time || 60} mins`,
    stepsCount: 12,
    rating: 4.8,
    reviewsCount: 24,
    tags: dbBook.tags || [],
    category: dbBook.tags?.[0] || "Backend",
    author: {
      name: "DevBook Creator",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
      role: "Creator"
    }
  };
}

type HomePageProps = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onExploreBooks?: () => void;
  onBookSelect?: (book: BookData) => void;
  onCreateBook?: () => void;
};

// Custom Spring-animated horizontally draggable carousel using Framer Motion
function FramerCarousel({ 
  books, 
  onBookSelect 
}: { 
  books: BookData[]; 
  onBookSelect?: (book: BookData) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const isDragging = useRef(false);
  
  const x = useMotionValue(0);
  const springX = useSpring(x, { damping: 30, stiffness: 220, mass: 0.8 });

  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const diff = containerRef.current.scrollWidth - containerRef.current.clientWidth;
        setMaxScroll(diff > 0 ? diff : 0);
      }
    };
    updateBounds();
    window.addEventListener("resize", updateBounds);
    
    const unsubscribe = springX.on("change", (val) => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = -val;
      }
    });

    return () => {
      window.removeEventListener("resize", updateBounds);
      unsubscribe();
    };
  }, [books, springX]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      const currentX = x.get();
      let targetX = currentX - e.deltaY * 1.1;

      if (targetX > 0) targetX = 0;
      if (targetX < -maxScroll) targetX = -maxScroll;

      if (!(e.deltaY < 0 && currentX === 0) && !(e.deltaY > 0 && currentX === -maxScroll)) {
        e.preventDefault();
        x.set(targetX);
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing pb-4 custom-scrollbar scroll-smooth"
      onWheel={handleWheel}
      style={{ touchAction: "pan-y" }}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: -maxScroll, right: 0 }}
        dragElastic={0.08}
        dragTransition={{ power: 0.15, timeConstant: 220 }}
        onDragStart={() => {
          isDragging.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            isDragging.current = false;
          }, 60);
        }}
        style={{ x: springX }}
        className="flex flex-row gap-4 w-fit"
      >
        {books.map((book) => (
          <div key={book.id} className="w-[280px] shrink-0 select-none">
            <BookCard 
              book={book} 
              onClick={() => {
                if (!isDragging.current) {
                  onBookSelect?.(book);
                }
              }} 
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function HomePage({
  selectedCategory,
  onSelectCategory,
  onExploreBooks,
  onBookSelect,
  onCreateBook,
}: HomePageProps) {
  const { data: dbBooks = [] } = useBooks();

  const [selectedBookForDetails, setSelectedBookForDetails] = useState<ModalBookData | null>(null);
  const { searchQuery } = useSearch();
  const isLargeDesktop = useMediaQuery("(min-width: 1280px)");

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

  // Render sidebar widgets inline if on small screens
  const renderInlineWidgets = () => {
    if (isLargeDesktop) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-8 mt-4">
        <div className="bg-surface border border-border rounded-2xl p-3">
          <CategoriesWidget
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
          />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-6">
          <TopCreatorsWidget />
          <CreateBookCTA onCreateClick={onCreateBook} />
        </div>
      </div>
    );
  };

  return (
    <PageContainer className="flex flex-col justify-start space-y-10 pb-6">
      {/* Hero section */}
      <HeroSection onExploreClick={onExploreBooks} className="-mt-2 md:-mt-8" />

      {/* Main content grid */}
      <Section
        title="Featured Books"
        subtitle="Handpicked projects to help you grow"
        action={
          <button
            onClick={onExploreBooks}
            className="text-sm font-black text-black hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
          >
            View all &rarr;
          </button>
        }
        className="w-full"
      >
        <FramerCarousel
          books={filteredBooks}
          onBookSelect={(book) => {
            const dbBook = dbBooks.find(b => b.id === book.id);
            if (dbBook) {
              setSelectedBookForDetails(mapDBBookToModalBookData(dbBook));
            }
          }}
        />
      </Section>

      {/* Responsive Inline Widgets for Tablet/Mobile */}
      {renderInlineWidgets()}

      <BookDetailsModal
        isOpen={selectedBookForDetails !== null}
        onClose={() => setSelectedBookForDetails(null)}
        book={selectedBookForDetails}
        onStartReading={() => {
          if (selectedBookForDetails) {
            onBookSelect?.(selectedBookForDetails);
            setSelectedBookForDetails(null);
          }
        }}
      />
    </PageContainer>
  );
}

// Export the side widgets component for the AppShell rightPanelContent
type HomeRightPanelProps = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onCreateBook?: () => void;
};

export function HomeRightPanel({
  selectedCategory,
  onSelectCategory,
  onCreateBook,
}: HomeRightPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2">
        <div className="bg-surface border border-border rounded-2xl p-2">
          <CategoriesWidget
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
          />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-2">
          <TopCreatorsWidget />
        </div>
      </div>
      <div className="flex-1" />
      <CreateBookCTA onCreateClick={onCreateBook} />
    </div>
  );
}
