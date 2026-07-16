import { useMemo, useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  Eye,
  Globe,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  User,
  Users,
  Layers,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { CreateBookModal } from "@/components/modals/CreateBookModal";
import { useBooks, useBookStepCounts, useCreateBook, useDeleteBook } from "@/hooks/useBooks";
import { useAuth } from "@/hooks/useAuth";
import type { DBBook } from "@/services/db";

type BookRecord = DBBook & {
  created_at?: string;
  updated_at?: string;
};

type BookItem = {
  id: string;
  title: string;
  description: string;
  phases: number;
  steps: number;
  visibility: "Public" | "Followers" | "Selected" | "Private";
  updatedDate: string;
  updatedRelative: string;
  status: "Published" | "Draft" | "Archived";
  coverType: string;
  created_by: string | null;
};

function mapDBBookToBookItem(dbBook: BookRecord, stepCounts?: Record<string, number>): BookItem {
  const dateValue = dbBook.updated_at || dbBook.created_at;
  const category = dbBook.tags?.[0] || "default";
  const stepCount = stepCounts?.[dbBook.id] || 0;

  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "Developer guide draft",
    phases: stepCount ? Math.ceil(stepCount / 3) : 0,
    steps: stepCount,
    visibility:
      dbBook.access_level === "FOLLOWERS"
        ? "Followers"
        : dbBook.access_level === "SELECTED"
          ? "Selected"
          : dbBook.access_level === "PRIVATE"
            ? "Private"
            : "Public",
    updatedDate: dateValue
      ? new Date(dateValue).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Recently",
    updatedRelative: "Updated recently",
    status:
      dbBook.publication_status === "PUBLISHED"
        ? "Published"
        : dbBook.publication_status === "ARCHIVED"
          ? "Archived"
          : "Draft",
    coverType: category.toLowerCase(),
    created_by: dbBook.created_by || null,
  };
}

function BookThumb({ type }: { type: string }) {
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
    <div className={`item-thumb ${themeClass}`}>
      {icon}
    </div>
  );
}

export function getCategoryLabel(type: string): string {
  const key = (type || "").toLowerCase();
  if (key.includes("docker") || key.includes("devops")) return "DevOps";
  if (key.includes("database") || key.includes("postgres") || key.includes("databases")) return "Databases";
  if (key.includes("system design") || (key.includes("system") && key.includes("design"))) return "System Design";
  if (key.includes("api design") || key.includes("api")) return "API Design";
  if (key.includes("architecture")) return "Architecture";
  if (key.includes("backend") || key.includes("python") || key.includes("django") || key.includes("node")) return "Backend";
  return "others";
}

