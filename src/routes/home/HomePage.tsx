import { useRef, useEffect, useState } from "react";
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

// Mock data matching home page
const mockBooks: BookData[] = [
  {
    id: "1",
    title: "Workflow Engine",
    description: "Build a production ready workflow engine from scratch.",
    steps_count: 24,
    author: { name: "Rohith" },
  },
  {
    id: "2",
    title: "Authentication System",
    description: "Implement JWT auth, roles, permissions & more.",
    steps_count: 18,
    author: { name: "Ananya" },
  },
  {
    id: "3",
    title: "E-commerce Backend",
    description: "A complete backend for an e-commerce platform.",
    steps_count: 31,
    author: { name: "Sai Kiran" },
  },
  {
    id: "4",
    title: "AWS Infrastructure",
    description: "Learn to design, deploy and manage scalable infra.",
    steps_count: 22,
    author: { name: "Vamsi" },
  },
  {
    id: "5",
    title: "Python API Mastery",
    description: "Build fast and powerful APIs with FastAPI.",
    steps_count: 16,
    author: { name: "Meera" },
  },
  {
    id: "6",
    title: "Database Design",
    description: "Master relational design principles and SQL.",
    steps_count: 20,
    author: { name: "Rahul" },
  },
  {
    id: "7",
    title: "System Design Basics",
    description: "Understand the fundamentals of scalable system design.",
    steps_count: 28,
    author: { name: "Arjun" },
  },
  {
    id: "8",
    title: "Docker Deep Dive",
    description: "Containerize applications like a pro.",
    steps_count: 14,
    author: { name: "Neha" },
  },
];

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
  const { searchQuery } = useSearch();
  const isLargeDesktop = useMediaQuery("(min-width: 1280px)");

  // Filter books by query and category
  const filteredBooks = mockBooks.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.author?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCategory === "All") return true;

    // Mapping category mock categories to specific books for simulation
    const categoryMapping: Record<string, string[]> = {
      Backend: ["Workflow Engine", "Authentication System", "E-commerce Backend", "Python API Mastery"],
      DevOps: ["AWS Infrastructure", "Docker Deep Dive"],
      "System Design": ["System Design Basics"],
      Databases: ["Database Design"],
      "API Design": ["Python API Mastery"],
      Architecture: ["Workflow Engine", "System Design Basics"],
    };

    return categoryMapping[selectedCategory]?.includes(book.title) ?? false;
  });

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
      <HeroSection onExploreClick={onExploreBooks} />

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
        <FramerCarousel books={filteredBooks} onBookSelect={onBookSelect} />
      </Section>

      {/* Responsive Inline Widgets for Tablet/Mobile */}
      {renderInlineWidgets()}
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
        <div className="bg-surface border border-border rounded-2xl p-2.5">
          <CategoriesWidget
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
          />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-2.5">
          <TopCreatorsWidget />
        </div>
      </div>
      <div className="flex-1" />
      <CreateBookCTA onCreateClick={onCreateBook} />
    </div>
  );
}
