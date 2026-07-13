import { BookOpen } from "lucide-react";

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
};

type BookCardProps = {
  book: BookData;
  onClick?: () => void;
  variant?: "grid" | "feed" | "compact";
};

// Render custom exact mock banners from home.png design
function BookCardBanner({ title }: { title: string }) {
  switch (title) {
    case "Workflow Engine":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#1b1c30] to-[#252849] flex items-center justify-center p-4 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
          <svg className="w-full h-full max-h-[110px] drop-shadow-md" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#312E81" />
              </linearGradient>
              <linearGradient id="activeNodeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            {/* Connection Lines */}
            <path d="M42 50 H70 V25 H98" stroke="#4B5563" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M42 50 H70 V75 H98" stroke="#4B5563" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M122 25 H150 V50 H178" stroke="#3B82F6" strokeWidth="2" />
            <path d="M122 75 H150 V50 H178" stroke="#4B5563" strokeWidth="2" strokeDasharray="3 3" />
            
            {/* Nodes */}
            <rect x="18" y="38" width="24" height="24" rx="8" fill="url(#nodeGrad)" stroke="#6366F1" strokeWidth="1.5" />
            <rect x="98" y="13" width="24" height="24" rx="8" fill="url(#nodeGrad)" stroke="#6366F1" strokeWidth="1.5" />
            <rect x="98" y="63" width="24" height="24" rx="8" fill="url(#nodeGrad)" stroke="#6366F1" strokeWidth="1.5" />
            <rect x="178" y="38" width="24" height="24" rx="8" fill="url(#activeNodeGrad)" stroke="#60A5FA" strokeWidth="1.5" className="animate-pulse" />
            
            {/* Inner Graphics */}
            <circle cx="30" cy="50" r="3" fill="#A5B4FC" />
            <circle cx="110" cy="25" r="3" fill="#A5B4FC" />
            <circle cx="110" cy="75" r="3" fill="#A5B4FC" />
            <path d="M185 50 L188 53 L194 46" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case "Authentication System":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-2 left-6 w-8 h-8 rounded-full bg-blue-300/10 blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-blue-100/50 relative z-1">
            <svg className="w-9 h-9 text-blue-600 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="11" r="2" />
              <path d="M12 13v4" />
            </svg>
          </div>
        </div>
      );
    case "E-commerce Backend":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute bottom-2 right-6 w-10 h-10 rounded-full bg-emerald-300/15 blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-emerald-100/50 relative z-1">
            <svg className="w-9 h-9 text-emerald-600 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
        </div>
      );
    case "AWS Infrastructure":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-orange-300/10 blur-lg" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-orange-100/50 relative z-1">
            <svg className="w-9 h-9 text-orange-500 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>
      );
    case "Python API Mastery":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#FFFDE7] to-[#FFF9C4] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-2 left-2 w-10 h-10 bg-yellow-300/20 rounded-full blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-yellow-100/50 relative z-1">
            <svg className="w-9 h-9 text-yellow-600 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>
      );
    case "Database Design":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#F3E5F5] to-[#E1BEE7] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute bottom-2 left-6 w-8 h-8 rounded-full bg-purple-300/20 blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-purple-100/50 relative z-1">
            <svg className="w-9 h-9 text-purple-600 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
            </svg>
          </div>
        </div>
      );
    case "System Design Basics":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-red-300/10 blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-red-100/50 relative z-1">
            <svg className="w-9 h-9 text-red-500 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </div>
        </div>
      );
    case "Docker Deep Dive":
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#E1F5FE] to-[#B3E5FC] flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute bottom-4 right-2 w-8 h-8 rounded-full bg-sky-300/20 blur-md" />
          <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-xs shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-sky-100/50 relative z-1">
            <svg className="w-9 h-9 text-sky-500 drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10v6M12 2v20M2 10h20M2 14h20" />
            </svg>
          </div>
        </div>
      );
    default:
      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 bg-blue-50/50 flex flex-col items-center justify-center gap-2 p-4">
          <BookOpen className="w-8 h-8 opacity-80" />
          <span className="font-heading text-xs font-medium uppercase tracking-wider opacity-60">DevBook Guide</span>
        </div>
      );
  }
}

export function BookCard({ book, onClick, variant = "grid" }: BookCardProps) {
  const { title, description, cover_url, steps_count = 0, author } = book;

  if (variant === "compact") {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-4 bg-surface border border-border rounded-2xl shadow-xs hover:border-primary/20 hover:shadow-sm transition-all duration-150 cursor-pointer"
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary-light">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-heading text-sm font-semibold text-text-primary truncate">{title}</h4>
          <p className="font-body text-xs text-text-secondary truncate">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-150 cursor-pointer h-full"
    >
      {/* Banner / Cover (150px height) */}
      <div className="relative h-[150px] w-full overflow-hidden border-b border-border shrink-0">
        {cover_url ? (
          <img
            src={cover_url}
            alt={title}
            className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
          />
        ) : (
          <BookCardBanner title={title} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-between gap-4">
        <div className="space-y-1.5">
          <h3 className="font-heading text-base font-semibold text-text-primary line-clamp-1 leading-snug">
            {title}
          </h3>
          <p className="font-body text-sm text-text-secondary line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-light text-xs font-medium">
          {author ? (
            <div className="flex items-center gap-2 min-w-0">
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt={author.name}
                  className="w-6 h-6 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary-light text-primary border border-border flex items-center justify-center font-heading font-semibold text-[10px] shrink-0 select-none">
                  {author.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-body text-text-primary truncate">{author.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="font-body">Unknown Creator</span>
            </div>
          )}

          {/* Steps indicator - flat text design */}
          <div className="flex items-center gap-1 text-text-secondary shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>{steps_count} steps</span>
          </div>
        </div>
      </div>
    </div>
  );
}
