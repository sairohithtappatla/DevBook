import { useState, useEffect } from "react";
import { useBooks } from "@/hooks/useBooks";

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
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ChevronDown,
  SlidersHorizontal,
  Star
} from "lucide-react";

type ProgressBook = {
  id: string;
  title: string;
  author: string;
  stepsCompleted: number;
  stepsTotal: number;
  percentage: number;
  lastRead: string;
  coverType: "workflow" | "auth" | "ecommerce" | "aws" | "python";
  status: "in-progress" | "completed";
};



function BookCoverSVG({ type }: { type: ProgressBook["coverType"] }) {
  switch (type) {
    case "workflow":
      return (
        <div className="w-[64px] h-[52px] rounded-lg bg-[#2A1F45] flex items-center justify-center border border-border/10 overflow-hidden shrink-0 select-none">
          <svg className="w-full h-full p-1.5" viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="42" y="10" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="42" y="40" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="74" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <path d="M26 33 H42" stroke="#A855F7" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M58 18 H74" stroke="#A855F7" strokeWidth="2" />
            <path d="M58 48 H74" stroke="#A855F7" strokeWidth="2" />
            <circle cx="18" cy="33" r="3" fill="#E9D5FF" />
            <path d="M47 18 L53 18" stroke="#E9D5FF" strokeWidth="1.5" />
            <path d="M50 15 L50 21" stroke="#E9D5FF" strokeWidth="1.5" />
            <path d="M79 30 L81 33 L85 29" stroke="#E9D5FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case "auth":
      return (
        <div className="w-[64px] h-[52px] rounded-lg bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] flex items-center justify-center border border-blue-100 overflow-hidden shrink-0 select-none">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fillOpacity="0.1" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      );
    case "ecommerce":
      return (
        <div className="w-[64px] h-[52px] rounded-lg bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] flex items-center justify-center border border-green-100 overflow-hidden shrink-0 select-none">
          <svg className="w-6 h-6 text-[#2E7D32]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
      );
    case "aws":
      return (
        <div className="w-[64px] h-[52px] rounded-lg bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] flex items-center justify-center border border-orange-100 overflow-hidden shrink-0 select-none">
          <svg className="w-6 h-6 text-[#EF6C00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
            <line x1="8" y1="16" x2="8.01" y2="16" />
            <line x1="8" y1="20" x2="8.01" y2="20" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
            <line x1="16" y1="16" x2="16.01" y2="16" />
            <line x1="16" y1="20" x2="16.01" y2="20" />
          </svg>
        </div>
      );
    case "python":
      return (
        <div className="w-[64px] h-[52px] rounded-lg bg-gradient-to-br from-[#FFFDE7] to-[#FFF9C4] flex items-center justify-center border border-yellow-100 overflow-hidden shrink-0 select-none">
          {/* Custom Python-like clean icon */}
          <svg className="w-6 h-6 text-[#EAB308]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" fillOpacity="0.1" />
            <path d="M12 6v12M6 12h12" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export function ProgressPage({ onBookSelect }: { onBookSelect?: (bookId: string) => void } = {}) {
  const { data: dbBooks = [] } = useBooks();
  const books = dbBooks.map(mapDBBookToProgressBook);

  const [activeTab, setActiveTab] = useState<"in-progress" | "completed" | "all">("in-progress");
  const sortBy = "Recent Activity";
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4; // Display 4 rows per page

  // Filter books
  const filteredBooks = books.filter((book) => {
    if (activeTab === "all") return true;
    return book.status === activeTab;
  });

  // Reset page on tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const totalPages = Math.ceil(filteredBooks.length / pageSize);
  const visibleBooks = filteredBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const inProgressCount = books.filter((b) => b.status === "in-progress").length;
  const completedCount = books.filter((b) => b.status === "completed").length;

  const [starredCount] = useState(() => {
    try {
      const saved = localStorage.getItem("starred-books");
      if (saved) return JSON.parse(saved).length;
    } catch {}
    return 1; // Default fallback to 1 starred book
  });

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

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 pb-6">
        {/* In Progress */}
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-text-secondary">In Progress</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-heading text-text-primary">{inProgressCount}</span>
              <span className="text-[12px] text-text-secondary font-medium">books</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#FAF5FF] dark:bg-[#2E1065] flex items-center justify-center text-[#9333EA] border border-purple-100/50 dark:border-purple-900/50">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-text-secondary">Completed</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-heading text-text-primary">{completedCount}</span>
              <span className="text-[12px] text-text-secondary font-medium">books</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] dark:bg-[#14532D] flex items-center justify-center text-[#16A34A] border border-green-100/50 dark:border-green-900/50">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Starred */}
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-text-secondary">Starred</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-heading text-text-primary">{starredCount}</span>
              <span className="text-[12px] text-text-secondary font-medium">books</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] dark:bg-[#78350F] flex items-center justify-center text-[#D97706] border border-amber-100/50 dark:border-amber-900/50">
            <Star className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="tabs-filters-row">
        <div className="tabs-list custom-scrollbar">
          {[
            { id: "in-progress", label: "In Progress", count: inProgressCount },
            { id: "completed", label: "Completed", count: completedCount },
            { id: "all", label: "All Books", count: books.length }
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

        <div className="filters-controls">
          <button className="filter-dropdown">
            Sort: {sortBy}
            <ChevronDown className="filter-icon" />
          </button>
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
              {["Book", "Progress", "Last Read", "Steps", "Status", "Actions"].map((heading) => (
                <th key={heading}>{heading}</th>
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
                      <div className="table-book-desc">by {book.author}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3 w-full pr-4">
                    <div className="w-full bg-[#E5E7EB] dark:bg-[#374151] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#16A34A] h-1.5 rounded-full"
                        style={{ width: `${book.percentage}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-bold text-text-primary w-8 shrink-0">
                      {book.percentage}%
                    </span>
                  </div>
                </td>
                <td>
                  <div className="table-date">{book.lastRead}</div>
                </td>
                <td className="table-steps">{book.stepsCompleted} / {book.stepsTotal}</td>
                <td>{getStatusDot(book.status)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      onClick={() => onBookSelect?.(book.id)}
                      className="btn btn-primary h-8 px-3 rounded-md bg-[#111827] hover:bg-black text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Continue
                    </button>
                    <button className="btn-table-action" title="More">
                      <MoreHorizontal className="table-action-icon" />
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
