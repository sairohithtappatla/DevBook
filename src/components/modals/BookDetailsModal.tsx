import { X, Clock, BarChart2, BookOpen, Star, Play } from "lucide-react";

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
  rating: number;
  reviewsCount: number;
  tags: string[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  book: any;
  onStartReading: (bookId: string) => void;
};

// Simulated phase/step outlines for featured books to display inside the details view
const simulatedOutlines: Record<string, { title: string; steps: string[] }[]> = {
  "1": [
    {
      title: "Phase 1 - Initialization",
      steps: [
        "1.1 Introduction to Workflow Engines",
        "1.2 Express Application Boilerplate Setup",
        "1.3 Environment Variable Configurations"
      ]
    },
    {
      title: "Phase 2 - Database Integration",
      steps: [
        "2.1 Prisma Schema Modeling",
        "2.2 PostgreSQL Connection Settings",
        "2.3 Database Migrations and Seed Files"
      ]
    },
    {
      title: "Phase 3 - Queue Management",
      steps: [
        "3.1 Redis Server Installation",
        "3.2 BullMQ Job Processor Queue Setup",
        "3.3 Handling Failed Process Retries"
      ]
    }
  ],
  "2": [
    {
      title: "Phase 1 - Setup",
      steps: [
        "1.1 JWT Cryptographic Signatures",
        "1.2 Custom Auth Controller Middlewares"
      ]
    },
    {
      title: "Phase 2 - Verification",
      steps: [
        "2.1 Token Signature Verifications",
        "2.2 Login Request Verification Triggers"
      ]
    }
  ]
};

export function BookDetailsModal({ isOpen, onClose, book, onStartReading }: Props) {
  if (!isOpen || !book) return null;

  const category = book.category || "Development";
  const estimatedTime = book.estimatedTime || "2.5 hours";
  const difficulty = book.difficulty || "Intermediate";
  const stepsCount = book.stepsCount || book.steps_count || 12;
  const rating = book.rating || 4.8;
  const reviewsCount = book.reviewsCount || 86;
  const avatar = book.author?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
  const role = book.author?.role || "Senior Architect & Contributor";

  const outline = simulatedOutlines[book.id] || [
    {
      title: "Phase 1 - Introduction & Setup",
      steps: [
        "1.1 Environment Setup",
        "1.2 Installation Instructions",
        "1.3 Hello World Initialization"
      ]
    },
    {
      title: "Phase 2 - Code Implementation",
      steps: [
        "2.1 Core Algorithm Designs",
        "2.2 Code Structure Layouts",
        "2.3 Unit Test Validations"
      ]
    }
  ];

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
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-warning fill-warning" />
              <span className="text-text-primary font-bold">{rating}</span>
              <span className="text-text-muted font-normal">({reviewsCount} reviews)</span>
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
              <span className="text-[10px] text-text-secondary truncate">{role}</span>
            </div>
          </div>

          {/* Outline step tree */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider select-none">Book Syllabus Outline</h3>
            
            <div className="space-y-4">
              {outline.map((phase, idx) => (
                <div key={idx} className="border border-border-light rounded-xl overflow-hidden bg-surface-secondary/50">
                  <div className="bg-surface-secondary px-4 py-2 border-b border-border-light text-[11px] font-bold text-text-primary uppercase tracking-wide">
                    {phase.title}
                  </div>
                  <div className="p-3 divide-y divide-border-light/40 space-y-2.5">
                    {phase.steps.map((step, sIdx) => (
                      <div key={sIdx} className="pt-2 flex items-center gap-2.5 text-xs text-text-secondary font-medium font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span className="truncate">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
export default BookDetailsModal;
