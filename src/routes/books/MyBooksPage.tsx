import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Plus,
  ChevronDown,
  List,
  Grid,
  SlidersHorizontal,
  Globe,
  Users,
  User,
  Lock,
  Eye,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

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
  coverType: "workflow" | "auth" | "ecommerce" | "aws" | "python" | "database";
};

const mockBooks: BookItem[] = [
  {
    id: "1",
    title: "Workflow Engine",
    description: "Build a scalable workflow engine from scratch.",
    phases: 8,
    steps: 24,
    visibility: "Public",
    updatedDate: "May 20, 2025",
    updatedRelative: "2 days ago",
    status: "Published",
    coverType: "workflow"
  },
  {
    id: "2",
    title: "Authentication System",
    description: "Implement JWT auth, roles, permissions and more.",
    phases: 6,
    steps: 18,
    visibility: "Followers",
    updatedDate: "May 18, 2025",
    updatedRelative: "4 days ago",
    status: "Published",
    coverType: "auth"
  },
  {
    id: "3",
    title: "E-commerce Backend",
    description: "A complete backend for an e-commerce platform.",
    phases: 10,
    steps: 31,
    visibility: "Selected",
    updatedDate: "May 16, 2025",
    updatedRelative: "6 days ago",
    status: "Published",
    coverType: "ecommerce"
  },
  {
    id: "4",
    title: "AWS Infrastructure",
    description: "Design, deploy and manage scalable infra on AWS.",
    phases: 7,
    steps: 22,
    visibility: "Private",
    updatedDate: "May 15, 2025",
    updatedRelative: "1 week ago",
    status: "Draft",
    coverType: "aws"
  },
  {
    id: "5",
    title: "Python API Mastery",
    description: "Build fast and powerful APIs with FastAPI.",
    phases: 5,
    steps: 16,
    visibility: "Followers",
    updatedDate: "May 15, 2025",
    updatedRelative: "1 week ago",
    status: "Draft",
    coverType: "python"
  },
  {
    id: "6",
    title: "Database Design Guide",
    description: "Master relational design principles and SQL.",
    phases: 6,
    steps: 20,
    visibility: "Selected",
    updatedDate: "May 8, 2025",
    updatedRelative: "2 weeks ago",
    status: "Archived",
    coverType: "database"
  }
];

