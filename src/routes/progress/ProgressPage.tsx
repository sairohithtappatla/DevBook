import { useState, useEffect } from "react";
import { useBooks } from "@/hooks/useBooks";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { insforge } from "@/lib/insforge";

function mapDBBookToProgressBook(dbBook: any): ProgressBook {
  let stepsCompleted = 0;
  let stepsTotal = 2;
  let percentage = 0;
  let lastRead = "Not started yet";

  try {
    const savedMeta = localStorage.getItem(`book-meta-progress-${dbBook.id}`);
    if (savedMeta) {
      const parsed = JSON.parse(savedMeta);
      stepsCompleted = parsed.stepsCompleted ?? 0;
      stepsTotal = parsed.stepsTotal ?? 2;
      percentage = parsed.percentage ?? 0;
      lastRead = parsed.lastRead ?? "Not started yet";
    }
  } catch (e) {
    console.error(e);
  }

  return {
    id: dbBook.id,
    title: dbBook.title,
    author: "DevBook Creator",
    stepsCompleted,
    stepsTotal,
    percentage,
    lastRead,
    coverType: dbBook.cover_url || "workflow",
    status: percentage === 100 ? "completed" : "in-progress"
  };
}
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Box,
  Database,
  Layers,
  Code2,
  Globe
} from "lucide-react";

type ProgressBook = {
  id: string;
  title: string;
  author: string;
  stepsCompleted: number;
  stepsTotal: number;
  percentage: number;
  lastRead: string;
  coverType: string;
  status: "in-progress" | "completed";
};

function BookCoverSVG({ type }: { type: string }) {
  const key = (type || "").toLowerCase();
  const iconClassName = "item-thumb-icon";

  let icon = <Code2 className={iconClassName} />;
  let themeClass = "item-thumb-workflow"; // dark background

  if (key.includes("docker") || key.includes("devops")) {
    icon = <Box className={iconClassName} />;
    themeClass = "item-thumb-docker"; // blue background
  } else if (key.includes("database") || key.includes("postgres") || key.includes("databases")) {
    icon = <Database className={iconClassName} />;
    themeClass = "item-thumb-database"; // yellow/orange background
  } else if (key.includes("system") || key.includes("design")) {
    icon = <SlidersHorizontal className={iconClassName} />;
    themeClass = "item-thumb-docker"; // blue background
  } else if (key.includes("api") || key.includes("globe")) {
    icon = <Globe className={iconClassName} />;
    themeClass = "item-thumb-database"; // yellow/orange background
  } else if (key.includes("architecture") || key.includes("layers")) {
    icon = <Layers className={iconClassName} />;
    themeClass = "item-thumb-workflow"; // dark background
  }

  return (
    <div className={`item-thumb ${themeClass} select-none shrink-0`}>
      {icon}
    </div>
  );
}

function getCategoryLabel(type: string): string {
  const key = (type || "").toLowerCase();
  if (key.includes("docker") || key.includes("devops")) return "DevOps";
  if (key.includes("database") || key.includes("postgres") || key.includes("databases")) return "Databases";
  if (key.includes("system design") || (key.includes("system") && key.includes("design"))) return "System Design";
  if (key.includes("api design") || key.includes("api")) return "API Design";
  if (key.includes("architecture")) return "Architecture";
  if (key.includes("backend") || key.includes("python") || key.includes("django") || key.includes("node")) return "Backend";
  return "others";
}

