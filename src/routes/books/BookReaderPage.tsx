import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/lib/markdown-renderer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useBookStructure } from "@/hooks/useBooks";
import {
  useBookProgress,
  useStepProgresses,
  useStartBookProgress,
  useUpdateBookProgress,
  useUpdateStepProgress
} from "@/hooks/useProgress";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sun,
  Moon,
  Maximize2,
  CheckCircle,
  BookOpen,
  ArrowRight,
  FolderOpen,
  CheckCircle2,
  Download,
  FileText,
  Menu,
  PanelLeftClose,
  PanelRightClose
} from "lucide-react";

// Types
type Step = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  description: string;
  status: "Published" | "Draft" | "Archived";
  estimatedTime: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  visibility: "Public" | "Followers" | "Selected" | "Private";
  isCompleted?: boolean;
};

type Phase = {
  id: string;
  title: string;
  steps: Step[];
};

type Asset = {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "json" | "zip";
};

type Props = {
  bookId: string;
  onBack: () => void;
};

export function BookReaderPage({ bookId, onBack }: Props) {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setShowLeftSidebar(false);
      setShowRightSidebar(false);
    }
  }, []);

  // State for active step selection
  const [activeStepId, setActiveStepId] = useState("step-1-2");
  
  // Search text filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Theme state
  const [darkMode, setDarkMode] = useState(false);
  
  // Command Search Bar state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  // Attachments mock list
  const [assets] = useState<Asset[]>([
    { id: "asset-1", name: "Project Structure.pdf", size: "245 KB", type: "pdf" },
    { id: "asset-2", name: "API Endpoints Collection.json", size: "18 KB", type: "json" }
  ]);

  const { user } = useAuth();
  const { data: dbBookStructure = [] } = useBookStructure(bookId);
  const { data: dbProgress } = useBookProgress(user?.id, bookId);
  const { data: dbStepProgresses = [] } = useStepProgresses(user?.id);

  const startProgressMutation = useStartBookProgress();
  const updateProgressMutation = useUpdateBookProgress();
  const updateStepProgressMutation = useUpdateStepProgress();

  // Phases and steps structure (source of truth)
  const [phases, setPhases] = useState<Phase[]>([]);

  useEffect(() => {
    if (dbBookStructure && dbBookStructure.length > 0) {
      const completedStepIds = new Set(
        dbStepProgresses
          .filter(sp => sp.status === "COMPLETED")
          .map(sp => sp.step_id)
      );

      const mapped = dbBookStructure.map(p => ({
        id: p.id,
        title: p.title,
        steps: p.steps.map(s => ({
          ...s,
          isCompleted: completedStepIds.has(s.id)
        }))
      }));

      setPhases(mapped as any);

      if (dbProgress && dbProgress.last_read_step_id) {
        setActiveStepId(dbProgress.last_read_step_id);
      } else {
        const firstStepId = mapped[0]?.steps?.[0]?.id;
        if (firstStepId) {
          setActiveStepId(firstStepId);
        }
      }
    }
  }, [dbBookStructure, dbProgress, dbStepProgresses]);

  // Flattened steps list for navigation
  const allSteps: Step[] = [];
  phases.forEach((p) => p.steps.forEach((s) => allSteps.push(s)));

  // Save progress dynamically to database
  useEffect(() => {
    if (!user || !bookId || !activeStepId || activeStepId.startsWith("step-") || allSteps.length === 0) return;

    startProgressMutation.mutate({ userId: user.id, bookId });

    const completedCount = allSteps.filter(s => s.isCompleted).length;
    const percentage = Math.round((completedCount / allSteps.length) * 100) || 0;

    updateProgressMutation.mutate({
      userId: user.id,
      bookId,
      updates: {
        progress_percentage: percentage,
        last_read_step_id: activeStepId
      }
    });

    const activeStepTitle = allSteps.find(s => s.id === activeStepId)?.title || "";
    if (activeStepTitle) {
      localStorage.setItem(`book-meta-progress-${bookId}`, JSON.stringify({
        stepsCompleted: completedCount,
        stepsTotal: allSteps.length,
        percentage,
        lastRead: activeStepTitle
      }));
    }
  }, [activeStepId, user, bookId, phases]);

  // Find active step index
  const activeStepIndex = allSteps.findIndex((s) => s.id === activeStepId);
  const activeStep = allSteps[activeStepIndex];

  // Find active phase details
  let activePhaseTitle = "";
  for (const p of phases) {
    if (p.steps.some((s) => s.id === activeStepId)) {
      activePhaseTitle = p.title;
      break;
    }
  }

  // Calculate overall progress stats
  const totalStepsCount = allSteps.length;
  const completedStepsCount = allSteps.filter((s) => s.isCompleted).length;
  const completionPercentage = Math.round((completedStepsCount / totalStepsCount) * 100) || 0;

  // Toggle step completion status
  const handleToggleCompletion = (stepId: string) => {
    if (!user) return;
    const step = allSteps.find((s) => s.id === stepId);
    if (!step) return;
    const nextCompleted = !step.isCompleted;

    updateStepProgressMutation.mutate({
      userId: user.id,
      stepId,
      status: nextCompleted ? "COMPLETED" : "IN_PROGRESS"
    });

    setPhases((prev) =>
      prev.map((phase) => ({
        ...phase,
        steps: phase.steps.map((s) =>
          s.id === stepId ? { ...s, isCompleted: nextCompleted } : s
        )
      }))
    );
  };

  // Keyboard shortcut listener for search overlay (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Previous and Next steps
  const prevStep = activeStepIndex > 0 ? allSteps[activeStepIndex - 1] : null;
  const nextStep = activeStepIndex < allSteps.length - 1 ? allSteps[activeStepIndex + 1] : null;

  // Filter left navigation tree elements based on inline search query
  const filteredPhases = phases.map((phase) => {
    const matchedSteps = phase.steps.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...phase, steps: matchedSteps };
  }).filter((p) => p.steps.length > 0 || p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // Search dialog queries
  const modalFilteredSteps = allSteps.filter((s) =>
    s.title.toLowerCase().includes(modalSearch.toLowerCase())
  );

  return (
    <div className={`flex flex-col w-screen h-screen relative overflow-hidden bg-surface ${darkMode ? "dark" : ""}`}>
      
      {/* Top Header Navigation */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface shrink-0 z-10 select-none">
        
        {/* Left Side Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer mr-1 flex items-center justify-center"
            title="Toggle Syllabus Sidebar"
            aria-label="Toggle syllabus sidebar"
          >
            {showLeftSidebar ? <PanelLeftClose className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button onClick={onBack} className="text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer">
            Library
          </button>
          <span className="text-text-muted">&gt;</span>
          <span className="text-text-secondary">Workflow Engine</span>
          <span className="text-text-muted">&gt;</span>
          <span className="text-text-secondary truncate max-w-[120px]">{activePhaseTitle}</span>
          {activeStep && (
            <>
              <span className="text-text-muted">&gt;</span>
              <span className="text-text-primary font-bold">{activeStep.title}</span>
            </>
          )}
        </div>

        {/* Center Search Bar */}
        <div className="relative w-80 max-w-sm hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-text-muted" />
          </div>
          <input
            onClick={() => setShowSearchModal(true)}
            type="text"
            readOnly
            placeholder="Search in this book..."
            className="w-full h-8 pl-9 pr-10 border border-border bg-surface hover:bg-surface-secondary rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <span className="text-[10px] bg-border-light text-text-secondary px-1.5 py-0.5 rounded font-mono">⌘K</span>
          </div>
        </div>

        {/* Right Side Options & Progress Overview */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
              title="Toggle Outline Sidebar"
              aria-label="Toggle outline sidebar"
            >
              {showRightSidebar ? <PanelRightClose className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3 bg-surface-secondary px-3 py-1.5 rounded-lg border border-border">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-text-secondary uppercase">Your Progress</span>
              <span className="text-xs font-bold text-text-primary">{completionPercentage}%</span>
            </div>
            <div className="w-16 h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${completionPercentage}%` }} />
            </div>
          </div>

          {/* User profile avatar */}
          <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-border overflow-hidden select-none cursor-pointer">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Frame Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Column 1: Left Navigation Tree */}
        {showLeftSidebar && (
          <aside className="w-[280px] border-r border-border bg-sidebar flex flex-col shrink-0 select-none">
            
            {/* Header Link */}
            <div className="p-4 border-b border-border flex flex-col gap-3">
              <button onClick={onBack} className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back to all books
              </button>
              
              <div className="flex items-center gap-3 pt-1">
                <div className="w-11 h-9 rounded bg-[#2A1F45] flex items-center justify-center border border-border/10 overflow-hidden select-none">
                  <svg className="w-full h-full p-1" viewBox="0 0 100 70" fill="none">
                    <rect x="10" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
                    <rect x="42" y="10" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
                    <rect x="42" y="40" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
                    <rect x="74" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
                    <path d="M26 33 H42" stroke="#A855F7" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M58 18 H74" stroke="#A855F7" strokeWidth="2" />
                    <circle cx="18" cy="33" r="3" fill="#E9D5FF" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-xs font-bold text-text-primary truncate">Workflow Engine</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-text-secondary font-medium">by Rohith</span>
                    <span className="inline-block bg-[#EFF6FF] text-primary text-[8px] font-bold px-1 rounded">In Progress</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary select-none">
                  <span>{completedStepsCount} of {totalStepsCount} completed</span>
                  <span>{completionPercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${completionPercentage}%` }} />
                </div>
              </div>
            </div>

            {/* Inline Filter Search */}
            <div className="p-3 border-b border-border-light shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-text-muted" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter steps..."
                  className="w-full h-8 pl-8 pr-3 border border-border bg-surface rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Nested Navigation Content List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              {filteredPhases.map((phase) => (
                <div key={phase.id} className="space-y-1.5">
                  <div className="flex items-center justify-between px-2 text-[11px] font-bold text-text-primary uppercase tracking-wider select-none">
                    <span>{phase.title}</span>
                    <span className="text-[9px] text-text-secondary font-semibold">
                      {phase.steps.filter((s) => s.isCompleted).length}/{phase.steps.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {phase.steps.map((step) => {
                      const isActive = step.id === activeStepId;
                      return (
                        <button
                          key={step.id}
                          onClick={() => setActiveStepId(step.id)}
                          className={`w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary-light text-primary border border-primary/20 shadow-xs"
                              : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-primary" : step.isCompleted ? "bg-success" : "bg-text-muted"}`} />
                            <span className="truncate">{step.title}</span>
                          </div>
                          {step.isCompleted && <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Floating Attachments Link */}
            <div className="p-3 border-t border-border bg-surface shrink-0">
              <button className="w-full flex items-center justify-between p-2 hover:bg-surface-secondary border border-border rounded-xl text-xs font-semibold text-text-primary cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span>Attachments</span>
                </div>
                <span className="bg-surface-secondary text-text-secondary px-1.5 py-0.5 rounded text-[10px] font-bold">4</span>
              </button>
            </div>

          </aside>
        )}

        {/* Column 2: Center Content Reader */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface flex flex-col">
          {activeStep ? (
            <div className="flex-1 max-w-3xl w-full mx-auto px-8 py-10 flex flex-col space-y-6">
              
              {/* Badges / Header details */}
              <div className="space-y-2 select-none">
                <span className="inline-block bg-[#EFF6FF] text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {activeStep.title.split("-")[0].trim() || "Step"}
                </span>
                <h1 className="text-3xl font-extrabold text-text-primary font-heading tracking-tight select-text">
                  {activeStep.title.includes("-") ? activeStep.title.split("-").slice(1).join("-").trim() : activeStep.title}
                </h1>
                <p className="text-text-secondary text-sm font-medium leading-relaxed select-text">
                  {activeStep.description}
                </p>
              </div>

              {/* Callout box checklist details */}
              <div className="bg-[#EFF6FF] border-l-4 border-primary p-5 rounded-r-xl select-none">
                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>What you'll learn</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-text-secondary font-medium">Initialize Express application</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-text-secondary font-medium">Create a basic server</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-text-secondary font-medium">Understand middleware</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-text-secondary font-medium">Start the server</span>
                  </div>
                </div>
              </div>

              {/* Documentation Body Content */}
              <div className="space-y-4">
                <ErrorBoundary>
                  <MarkdownRenderer markdown={activeStep.markdown} />
                </ErrorBoundary>
              </div>

              {/* Navigation Actions Footer row */}
              <div className="flex items-center justify-between border-t border-border-light pt-8 mt-12 gap-4 shrink-0 select-none">
                {prevStep ? (
                  <button
                    onClick={() => setActiveStepId(prevStep.id)}
                    className="flex-1 max-w-[200px] border border-border hover:bg-surface-secondary rounded-xl p-3 flex items-start gap-3 text-left transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-text-muted font-bold uppercase">Previous</span>
                      <span className="text-xs font-bold text-text-primary truncate">{prevStep.title}</span>
                    </div>
                  </button>
                ) : (
                  <div className="flex-1 max-w-[200px]" />
                )}

                <button
                  onClick={() => handleToggleCompletion(activeStep.id)}
                  className={`px-5 py-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all shadow-xs ${
                    activeStep.isCompleted
                      ? "bg-surface border-border hover:bg-surface-secondary text-text-secondary"
                      : "bg-success border-success hover:bg-success/90 text-white"
                  }`}
                >
                  {activeStep.isCompleted ? "Mark as Uncomplete" : "Mark as Complete"}
                </button>

                {nextStep ? (
                  <button
                    onClick={() => setActiveStepId(nextStep.id)}
                    className="flex-1 max-w-[200px] bg-[#111827] hover:bg-black text-white rounded-xl p-3 flex items-start justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-white/50 font-bold uppercase">Next</span>
                      <span className="text-xs font-bold text-white truncate">{nextStep.title}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white shrink-0 mt-0.5" />
                  </button>
                ) : (
                  <div className="flex-1 max-w-[200px]" />
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 select-none">
              <BookOpen className="w-12 h-12 text-text-muted mb-3" />
              <h2 className="font-heading text-lg font-bold text-text-primary">No step active</h2>
            </div>
          )}
        </main>

        {/* Column 3: Right Panel Inspector widgets */}
        {showRightSidebar && (
          <aside className="w-[300px] border-l border-border bg-sidebar flex flex-col shrink-0 p-4 space-y-5 overflow-y-auto custom-scrollbar select-none">
            
            {/* TOC Widget */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-xs">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">On this page</span>
              <div className="space-y-2">
                <button className="w-full text-left text-xs font-semibold text-success hover:text-success/90 cursor-pointer block truncate pl-2 border-l-2 border-success">
                  1. Initialize Express Application
                </button>
                <button className="w-full text-left text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer block truncate pl-2 border-l-2 border-transparent">
                  2. Start the Server
                </button>
                <button className="w-full text-left text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer block truncate pl-2 border-l-2 border-transparent">
                  3. Test the Server
                </button>
                <button className="w-full text-left text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer block truncate pl-2 border-l-2 border-transparent">
                  4. Project Structure
                </button>
                <button className="w-full text-left text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer block truncate pl-2 border-l-2 border-transparent">
                  5. Next Step
                </button>
              </div>
            </div>

            {/* Attachments Download widget */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Attachments</span>
                <span className="bg-surface-secondary text-text-secondary text-[10px] px-1.5 py-0.5 rounded-full font-bold">{assets.length}</span>
              </div>
              <div className="space-y-2">
                {assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-2 bg-surface-secondary border border-border-light rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-text-primary truncate">{asset.name}</span>
                        <span className="text-[9px] text-text-muted font-medium">{asset.size}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const blob = new Blob([`Simulated content for ${asset.name}`], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = asset.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-1 rounded text-text-secondary hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="w-full flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-surface-secondary rounded-lg text-[11px] font-bold text-text-secondary cursor-pointer transition-colors">
                <span>View all attachments</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Progress Widget status */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-xs">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">Your Progress</span>
              {activeStep?.isCompleted ? (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-text-secondary block">You've completed this step!</span>
                  <button
                    onClick={() => handleToggleCompletion(activeStepId)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-success hover:bg-success/90 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4 stroke-[3]" /> Mark as Uncomplete
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-text-secondary block">This step is still in progress.</span>
                  <button
                    onClick={() => handleToggleCompletion(activeStepId)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-surface-secondary text-text-secondary rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Mark as Complete
                  </button>
                </div>
              )}
            </div>

            {/* Next Step Widget Banner */}
            {nextStep && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-xs">
                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">Next Step</span>
                <button
                  onClick={() => setActiveStepId(nextStep.id)}
                  className="w-full flex items-center justify-between p-3 border border-border hover:border-primary/30 rounded-xl text-left cursor-pointer transition-all hover:shadow-xs group"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] text-text-muted font-bold uppercase">{nextStep.title.split("-")[0].trim() || "Step"}</span>
                    <span className="text-xs font-bold text-text-primary truncate mt-0.5 group-hover:text-primary transition-colors">{nextStep.title.split("-").slice(1).join("-").trim() || nextStep.title}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-secondary shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            )}

          </aside>
        )}

      </div>

      {/* Command Search Overlay Modal */}
      {showSearchModal && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 p-4 select-none animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-xl rounded-xl shadow-md overflow-hidden flex flex-col">
            
            <div className="flex items-center gap-2 px-4 border-b border-border h-12">
              <Search className="w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Search steps or jump to section..."
                className="flex-1 focus:outline-none text-xs font-semibold text-text-primary bg-transparent"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-[10px] font-semibold border border-border bg-surface-secondary text-text-secondary px-1.5 py-0.5 rounded cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block px-2.5 py-1">Steps List</span>
              {modalFilteredSteps.map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setActiveStepId(st.id);
                    setShowSearchModal(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer text-xs font-medium text-text-primary text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-text-secondary shrink-0" />
                    <span className="truncate">{st.title}</span>
                  </div>
                  <span className="text-[9px] text-text-muted font-mono">Jump</span>
                </button>
              ))}
              {modalFilteredSteps.length === 0 && (
                <div className="text-center py-6 text-xs text-text-muted">No steps found.</div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