function BookCoverSVG({ type }: { type: BookItem["coverType"] }) {
  switch (type) {
    case "workflow":
      return (
        <div className="w-[88px] h-[72px] rounded-lg bg-[#2A1F45] flex items-center justify-center border border-border/10 overflow-hidden shrink-0 select-none">
          <svg className="w-full h-full p-2" viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <div className="w-[88px] h-[72px] rounded-lg bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] flex items-center justify-center border border-blue-100 overflow-hidden shrink-0 select-none">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fillOpacity="0.1" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      );
    case "ecommerce":
      return (
        <div className="w-[88px] h-[72px] rounded-lg bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] flex items-center justify-center border border-green-100 overflow-hidden shrink-0 select-none">
          <svg className="w-8 h-8 text-[#2E7D32]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
      );
    case "aws":
      return (
        <div className="w-[88px] h-[72px] rounded-lg bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] flex items-center justify-center border border-orange-100 overflow-hidden shrink-0 select-none">
          <svg className="w-8 h-8 text-[#EF6C00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <div className="w-[88px] h-[72px] rounded-lg bg-gradient-to-br from-[#FFFDE7] to-[#FFF9C4] flex items-center justify-center border border-yellow-100 overflow-hidden shrink-0 select-none">
          <svg className="w-8 h-8 text-[#FBC02D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" fillOpacity="0.1" />
            <path d="M12 6v12M6 12h12" />
          </svg>
        </div>
      );
    case "database":
      return (
        <div className="w-[88px] h-[72px] rounded-lg bg-gradient-to-br from-[#EDE7F6] to-[#D1C4E9] flex items-center justify-center border border-purple-100 overflow-hidden shrink-0 select-none">
          <svg className="w-8 h-8 text-[#673AB7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" fill="currentColor" fillOpacity="0.1" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export function MyBooksPage() {
  const [activeTab, setActiveTab] = useState<"all" | "published" | "drafts" | "archived">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState("Newest");

  const counts = {
    all: mockBooks.length,
    published: mockBooks.filter(b => b.status === "Published").length,
    drafts: mockBooks.filter(b => b.status === "Draft").length,
    archived: mockBooks.filter(b => b.status === "Archived").length,
  };

  const filteredBooks = mockBooks.filter((book) => {
    if (activeTab === "all") return true;
    if (activeTab === "published") return book.status === "Published";
    if (activeTab === "drafts") return book.status === "Draft";
    if (activeTab === "archived") return book.status === "Archived";
    return true;
  });

  const getVisibilityBadge = (visibility: BookItem["visibility"]) => {
    switch (visibility) {
      case "Public":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#DCFCE7] text-[#16A34A]">
            <Globe className="w-3.5 h-3.5" />
            Public
          </span>
        );
      case "Followers":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#EFF6FF] text-[#2563EB]">
            <Users className="w-3.5 h-3.5" />
            Followers
          </span>
        );
      case "Selected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#FEF3C7] text-[#D97706]">
            <User className="w-3.5 h-3.5" />
            Selected
          </span>
        );
      case "Private":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#F3E8FF] text-[#7C3AED]">
            <Lock className="w-3.5 h-3.5" />
            Private
          </span>
        );
    }
  };

  const getStatusDot = (status: BookItem["status"]) => {
    switch (status) {
      case "Published":
        return (
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
            <span className="text-sm font-semibold text-text-primary">Published</span>
          </div>
        );
      case "Draft":
        return (
          <div className="flex items-center gap-2.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
            <span className="text-sm font-semibold text-text-primary">Draft</span>
          </div>
        );
      case "Archived":
        return (
          <div className="flex items-center gap-2.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-text-muted shrink-0" />
            <span className="text-sm font-semibold text-text-primary">Archived</span>
          </div>
        );
    }
  };

  return (
    <PageContainer className="flex flex-col w-full max-w-7xl !space-y-0">
      {/* Title Header */}
      <p className="font-body text-sm font-medium text-text-secondary select-none pb-4">
        Create, manage and publish your developer guides.
      </p>
      {/* Tabs and Actions Row */}
      <div className="flex flex-row items-end justify-between gap-6 border-b border-border/70 pb-0">
        <div className="flex items-center gap-[25px] overflow-x-auto custom-scrollbar select-none -mb-[1px]">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-[10px] pb-3 text-sm tracking-tight transition-all relative border-b-[2px] cursor-pointer ${activeTab === "all" ? "text-[#111827] font-semibold border-[#111827]" : "text-[#6B7280] font-medium border-transparent hover:text-[#111827]"
              }`}
          >
            All Books
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[11px] font-semibold text-[#4B5563]">
              {counts.all}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("published")}
            className={`flex items-center gap-[10px] pb-3 text-sm tracking-tight transition-all relative border-b-[2px] cursor-pointer ${activeTab === "published" ? "text-[#111827] font-semibold border-[#111827]" : "text-[#6B7280] font-medium border-transparent hover:text-[#111827]"
              }`}
          >
            Published
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[11px] font-semibold text-[#4B5563]">
              {counts.published}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("drafts")}
            className={`flex items-center gap-[10px] pb-3 text-sm tracking-tight transition-all relative border-b-[2px] cursor-pointer ${activeTab === "drafts" ? "text-[#111827] font-semibold border-[#111827]" : "text-[#6B7280] font-medium border-transparent hover:text-[#111827]"
              }`}
          >
            Drafts
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[11px] font-semibold text-[#4B5563]">
              {counts.drafts}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`flex items-center gap-[10px] pb-3 text-sm tracking-tight transition-all relative border-b-[2px] cursor-pointer ${activeTab === "archived" ? "text-[#111827] font-semibold border-[#111827]" : "text-[#6B7280] font-medium border-transparent hover:text-[#111827]"
              }`}
          >
            Archived
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[11px] font-semibold text-[#4B5563]">
              {counts.archived}
            </span>
          </button>
        </div>

        {/* Create Book Dropdown Action */}
        <div className="pb-3 shrink-0">
          <div className="inline-flex rounded-md shadow-xs bg-[#111827] hover:bg-black transition-colors cursor-pointer text-white h-8 overflow-hidden">
            <button className="flex items-center gap-1 px-2.5 text-xs font-semibold border-r border-white/10 h-full">
              <Plus className="w-3 h-3" />
              Create Book
            </button>
            <button className="px-1.5 flex items-center justify-center h-full">
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar Options */}
      <div className="flex items-center justify-between gap-4 pt-2 pb-2">
        {/* Left: view toggles */}
        <div className="inline-flex border border-border rounded-lg p-0.5 bg-surface select-none">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewMode === "list" ? "bg-surface-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewMode === "grid" ? "bg-surface-secondary text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>

        {/* Right: sorting & filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-surface hover:bg-surface-secondary text-xs font-medium text-text-primary cursor-pointer transition-colors">
              <span>Sort: {sortBy}</span>
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-surface hover:bg-surface-secondary text-xs font-medium text-text-primary cursor-pointer transition-colors">
            <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
            <span>Filter</span>
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Book List / Table Grid Layout */}
      {viewMode === "list" ? (
        <div className="flex flex-col gap-3">
          {/* Table Headers */}
          <div className="grid grid-cols-[2.5fr_1fr_1.2fr_0.6fr_1fr_1fr] items-center px-6 py-5 text-xs font-bold text-text-muted select-none uppercase tracking-wider">
            <div>Book</div>
            <div className="pl-1">Visibility</div>
            <div>Updated</div>
            <div className="text-center">Steps</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Book Rows */}
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="grid grid-cols-[2.5fr_1fr_1.2fr_0.6fr_1fr_1fr] items-center px-6 py-5 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
            >
              {/* Thumbnail + Title details */}
              <div className="flex items-center gap-6 min-w-0">
                <BookCoverSVG type={book.coverType} />
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <h3 className="font-heading text-lg font-semibold text-text-primary truncate">{book.title}</h3>
                  <p className="text-sm text-[#6B7280] truncate">{book.description}</p>
                  <p className="text-[13px] text-text-muted mt-0.5">{book.phases} Phases • {book.steps} Steps</p>
                </div>
              </div>

              {/* Visibility Badge */}
              <div className="pl-1">
                {getVisibilityBadge(book.visibility)}
              </div>

              {/* Updated Time */}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text-primary">{book.updatedDate}</span>
                <span className="text-xs text-text-muted">{book.updatedRelative}</span>
              </div>

              {/* Steps count (centered) */}
              <div className="text-center text-sm font-semibold text-text-primary">
                {book.steps}
              </div>

              {/* Status Indicator */}
              <div className="text-center">
                {getStatusDot(book.status)}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5">
                <button className="w-10 h-10 flex items-center justify-center border border-border rounded-xl hover:bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="View Documentation">
                  <Eye className="w-[18px] h-[18px]" />
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-border rounded-xl hover:bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Edit Book">
                  <Pencil className="w-[18px] h-[18px]" />
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-border rounded-xl hover:bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid view fallback */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="flex flex-col bg-surface border border-border rounded-xl p-5 hover:shadow-xs transition-shadow duration-150 gap-4"
            >
              <div className="flex justify-between items-start">
                <BookCoverSVG type={book.coverType} />
                {getVisibilityBadge(book.visibility)}
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <h3 className="font-heading text-base font-semibold text-text-primary">{book.title}</h3>
                <p className="text-xs text-text-secondary line-clamp-2">{book.description}</p>
                <p className="text-[10px] text-text-muted mt-1">{book.phases} Phases • {book.steps} Steps</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="flex flex-col">
                  <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Updated</span>
                  <span className="text-xs font-semibold text-text-secondary">{book.updatedRelative}</span>
                </div>
                {getStatusDot(book.status)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button className="flex-1 flex justify-center items-center gap-1 py-1.5 border border-border rounded-lg hover:bg-surface-secondary text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button className="flex-1 flex justify-center items-center gap-1 py-1.5 border border-border rounded-lg hover:bg-surface-secondary text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination component */}
      <div className="flex items-center justify-center gap-1.5 pt-8 pb-12 mt-8 border-t border-border/60">
        <button className="p-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent" disabled>
          <ChevronLeft className="w-4 h-4 text-text-secondary" />
        </button>
        <div className="flex items-center gap-1 select-none">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold bg-text-primary text-white border border-text-primary cursor-pointer">1</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold border border-border hover:bg-surface-secondary text-text-secondary cursor-pointer">2</button>
        </div>
        <button className="p-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors cursor-pointer">
          <ChevronRight className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </PageContainer>
  );
}
