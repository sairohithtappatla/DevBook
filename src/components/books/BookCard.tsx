import { ArrowRight } from "lucide-react";

export type BookAuthor = {
  name: string;
  avatar_url?: string;
};

export type BookData = {
  id: string;
  title: string;
  description: string;
  cover_url?: string;
  steps_count?: number;
  author?: BookAuthor;
  created_at?: string;
  tags?: string[];
};

type BookCardProps = {
  book: BookData;
  onClick?: () => void;
  variant?: "grid" | "feed" | "compact";
};

function getRelativeTimeString(dateString?: string): string {
  if (!dateString) return "Recently";
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return "Recently";
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return "just now";
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 30) {
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    } else if (diffMonths < 12) {
      return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
    } else {
      return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
    }
  } catch (e) {
    return "Recently";
  }
}

export function BookCard({ book, onClick }: BookCardProps) {
  const { title, description, steps_count, author, created_at, tags } = book;

  const category = (tags && tags[0]) || "DEVELOPMENT";
  const phasesCount = steps_count ? Math.ceil(steps_count / 3) : 0;
  const relativeDate = getRelativeTimeString(created_at);

  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-150 cursor-pointer h-full justify-between gap-4 select-none"
    >
      {/* Top Meta Header */}
      <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-text-secondary/60 uppercase">
        <span>{category}</span>
        <span className="lowercase font-medium text-text-secondary/60">
          {phasesCount} {phasesCount === 1 ? "phase" : "phases"}
        </span>
      </div>

      {/* Title & Description */}
      <div className="flex-1 space-y-2 mt-1">
        <h3 className="font-heading text-lg font-bold text-text-primary line-clamp-2 leading-snug">
          {title}
        </h3>
        <p className="font-body text-sm text-text-secondary line-clamp-3 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Author & Date info */}
      <div className="flex items-center gap-2 pt-2 text-xs font-medium">
        {author ? (
          <div className="flex items-center gap-2 min-w-0">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.name}
                className="w-5 h-5 rounded-full object-cover border border-border"
              />
            ) : (
              // Stylized dot/circle avatar to mimic the green dot in the reference image
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 border border-border shrink-0" />
            )}
            <span className="font-body text-text-primary truncate">{author.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 border border-border shrink-0" />
            <span className="font-body text-text-primary truncate">Unknown Author</span>
          </div>
        )}
        <span className="text-text-secondary/50 font-normal select-none">·</span>
        <span className="font-body text-text-secondary/70 truncate">{relativeDate}</span>
      </div>

      {/* Full-width Action Button */}
      <div className="mt-1 pt-1">
        <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-50 border border-slate-200/60 hover:bg-slate-100 hover:border-slate-300/80 transition-all rounded-md text-sm text-text-primary font-medium">
          <span>Get started</span>
          <ArrowRight className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
    </div>
  );
}
