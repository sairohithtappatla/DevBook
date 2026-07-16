import { useState } from "react";
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
} from "lucide-react";
import { CreateBookModal } from "@/components/modals/CreateBookModal";
import { useBooks, useCreateBook } from "@/hooks/useBooks";
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
  coverType: "workflow" | "docker" | "database" | "default";
};

function mapDBBookToBookItem(dbBook: BookRecord, index: number): BookItem {
  const coverTypes: BookItem["coverType"][] = ["workflow", "docker", "database"];
  const dateValue = dbBook.updated_at || dbBook.created_at;

  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "Developer guide draft",
    phases: index % 2 === 0 ? 3 : 4,
    steps: index % 2 === 0 ? 12 : 18,
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
    coverType: coverTypes[index % coverTypes.length] || "default",
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
  const { data: dbBooks = [] } = useBooks();
  const books = dbBooks.map(mapDBBookToBookItem);
  const createBookMutation = useCreateBook();

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
    createBookMutation.mutate({
      title: newBook.title,
      slug: newBook.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
    });
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
                    <button className="btn-table-action" title="More">
                      <MoreVertical className="table-action-icon" />
                    </button>
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