export function ProgressPage({ onBookSelect }: { onBookSelect?: (bookId: string) => void } = {}) {
  const { data: dbBooks = [] } = useBooks();
  const books = dbBooks.map(mapDBBookToProgressBook);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [resetConfirmBookId, setResetConfirmBookId] = useState<string | null>(null);

  const handleResetProgress = async (bookId: string) => {
    try {
      localStorage.removeItem(`book-meta-progress-${bookId}`);
      
      if (user?.id) {
        // Fetch phases for this book
        const { data: phases } = await insforge.database
          .from("phases")
          .select("id")
          .eq("book_id", bookId);
        
        const phaseIds = phases?.map((p) => p.id) || [];
        if (phaseIds.length > 0) {
          // Fetch steps for these phases
          const { data: steps } = await insforge.database
            .from("steps")
            .select("id")
            .in("phase_id", phaseIds);
          
          const stepIds = steps?.map((s) => s.id) || [];
          if (stepIds.length > 0) {
            // Delete step progresses in database
            await insforge.database
              .from("step_progress")
              .delete()
              .eq("user_id", user.id)
              .in("step_id", stepIds);
          }
        }
        
        // Reset book progress percentage in database
        await insforge.database
          .from("book_progress")
          .update({ progress_percentage: 0, last_read_step_id: null })
          .eq("user_id", user.id)
          .eq("book_id", bookId);
          
        queryClient.invalidateQueries({ queryKey: ["step-progresses", user.id] });
        queryClient.invalidateQueries({ queryKey: ["book-progress", user.id, bookId] });
      }
      
      queryClient.invalidateQueries({ queryKey: ["books"] });
    } catch (e) {
      console.error(e);
    }
  };

  const [activeTab, setActiveTab] = useState<"in-progress" | "completed" | "all">("in-progress");
  const [sortBy, setSortBy] = useState<"recent" | "progress" | "title">("recent");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6; // Display 6 rows per page

  const sortLabels = {
    recent: "Recent Activity",
    progress: "Progress (High-Low)",
    title: "Title (A-Z)"
  };

  // Filter books
  const filteredBooks = books.filter((book) => {
    if (activeTab === "all") return true;
    return book.status === activeTab;
  });

  // Sort books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === "progress") {
      return b.percentage - a.percentage;
    }
    if (sortBy === "title") {
      return a.title.localeCompare(b.title);
    }
    const timeA = a.lastRead === "Not started yet" ? 0 : new Date(a.lastRead).getTime() || 0;
    const timeB = b.lastRead === "Not started yet" ? 0 : new Date(b.lastRead).getTime() || 0;
    return timeB - timeA;
  });

  // Reset page on tab or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortBy]);

  const totalPages = Math.ceil(sortedBooks.length / pageSize);
  const visibleBooks = sortedBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const inProgressCount = books.filter((b) => b.status === "in-progress").length;
  const completedCount = books.filter((b) => b.status === "completed").length;



  return (
    <div className="page-content-container my-books-page progress-page">
      <div className="my-books-header-row">
        <div className="page-header-block">
          <h2 className="page-title">My Progress</h2>
          <p className="page-subtext">
            Track your learning progress and continue where you left off.
          </p>
        </div>
      </div>



      <div className="tabs-filters-row">
        <div className="tabs-list custom-scrollbar">
          {[
            { id: "in-progress", label: "In Progress", count: inProgressCount },
            { id: "completed", label: "Completed", count: completedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            >
              {tab.label}
              <span className="tab-count">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="filters-controls relative">
          <button 
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="filter-dropdown"
          >
            Sort: {sortLabels[sortBy]}
            <ChevronDown className="filter-icon" />
          </button>
          
          {showSortDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-md z-40 p-1">
              {(Object.keys(sortLabels) as Array<keyof typeof sortLabels>).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option);
                    setShowSortDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
                    sortBy === option ? "bg-surface-secondary text-primary font-semibold" : "text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          )}

          <button className="filter-dropdown">
            <SlidersHorizontal className="filter-icon" />
            Filter
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {[
                { label: "Book", width: "25%" },
                { label: "Author", width: "12%" },
                { label: "Category", width: "18%" },
                { label: "Progress", width: "15%" },
                { label: "Status", width: "15%" },
                { label: "Actions", width: "15%" }
              ].map((col) => (
                <th key={col.label} style={{ width: col.width }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleBooks.map((book) => (
              <tr key={book.id}>
                <td>
                  <div className="table-book-cell">
                    <BookCoverSVG type={book.coverType} />
                    <div className="table-book-info">
                      <div className="table-book-title">{book.title}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="font-medium text-xs text-text-secondary">
                    {book.author || "Unknown"}
                  </span>
                </td>
                <td>
                  <span className="font-medium text-xs text-text-secondary">
                    {getCategoryLabel(book.coverType)}
                  </span>
                </td>
                <td>
                  <div className="table-steps font-medium">
                    {book.stepsCompleted} / {book.stepsTotal} steps
                  </div>
                </td>
                <td>{getStatusDot(book.status)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      onClick={() => onBookSelect?.(book.id)}
                      className="btn btn-primary h-8 px-3 rounded-md bg-[#111827] hover:bg-black text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => setResetConfirmBookId(book.id)}
                      className="btn btn-secondary h-8 px-3 rounded-md text-xs font-semibold cursor-pointer border border-border hover:bg-surface-secondary text-text-secondary hover:text-danger transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="pagination-row">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pag-btn"
          >
            <ChevronLeft className="pag-icon" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`pag-btn ${currentPage === page ? "active" : ""}`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pag-btn"
          >
            <ChevronRight className="pag-icon" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {resetConfirmBookId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-surface border border-border p-6 rounded-xl max-w-sm w-full mx-4 shadow-lg flex flex-col gap-4">
            <h3 className="text-base font-semibold text-text-primary">Confirm Progress Reset</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to reset your progress for this book? This will reset all your steps to zero in local storage and in the database.
            </p>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setResetConfirmBookId(null)}
                className="btn btn-secondary px-3 py-1.5 rounded-md text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (resetConfirmBookId) {
                    await handleResetProgress(resetConfirmBookId);
                    setResetConfirmBookId(null);
                  }
                }}
                className="btn px-3 py-1.5 rounded-md text-xs font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              >
                Reset Progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusDot(status: ProgressBook["status"]) {
  if (status === "completed") {
    return (
      <span className="status-line">
        <span className="status-dot status-dot-published" />
        Completed
      </span>
    );
  }

  return (
    <span className="status-line">
      <span className="status-dot status-dot-draft" />
      In Progress
    </span>
  );
}