export function MyBooksPage({
  onEditBook,
  onViewBook,
}: {
  onEditBook?: (bookId: string) => void;
  onViewBook?: (bookId: string) => void;
} = {}) {
  const { data: dbBooks = [], refetch: refetchBooks, isFetching: isFetchingBooks } = useBooks();
  const bookIds = useMemo(() => dbBooks.map((book) => book.id), [dbBooks]);
  const { data: stepCounts, refetch: refetchCounts, isFetching: isFetchingCounts } = useBookStepCounts(bookIds);
  
  const handleRefresh = async () => {
    await Promise.all([refetchBooks(), refetchCounts()]);
  };

  const books = useMemo(
    () => dbBooks.map((book) => mapDBBookToBookItem(book, stepCounts)),
    [dbBooks, stepCounts],
  );
  const createBookMutation = useCreateBook();
  const { user } = useAuth();
  const deleteBookMutation = useDeleteBook();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "published" | "drafts" | "archived">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy] = useState("Newest");

  const counts = {
    all: books.length,
    published: books.filter((book) => book.status === "Published").length,
    drafts: books.filter((book) => book.status === "Draft").length,
    archived: books.filter((book) => book.status === "Archived").length,
  };

  const handleTabChange = (tabId: "all" | "published" | "drafts" | "archived") => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const filteredBooks = books.filter((book) => {
    if (activeTab === "published") return book.status === "Published";
    if (activeTab === "drafts") return book.status === "Draft";
    if (activeTab === "archived") return book.status === "Archived";
    return true;
  });

  const ITEMS_PER_PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / ITEMS_PER_PAGE));
  const paginatedBooks = filteredBooks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCreateBook = (newBook: {
    title: string;
    description: string;
    category: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    coverType: string;
  }): void => {
    // Generate unique slug suffix to prevent collision
    const slugSuffix = Math.random().toString(36).substring(2, 7);
    const cleanTitle = newBook.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const uniqueSlug = `${cleanTitle}-${slugSuffix}`;

    createBookMutation.mutate(
      {
        title: newBook.title,
        slug: uniqueSlug,
        description: newBook.description,
        cover_url: newBook.coverType,
        publication_status: "DRAFT",
        access_level: "PUBLIC",
        estimated_read_time: 60,
        difficulty:
          newBook.difficulty === "Beginner"
            ? "BEGINNER"
            : newBook.difficulty === "Intermediate"
              ? "INTERMEDIATE"
              : "ADVANCED",
        tags: [newBook.category],
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
        },
        onError: (err) => {
          console.error("Failed to create book:", err);
          alert(`Failed to create book: ${err instanceof Error ? err.message : String(err)}`);
        },
      }
    );
  };

  const tabItems = [
    { id: "all", label: "All Books", count: counts.all },
    { id: "published", label: "Published", count: counts.published },
    { id: "drafts", label: "Drafts", count: counts.drafts },
    { id: "archived", label: "Archived", count: counts.archived },
  ] as const;

  return (
    <div className="page-content-container my-books-page">
      <div className="my-books-header-row">
        <div className="page-header-block">
          <h2 className="page-title">My Books</h2>
          <p className="page-subtext">
            Create, manage and publish your developer guides.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn btn-primary btn-create-book"
        >
          <Plus className="btn-icon" />
          Create Book
        </button>
      </div>

      <div className="tabs-filters-row">
        <div className="tabs-list custom-scrollbar">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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
          <button
            onClick={handleRefresh}
            disabled={isFetchingBooks || isFetchingCounts}
            className="filter-dropdown flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh from DB"
          >
            <RefreshCw className={`filter-icon w-3.5 h-3.5 ${isFetchingBooks || isFetchingCounts ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {["Book", "Category", "Visibility", "Updated", "Status", "Actions"].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedBooks.map((book) => (
              <tr key={book.id}>
                <td>
                  <div className="table-book-cell">
                    <BookThumb type={book.coverType} />
                    <div className="table-book-info">
                      <div className="table-book-title">{book.title}</div>
                      <div className="table-book-desc">{book.description}</div>
                      <div className="table-book-phases">
                        {book.phases} Phases - {book.steps} Steps
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="font-medium text-xs text-text-secondary">
                    {getCategoryLabel(book.coverType)}
                  </span>
                </td>
                <td>{getVisibilityBadge(book.visibility)}</td>
                <td>
                  <div className="table-date">{book.updatedDate}</div>
                  <div className="table-date-sub">{book.updatedRelative}</div>
                </td>
                <td>{getStatusDot(book.status)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      onClick={() => onViewBook?.(book.id)}
                      className="btn-table-action"
                      title="Preview"
                    >
                      <Eye className="table-action-icon" />
                    </button>
                    <button
                      onClick={() => onEditBook?.(book.id)}
                      className="btn-table-action"
                      title="Edit"
                    >
                      <Pencil className="table-action-icon" />
                    </button>
                    {user && user.id === book.created_by && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                            deleteBookMutation.mutate(book.id);
                          }
                        }}
                        className="btn-table-action text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="table-action-icon" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button 
          className="pag-btn"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
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
          className="pag-btn"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="pag-icon" />
        </button>
      </div>

      <CreateBookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        isPending={createBookMutation.isPending}
        onCreateBook={handleCreateBook}
      />
    </div>
  );
}

function getVisibilityBadge(visibility: BookItem["visibility"]) {
  switch (visibility) {
    case "Public":
      return (
        <span className="badge badge-public">
          <Globe className="badge-icon" />
          Public
        </span>
      );
    case "Followers":
      return (
        <span className="badge badge-followers">
          <Users className="badge-icon" />
          Followers
        </span>
      );
    case "Selected":
      return (
        <span className="badge badge-selected">
          <User className="badge-icon" />
          Selected
        </span>
      );
    case "Private":
      return (
        <span className="badge badge-private">
          <Lock className="badge-icon" />
          Private
        </span>
      );
  }
}

function getStatusDot(status: BookItem["status"]) {
  if (status === "Published") {
    return (
      <span className="status-line">
        <span className="status-dot status-dot-published" />
        Published
      </span>
    );
  }

  if (status === "Archived") {
    return (
      <span className="status-line">
        <span className="status-dot status-dot-archived" />
        Archived
      </span>
    );
  }

  return (
    <span className="status-line">
      <span className="status-dot status-dot-draft" />
      Draft
    </span>
  );
}
