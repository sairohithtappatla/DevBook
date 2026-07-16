import { X, Clock, BarChart2, BookOpen, Play } from "lucide-react";

export type BookData = {
  id: string;
  title: string;
  author: {
    name: string;
    avatar: string;
    role: string;
  };
  description: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  stepsCount: number;
  coverType: string;
  tags: string[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  book: any;
  onStartReading: (bookId: string) => void;
};

export function BookDetailsModal({ isOpen, onClose, book, onStartReading }: Props) {
  if (!isOpen || !book) return null;

  const category = book.category || "Development";
  const estimatedTime = book.estimatedTime || "2.5 hours";
  const difficulty = book.difficulty || "Intermediate";
  const stepsCount = book.stepsCount || book.steps_count || 0;
  const avatar = book.author?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
  const role = book.author?.role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Dialog Frame */}
      <div className="bg-surface border border-border w-full max-w-2xl h-[90vh] md:h-[80vh] rounded-2xl shadow-xl flex flex-col overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header banner background */}
        <div className="h-40 bg-gradient-to-br from-[#1E1B4B] to-[#311042] p-6 relative flex flex-col justify-end">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <span className="bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-wider mb-2">
            {category}
          </span>
          <h2 className="text-xl font-bold text-white font-heading truncate">{book.title}</h2>
        </div>

        {/* Scrollable details area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 select-text">
          {/* Metadata chips */}
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-text-secondary border-b border-border-light pb-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-text-muted" />
              <span>{estimatedTime} duration</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-text-muted" />
              <span>{difficulty} level</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-text-muted" />
              <span>{stepsCount} steps</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider select-none">About this book</h3>
            <p className="text-[13.5px] text-text-secondary leading-relaxed font-sans">{book.description}</p>
          </div>

          {/* Creator card */}
          <div className="bg-surface-secondary border border-border-light rounded-xl p-4 flex items-center gap-3">
            <img
              src={avatar}
              alt={book.author?.name}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-text-primary truncate">{book.author?.name}</span>
              {role && <span className="text-[10px] text-text-secondary truncate">{role}</span>}
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-surface-secondary/50 p-4 text-xs text-text-secondary">
            Open the reader to view the live book structure.
          </div>
        </div>

        {/* Footer with Get Started CTA */}
        <div className="h-16 border-t border-border bg-surface-secondary flex items-center justify-between px-6 select-none shrink-0">
          <div className="flex flex-col">
            <span className="text-[9px] text-text-muted font-bold uppercase">Ready to learn?</span>
            <span className="text-xs font-bold text-text-primary">Instant Sandbox Included</span>
          </div>

          <button
            onClick={() => onStartReading(book.id)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 stroke-[3]" /> Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
