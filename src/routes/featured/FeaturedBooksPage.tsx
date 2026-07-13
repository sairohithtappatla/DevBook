import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { BookGrid } from "@/components/books/BookGrid";
import type { BookData } from "@/components/books/BookCard";
import { useSearch } from "@/providers/SearchProvider";
import { CategoriesWidget } from "@/components/home/CategoriesWidget";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Mock data matching home page catalog
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
  {
    id: "9",
    title: "Kubernetes Orchestration",
    description: "Production deployments, scaling, and networking.",
    steps_count: 35,
    author: { name: "Rohith" },
  },
  {
    id: "10",
    title: "GraphQL Gateway",
    description: "Design efficient API federations for microservices.",
    steps_count: 19,
    author: { name: "Ananya" },
  },
  {
    id: "11",
    title: "Redis Caching Patterns",
    description: "Improve performance with distributed caching strategies.",
    steps_count: 12,
    author: { name: "Sai Kiran" },
  },
  {
    id: "12",
    title: "CI/CD Pipeline Design",
    description: "Automate builds, tests, and deployments securely.",
    steps_count: 22,
    author: { name: "Vamsi" },
  },
  {
    id: "13",
    title: "Microservices Architecture",
    description: "Design robust, loosely coupled distributed systems.",
    steps_count: 40,
    author: { name: "Rahul" },
  },
  {
    id: "14",
    title: "API Gateway Patterns",
    description: "Route, secure, rate limit and monitor backend APIs.",
    steps_count: 15,
    author: { name: "Meera" },
  },
  {
    id: "15",
    title: "Serverless Compute",
    description: "Build microservices with AWS Lambda and API Gateway.",
    steps_count: 17,
    author: { name: "Rahul" },
  },
  {
    id: "16",
    title: "OAuth2 Identity Provider",
    description: "Learn authorization flows and token exchange scopes.",
    steps_count: 26,
    author: { name: "Ananya" },
  },
  {
    id: "17",
    title: "Event-Driven Sagas",
    description: "Handle transactional states using RabbitMQ brokers.",
    steps_count: 33,
    author: { name: "Rohith" },
  },
  {
    id: "18",
    title: "NoSQL Modeling",
    description: "Design optimized databases with DynamoDB keys.",
    steps_count: 21,
    author: { name: "Sai Kiran" },
  },
  {
    id: "19",
    title: "Terraform Infrastructure",
    description: "Write declarative cloud architecture templates.",
    steps_count: 24,
    author: { name: "Vamsi" },
  },
  {
    id: "20",
    title: "Elasticsearch Indexing",
    description: "Build reverse-indexes, analyzers, and search pipelines.",
    steps_count: 18,
    author: { name: "Rahul" },
  },
  {
    id: "21",
    title: "FastAPI Webhooks",
    description: "Set up asynchronous payload delivery subscriptions.",
    steps_count: 14,
    author: { name: "Meera" },
  },
  {
    id: "22",
    title: "Distributed Locks",
    description: "Manage sync lock states across nodes with Redis.",
    steps_count: 11,
    author: { name: "Sai Kiran" },
  },
  {
    id: "23",
    title: "Prometheus Monitoring",
    description: "Collect system metrics, alerts, and Grafana boards.",
    steps_count: 25,
    author: { name: "Vamsi" },
  },
  {
    id: "24",
    title: "Kafka Event Streams",
    description: "Create partitions, producers, and scalable consumer groups.",
    steps_count: 32,
    author: { name: "Rohith" },
  },
];

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
  const { searchQuery } = useSearch();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);

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
      Backend: [
        "Workflow Engine", "Authentication System", "E-commerce Backend", "Python API Mastery", 
        "Redis Caching Patterns", "Microservices Architecture", "Serverless Compute", "Event-Driven Sagas", "Distributed Locks"
      ],
      DevOps: ["AWS Infrastructure", "Docker Deep Dive", "Kubernetes Orchestration", "CI/CD Pipeline Design", "Terraform Infrastructure", "Prometheus Monitoring"],
      "System Design": ["System Design Basics", "Microservices Architecture", "Event-Driven Sagas"],
      Databases: ["Database Design", "Redis Caching Patterns", "NoSQL Modeling", "Elasticsearch Indexing", "Distributed Locks"],
      "API Design": ["Python API Mastery", "GraphQL Gateway", "API Gateway Patterns", "OAuth2 Identity Provider", "FastAPI Webhooks", "API Gateway Patterns"],
      Architecture: ["Workflow Engine", "System Design Basics", "Microservices Architecture", "API Gateway Patterns", "Event-Driven Sagas", "API Gateway Patterns"],
    };

    return categoryMapping[selectedCategory]?.includes(book.title) ?? false;
  });

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
