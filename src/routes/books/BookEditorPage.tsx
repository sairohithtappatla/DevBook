import { useState, useEffect, useRef } from "react";
import { MarkdownRenderer } from "@/lib/markdown-renderer";
import { parseMarkdown } from "@/lib/markdown-parser";
import { useToast } from "@/providers/ToastProvider";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { MDXEditorComponent } from "@/components/editor/MDXEditorComponent";
import {
  useBook,
  useBookStructure,
  useUpdateBook,
  useCreatePhase,
  useUpdatePhase,
  useCreateStep,
  useUpdateStep
} from "@/hooks/useBooks";
import {
  Menu,
  PanelLeftClose,
  PanelRightClose,
  ChevronLeft,
  Plus,
  ChevronDown,
  Pencil,
  Eye,
  FolderOpen,
  Settings,
  BookOpen,
  FileCode,
  CheckCircle,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Bold,
  Italic,
  Code as CodeIcon,
  List as ListIcon,
  ListOrdered,
  ListTodo,
  Quote,
  Trash2,
  Globe,
  Search,
  Upload,
  FileUp} from "lucide-react";

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
  type: string;
  size: string;
  uploadedAt: string;
};

type BookMeta = {
  title: string;
  description: string;
  visibility: "Public" | "Followers" | "Selected" | "Private";
  coverType: string;
};

type Props = {
  bookId: string;
  onBack: () => void;
};

export function BookEditorPage({ bookId, onBack }: Props) {
  const { showToast } = useToast();
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setShowLeftSidebar(false);
      setShowRightSidebar(false);
    }
  }, []);

  // State for sidebar tabs: content, assets, book
  const [sidebarTab, setSidebarTab] = useState<"content" | "assets" | "book">("content");
  
  // State for active step selection
  const [activeStepId, setActiveStepId] = useState("step-1-2");
  
  // Center workspace mode: edit (split), preview (full-preview), editOnly
  const [editorMode, setEditorMode] = useState<"split" | "preview" | "edit-only">("split");
  const [activeCenterTab, setActiveCenterTab] = useState<"edit" | "preview" | "analytics">("edit");
  const [isRichEditor, setIsRichEditor] = useState(false);
  
  // Right inspector tabs
  const [inspectorTab, setInspectorTab] = useState<"step" | "options">("step");
  
  // Save State
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  
  // Command Bar Modal state
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  
  // Assets state
  const [assets, setAssets] = useState<Asset[]>([
    { id: "1", name: "express-server-sample.zip", type: "archive", size: "124 KB", uploadedAt: "2 hours ago" },
    { id: "2", name: "database-schema-v1.png", type: "image", size: "2.4 MB", uploadedAt: "1 day ago" },
    { id: "3", name: "auth-config.json", type: "json", size: "4 KB", uploadedAt: "3 days ago" }
  ]);
  
  const { data: dbBook } = useBook(bookId);
  const { data: dbBookStructure = [] } = useBookStructure(bookId);

  const updateBookMutation = useUpdateBook();
  const createPhaseMutation = useCreatePhase();
  const updatePhaseMutation = useUpdatePhase();
  const createStepMutation = useCreateStep();
  const updateStepMutation = useUpdateStep();

  // Book Meta State
  const [bookMeta, setBookMeta] = useState<BookMeta>({
    title: "",
    description: "",
    visibility: "Public",
    coverType: "workflow"
  });

  // Phases and steps structure
  const [phases, setPhases] = useState<Phase[]>([]);

  useEffect(() => {
    if (dbBook) {
      setBookMeta({
        title: dbBook.title,
        description: dbBook.description || "",
        visibility: dbBook.access_level === "PUBLIC" ? "Public" : dbBook.access_level === "PRIVATE" ? "Private" : "Followers",
        coverType: (dbBook.cover_url || "workflow") as any
      });
    }
  }, [dbBook]);

  useEffect(() => {
    if (dbBookStructure && dbBookStructure.length > 0) {
      setPhases(dbBookStructure as any);
      const firstStepId = dbBookStructure[0]?.steps?.[0]?.id;
      if (firstStepId) {
        setActiveStepId(firstStepId);
      }
    }
  }, [dbBookStructure]);

  // Find currently active step
  let activeStep: Step | undefined;
  let activePhaseId = "";
  for (const phase of phases) {
    const found = phase.steps.find((s) => s.id === activeStepId);
    if (found) {
      activeStep = found;
      activePhaseId = phase.id;
      break;
    }
  }

  // Ref to handle save debouncing
  const saveTimeoutRef = useRef<any>(null);

  const syncDatabase = async (currentPhases: Phase[], currentMeta: BookMeta) => {
    try {
      await updateBookMutation.mutateAsync({
        bookId,
        updates: {
          title: currentMeta.title,
          description: currentMeta.description,
          cover_url: currentMeta.coverType,
          difficulty: dbBook?.difficulty || "BEGINNER",
          access_level: currentMeta.visibility === "Public" ? "PUBLIC" : currentMeta.visibility === "Private" ? "PRIVATE" : "FOLLOWERS"
        }
      });

      for (let pIdx = 0; pIdx < currentPhases.length; pIdx++) {
        const p = currentPhases[pIdx];
        let dbPhaseId = p.id;
        if (p.id.startsWith("phase-")) {
          const created = await createPhaseMutation.mutateAsync({
            book_id: bookId,
            title: p.title,
            position: pIdx + 1
          });
          dbPhaseId = created.id;
          setPhases(prev => prev.map(pItem => pItem.id === p.id ? { ...pItem, id: dbPhaseId } : pItem));
        } else {
          await updatePhaseMutation.mutateAsync({
            phaseId: p.id,
            bookId,
            updates: { title: p.title, position: pIdx + 1 }
          });
        }

        for (let sIdx = 0; sIdx < p.steps.length; sIdx++) {
          const s = p.steps[sIdx];
          const stepContent = {
            slug: s.slug || s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            markdown: s.markdown,
            description: s.description || "",
            status: s.status,
            difficulty: s.difficulty,
            estimatedTime: s.estimatedTime,
            visibility: s.visibility
          };

          if (s.id.startsWith("step-")) {
            const created = await createStepMutation.mutateAsync({
              phase_id: dbPhaseId,
              title: s.title,
              position: sIdx + 1,
              content: stepContent
            });
            setPhases(prev => prev.map(pItem => {
              if (pItem.id === dbPhaseId) {
                return {
                  ...pItem,
                  steps: pItem.steps.map(sItem => sItem.id === s.id ? { ...sItem, id: created.id } : sItem)
                };
              }
              return pItem;
            }));
            if (activeStepId === s.id) {
              setActiveStepId(created.id);
            }
          } else {
            await updateStepMutation.mutateAsync({
              stepId: s.id,
              phaseId: dbPhaseId,
              updates: {
                title: s.title,
                position: sIdx + 1,
                content: stepContent
              }
            });
          }
        }
      }
    } catch (err) {
      console.error("Autosave failed:", err);
      showToast("Error saving changes", "error");
    }
  };

  const triggerAutoSave = (updatedPhases?: Phase[], updatedMeta?: BookMeta) => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await syncDatabase(updatedPhases || phases, updatedMeta || bookMeta);
      setSaveStatus("saved");
      showToast("Changes saved automatically", "success");
    }, 1500);
  };

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandBar((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update a step's markdown content
  const handleMarkdownChange = (newText: string) => {
    if (!activeStep) return;
    setSaveStatus("unsaved");
    const nextPhases = phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((s) => (s.id === activeStepId ? { ...s, markdown: newText } : s))
    }));
    setPhases(nextPhases);
    triggerAutoSave(nextPhases);
  };

  // Update a step's metadata properties
  const handlePropertyChange = <K extends keyof Step>(field: K, value: Step[K]) => {
    if (!activeStep) return;
    setSaveStatus("unsaved");
    const nextPhases = phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((s) => (s.id === activeStepId ? { ...s, [field]: value } : s))
    }));
    setPhases(nextPhases);
    triggerAutoSave(nextPhases);
  };

  // Switch steps and trigger save
  const handleSelectStep = (stepId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      setSaveStatus("saved");
    }
    setActiveStepId(stepId);
  };

  // Add new step to active or first phase
  const handleAddStep = (phaseId: string) => {
    const newStepId = `step-${Date.now()}`;
    const newStep: Step = {
      id: newStepId,
      title: "Untitled Step",
      slug: "untitled-step",
      markdown: "# Untitled Step\n\nStart writing documentation here...",
      description: "",
      status: "Draft",
      estimatedTime: 10,
      difficulty: "Beginner",
      visibility: "Public"
    };

    setPhases((prev) =>
      prev.map((p) => {
        if (p.id === phaseId) {
          return { ...p, steps: [...p.steps, newStep] };
        }
        return p;
      })
    );
    setActiveStepId(newStepId);
    showToast("Step created successfully", "success");
  };

  // Add new phase
  const handleAddPhase = () => {
    const newPhaseId = `phase-${Date.now()}`;
    const newPhase: Phase = {
      id: newPhaseId,
      title: `Phase ${phases.length} - New Phase`,
      steps: []
    };
    setPhases((prev) => [...prev, newPhase]);
    showToast("Phase created successfully", "success");
  };

  // Delete current active step
  const handleDeleteActiveStep = () => {
    if (!activeStep) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${activeStep.title}"?`);
    if (!confirmDelete) return;

    setPhases((prev) =>
      prev.map((p) => ({
        ...p,
        steps: p.steps.filter((s) => s.id !== activeStepId)
      }))
    );

    // Auto-select another step if possible
    let nextSelected = "";
    for (const p of phases) {
      const remaining = p.steps.filter((s) => s.id !== activeStepId);
      if (remaining.length > 0) {
        nextSelected = remaining[0].id;
        break;
      }
    }
    setActiveStepId(nextSelected);
    showToast("Step deleted", "info");
  };

  const movePhase = (phaseId: string, direction: "up" | "down") => {
    const idx = phases.findIndex((p) => p.id === phaseId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= phases.length) return;

    const updated = [...phases];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setPhases(updated);
    showToast("Phase reordered", "success");
  };

  const moveStep = (phaseId: string, stepId: string, direction: "up" | "down") => {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id !== phaseId) return p;
        const idx = p.steps.findIndex((s) => s.id === stepId);
        if (idx === -1) return p;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= p.steps.length) return p;

        const updatedSteps = [...p.steps];
        const temp = updatedSteps[idx];
        updatedSteps[idx] = updatedSteps[targetIdx];
        updatedSteps[targetIdx] = temp;

        return { ...p, steps: updatedSteps };
      })
    );
    showToast("Step reordered", "success");
  };

  const handleStepDrop = (e: React.DragEvent, targetPhaseId: string) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.type === "step") {
        const { stepId, sourcePhaseId } = data;
        if (sourcePhaseId === targetPhaseId) return;

        let movedStep: Step | null = null;
        setPhases((prev) => {
          const cleaned = prev.map((p) => {
            if (p.id === sourcePhaseId) {
              movedStep = p.steps.find((s) => s.id === stepId) || null;
              return { ...p, steps: p.steps.filter((s) => s.id !== stepId) };
            }
            return p;
          });

          if (!movedStep) return prev;

          return cleaned.map((p) => {
            if (p.id === targetPhaseId) {
              return { ...p, steps: [...p.steps, movedStep!] };
            }
            return p;
          });
        });
        showToast("Step moved to new phase", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderContentSidebar = () => {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-4 flex items-center justify-between border-b border-border-light">
          <div className="relative">
            <button
              onClick={() => handleAddStep(activePhaseId || "phase-0")}
              className="flex items-center gap-1 bg-[#111827] hover:bg-black text-white px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add New
            </button>
          </div>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".md";
              input.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const content = evt.target?.result as string;
                    if (content) {
                      const parsed = parseMarkdown(content);
                      setBookMeta({
                        title: parsed.title,
                        description: `Imported book structure for ${parsed.title}`,
                        visibility: "Public",
                        coverType: "workflow"
                      });

                      const parsedPhases = parsed.phases.map((p) => ({
                        id: p.id,
                        title: p.title,
                        steps: p.steps.map((s) => ({
                          id: s.id,
                          title: s.title,
                          slug: s.slug,
                          markdown: s.markdown,
                          description: s.description,
                          status: s.status,
                          estimatedTime: s.estimatedTime,
                          difficulty: s.difficulty,
                          visibility: s.visibility,
                          isCompleted: s.isCompleted
                        }))
                      }));

                      if (parsedPhases.length > 0) {
                        setPhases(parsedPhases);
                        const firstStepId = parsedPhases[0].steps[0]?.id || "";
                        if (firstStepId) setActiveStepId(firstStepId);
                        showToast(`Successfully imported: ${parsed.title}`, "success");
                      } else {
                        showToast("No phases found in markdown file", "error");
                      }
                    }
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
            title="Import Markdown (.md)"
            className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          {phases.map((phase) => (
            <div
              key={phase.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleStepDrop(e, phase.id)}
              className="space-y-1.5 p-2 rounded-xl border border-transparent hover:border-border-light hover:bg-surface-secondary/20 transition-all"
            >
              <div className="flex items-center justify-between px-2 text-[12px] font-bold text-text-primary uppercase tracking-wider select-none group">
                <span>{phase.title}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => movePhase(phase.id, "up")}
                    className="opacity-0 group-hover:opacity-100 hover:text-primary text-text-muted transition-all cursor-pointer text-[10px]"
                    title="Move Phase Up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => movePhase(phase.id, "down")}
                    className="opacity-0 group-hover:opacity-100 hover:text-primary text-text-muted transition-all cursor-pointer text-[10px]"
                    title="Move Phase Down"
                  >
                    ▼
                  </button>
                  <span className="text-[10px] text-text-muted font-normal">{phase.steps.length} steps</span>
                </div>
              </div>
              <div className="space-y-1">
                {phase.steps.map((step) => {
                  const isActive = step.id === activeStepId;
                  return (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "step", stepId: step.id, sourcePhaseId: phase.id }));
                      }}
                      className="group/step relative"
                    >
                      <button
                        onClick={() => handleSelectStep(step.id)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? "bg-primary-light text-primary border border-primary/20 shadow-xs"
                            : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-primary" : step.isCompleted ? "bg-success" : "bg-text-muted"}`} />
                          <span className="truncate">{step.title}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveStep(phase.id, step.id, "up"); }}
                            className="opacity-0 group-hover/step:opacity-100 hover:text-primary text-text-muted transition-all text-[9px] px-0.5"
                            title="Move Step Up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveStep(phase.id, step.id, "down"); }}
                            className="opacity-0 group-hover/step:opacity-100 hover:text-primary text-text-muted transition-all text-[9px] px-0.5"
                            title="Move Step Down"
                          >
                            ▼
                          </button>
                          {step.isCompleted && <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => handleAddStep(phase.id)}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 border border-dashed border-border hover:border-text-muted rounded-lg text-[10px] font-semibold text-text-muted hover:text-text-secondary cursor-pointer transition-all mt-1"
              >
                <Plus className="w-3 h-3" /> Add Step
              </button>
            </div>
          ))}

          <button
            onClick={handleAddPhase}
            className="w-full flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-surface-secondary rounded-xl text-xs font-semibold text-text-secondary cursor-pointer transition-all mt-4"
          >
            <Plus className="w-4 h-4" /> Add New Phase
          </button>
        </div>
      </div>
    );
  };

  const renderAssetsSidebar = () => {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4 space-y-4">
        <div
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.onchange = (e: any) => {
              const file = e.target.files?.[0];
              if (file) {
                const newAsset: Asset = {
                  id: `asset-${Date.now()}`,
                  name: file.name,
                  type: file.type || "file",
                  size: `${(file.size / 1024).toFixed(1)} KB`,
                  uploadedAt: "Just now"
                };
                setAssets((prev) => [...prev, newAsset]);
              }
            };
            input.click();
          }}
          className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center bg-surface-secondary hover:bg-surface transition-all cursor-pointer"
        >
          <FileUp className="w-8 h-8 text-text-muted mb-2" />
          <span className="text-xs font-semibold text-text-primary">Upload new asset</span>
          <span className="text-[10px] text-text-muted mt-1">PDF, ZIP, JSON, Images</span>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider select-none px-1">Book Assets</span>
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-2.5 bg-surface border border-border rounded-xl shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-text-primary truncate">{asset.name}</span>
                  <span className="text-[10px] text-text-muted">{asset.size} • {asset.uploadedAt}</span>
                </div>
              </div>
              <button
                onClick={() => setAssets(assets.filter((a) => a.id !== asset.id))}
                className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBookSidebar = () => {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider select-none px-1">Book Info</span>
        
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-text-secondary">Cover Thumbnail Type</label>
          <select
            value={bookMeta.coverType}
            onChange={(e) => setBookMeta({ ...bookMeta, coverType: e.target.value })}
            className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface cursor-pointer"
          >
            <option value="workflow">Workflow Engine Design</option>
            <option value="auth">Shield Authentication</option>
            <option value="ecommerce">Shopping Cart E-commerce</option>
            <option value="aws">AWS Cloud Scale</option>
            <option value="python">FastAPI Python Master</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-text-secondary">Book Title</label>
          <input
            type="text"
            value={bookMeta.title}
            onChange={(e) => setBookMeta({ ...bookMeta, title: e.target.value })}
            className="w-full h-9 border border-border rounded-lg px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-text-secondary">Description</label>
          <textarea
            value={bookMeta.description}
            onChange={(e) => setBookMeta({ ...bookMeta, description: e.target.value })}
            rows={4}
            className="w-full border border-border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface resize-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-text-secondary">Book Visibility</label>
          <select
            value={bookMeta.visibility}
            onChange={(e) => setBookMeta({ ...bookMeta, visibility: e.target.value as any })}
            className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface cursor-pointer"
          >
            <option value="Public">Public (Anyone can view)</option>
            <option value="Followers">Followers Only</option>
            <option value="Selected">Selected Followers</option>
            <option value="Private">Private (Draft)</option>
          </select>
        </div>
      </div>
    );
  };

  const allStepsList: { id: string; title: string }[] = [];
  phases.forEach((p) => p.steps.forEach((s) => allStepsList.push({ id: s.id, title: s.title })));

  const filteredCommands = [
    { name: "Jump to Step...", icon: BookOpen, action: () => {} },
    { name: "Create Step", icon: Plus, action: () => handleAddStep(activePhaseId || "phase-0") },
    { name: "Create Phase", icon: Plus, action: handleAddPhase },
    { name: "Rename Selected Step", icon: Pencil, action: () => {} },
    { name: "Delete Step", icon: Trash2, action: handleDeleteActiveStep },
    { name: "Upload Asset", icon: Upload, action: () => setSidebarTab("assets") },
    { name: "Return to Dashboard", icon: ChevronLeft, action: onBack }
  ].filter((c) => c.name.toLowerCase().includes(commandSearch.toLowerCase()));

  return (
    <div className="flex flex-col w-screen h-screen relative overflow-hidden bg-surface">
      
      {/* Top Context Bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface shrink-0 z-10 select-none">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer mr-1 flex items-center justify-center animate-pulse-slow"
            title="Toggle File Sidebar"
            aria-label="Toggle file sidebar"
          >
            {showLeftSidebar ? <PanelLeftClose className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button onClick={onBack} className="text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer">
            My Books
          </button>
          <span className="text-text-muted">&gt;</span>
          <span className="text-text-secondary">{bookMeta.title}</span>
          {activeStep && (
            <>
              <span className="text-text-muted">&gt;</span>
              <span className="text-text-primary font-bold">{activeStep.title}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {saveStatus === "saving" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping" />
                <span className="text-[11px] font-medium text-text-secondary">Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-success" />
                <span className="text-[11px] font-medium text-success">All changes saved</span>
              </>
            )}
          </div>

          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="p-1.5 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
            title="Toggle Settings Inspector"
            aria-label="Toggle settings inspector"
          >
            {showRightSidebar ? <PanelRightClose className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <button className="flex items-center gap-1 border border-border px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-surface-secondary transition-colors cursor-pointer">
            <Eye className="w-3.5 h-3.5" /> Preview Book
          </button>

          <div className="inline-flex rounded-lg overflow-hidden bg-primary text-white shadow-xs hover:bg-primary-hover h-8">
            <button className="px-3 text-xs font-semibold border-r border-white/10 h-full flex items-center justify-center cursor-pointer">
              Publish Book
            </button>
            <button className="px-2 flex items-center justify-center h-full cursor-pointer">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* Column 1: Left Sidebar */}
        {showLeftSidebar && (
          <aside className="w-[280px] border-r border-border bg-sidebar flex flex-col shrink-0 select-none">
            <div className="p-4 border-b border-border flex items-center gap-3">
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
                <h2 className="text-xs font-bold text-text-primary truncate">{bookMeta.title}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block bg-[#DCFCE7] text-[#16A34A] text-[9px] font-bold px-1 rounded">Published</span>
                  <span className="text-[10px] text-text-muted">24 steps</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-border-light text-center text-xs font-semibold shrink-0">
              <button
                onClick={() => setSidebarTab("content")}
                className={`py-2 cursor-pointer border-b-[2px] ${sidebarTab === "content" ? "text-primary border-primary font-bold" : "text-text-secondary border-transparent hover:text-text-primary"}`}
              >
                Content
              </button>
              <button
                onClick={() => setSidebarTab("assets")}
                className={`py-2 cursor-pointer border-b-[2px] ${sidebarTab === "assets" ? "text-primary border-primary font-bold" : "text-text-secondary border-transparent hover:text-text-primary"}`}
              >
                Assets
              </button>
              <button
                onClick={() => setSidebarTab("book")}
                className={`py-2 cursor-pointer border-b-[2px] ${sidebarTab === "book" ? "text-primary border-primary font-bold" : "text-text-secondary border-transparent hover:text-text-primary"}`}
              >
                Book
              </button>
            </div>

            {sidebarTab === "content" && renderContentSidebar()}
            {sidebarTab === "assets" && renderAssetsSidebar()}
            {sidebarTab === "book" && renderBookSidebar()}
          </aside>
        )}

        {/* Column 2: Center Editor Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-surface">
          {activeStep ? (
            <>
              <div className="h-14 px-6 border-b border-border-light flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-text-primary font-heading">
                    {activeStep.title}
                  </h1>
                  <button className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <div className="inline-flex border border-border rounded-lg p-0.5 bg-surface-secondary text-[11px] font-semibold">
                    <button
                      onClick={() => { setActiveCenterTab("edit"); setEditorMode("split"); }}
                      className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${activeCenterTab === "edit" && editorMode === "split" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"}`}
                    >
                      Split View
                    </button>
                    <button
                      onClick={() => { setActiveCenterTab("edit"); setEditorMode("edit-only"); }}
                      className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${activeCenterTab === "edit" && editorMode === "edit-only" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"}`}
                    >
                      Edit Mode
                    </button>
                    <button
                      onClick={() => setActiveCenterTab("preview")}
                      className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${activeCenterTab === "preview" ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"}`}
                    >
                      Full Preview
                    </button>
                  </div>
                </div>
              </div>

              {activeCenterTab === "edit" ? (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  
                  {/* Left Markdown Editor */}
                  <div className={`flex flex-col border-r border-border-light min-h-0 ${editorMode === "edit-only" ? "w-full" : "w-1/2"}`}>
                    {isRichEditor ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        {/* Rich editor toolbar toggle */}
                        <div className="h-10 border-b border-border-light bg-surface-secondary flex items-center justify-between px-3 select-none shrink-0">
                          <span className="text-[11px] font-bold text-text-secondary uppercase">Rich Editor Workspace</span>
                          <button
                            onClick={() => setIsRichEditor(false)}
                            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            Switch to Markdown
                          </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                          <MDXEditorComponent markdown={activeStep.markdown} onChange={handleMarkdownChange} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="h-10 border-b border-border-light bg-surface-secondary flex items-center justify-between px-3 select-none shrink-0">
                          <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Bold">
                              <Bold className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Italic">
                              <Italic className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Code">
                              <CodeIcon className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Link">
                              <LinkIcon className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Image">
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="List">
                              <ListIcon className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Ordered List">
                              <ListOrdered className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Checklist">
                              <ListTodo className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Quote">
                              <Quote className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setIsRichEditor(true)}
                              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                            >
                              Rich Editor
                            </button>
                            <button className="text-[11px] font-semibold text-text-muted hover:text-text-secondary transition-colors cursor-pointer flex items-center gap-0.5">
                              <HelpCircle className="w-3 h-3" /> Guide
                            </button>
                            <span className="text-[10px] bg-border-light px-1.5 py-0.5 rounded text-text-secondary font-mono">⌘K</span>
                          </div>
                        </div>

                        <div className="flex-1 flex min-h-0 font-mono text-[13px] overflow-hidden">
                          <div className="w-12 bg-surface-secondary border-r border-border-light py-4 text-right pr-3 select-none text-text-muted space-y-1 text-[11px] leading-relaxed">
                            {Array.from({ length: activeStep.markdown.split("\n").length + 2 }).map((_, i) => (
                              <div key={i}>{i + 1}</div>
                            ))}
                          </div>
                          <textarea
                            value={activeStep.markdown}
                            onChange={(e) => handleMarkdownChange(e.target.value)}
                            className="flex-1 h-full p-4 resize-none focus:outline-none bg-surface text-text-primary leading-relaxed custom-scrollbar overflow-y-auto font-mono text-[13px]"
                            placeholder="Write documentation in Markdown..."
                          />
                        </div>

                        <div className="h-7 border-t border-border-light bg-surface-secondary flex items-center justify-between px-4 select-none shrink-0 text-[10px] text-text-secondary font-medium">
                          <span>Lines {activeStep.markdown.split("\n").length}  Words {activeStep.markdown.split(/\s+/).filter(Boolean).length}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            <span>Markdown Mode</span>
                          </div>
                        </div>
                      </>
                    )}

                  </div>

                  {/* Right Live Preview */}
                  {editorMode === "split" && (
                    <div className="w-1/2 flex flex-col min-h-0 bg-surface">
                      <div className="h-10 border-b border-border-light flex items-center px-4 select-none shrink-0">
                        <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Live Preview</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 select-text">
                        <ErrorBoundary>
                          <MarkdownRenderer markdown={activeStep.markdown} />
                        </ErrorBoundary>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-w-4xl mx-auto space-y-5">
                  <ErrorBoundary>
                    <MarkdownRenderer markdown={activeStep.markdown} />
                  </ErrorBoundary>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <BookOpen className="w-12 h-12 text-text-muted mb-3" />
              <h2 className="font-heading text-lg font-bold text-text-primary">No step selected</h2>
              <p className="text-xs text-text-secondary mt-1">Select a step from the sidebar content tree or add a new one.</p>
              <button
                onClick={() => handleAddStep("phase-0")}
                className="mt-4 flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Step
              </button>
            </div>
          )}
        </main>

        {/* Column 3: Right Inspector Panel */}
        {showRightSidebar && (
          <aside className="w-[300px] border-l border-border bg-sidebar flex flex-col shrink-0 select-none">
            {activeStep ? (
              <>
                <div className="grid grid-cols-2 border-b border-border text-center text-xs font-semibold shrink-0">
                  <button
                    onClick={() => setInspectorTab("step")}
                    className={`py-3.5 cursor-pointer border-b-[2px] ${inspectorTab === "step" ? "text-primary border-primary font-bold" : "text-text-secondary border-transparent hover:text-text-primary"}`}
                  >
                    Step Info
                  </button>
                  <button
                    onClick={() => setInspectorTab("options")}
                    className={`py-3.5 cursor-pointer border-b-[2px] ${inspectorTab === "options" ? "text-primary border-primary font-bold" : "text-text-secondary border-transparent hover:text-text-primary"}`}
                  >
                    Options
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {inspectorTab === "step" ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Step Title</label>
                        <input
                          type="text"
                          value={activeStep.title}
                          onChange={(e) => handlePropertyChange("title", e.target.value)}
                          className="w-full h-9 border border-border rounded-lg px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Slug</label>
                        <input
                          type="text"
                          value={activeStep.slug}
                          onChange={(e) => handlePropertyChange("slug", e.target.value)}
                          className="w-full h-9 border border-border rounded-lg px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                        <span className="text-[10px] text-text-muted">Used in URLs. Keep it short and descriptive.</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Parent Phase</label>
                        <select
                          value={activePhaseId}
                          onChange={(e) => {
                            const newPhaseId = e.target.value;
                            if (!activeStep) return;
                            setPhases((prev) =>
                              prev.map((p) => {
                                if (p.id === activePhaseId) {
                                  return { ...p, steps: p.steps.filter((s) => s.id !== activeStepId) };
                                }
                                if (p.id === newPhaseId) {
                                  return { ...p, steps: [...p.steps, activeStep!] };
                                }
                                return p;
                              })
                            );
                          }}
                          className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface cursor-pointer"
                        >
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-semibold text-text-secondary">Description</label>
                          <span className="text-[9px] text-text-muted">{activeStep.description.length} / 160</span>
                        </div>
                        <textarea
                          value={activeStep.description}
                          onChange={(e) => handlePropertyChange("description", e.target.value)}
                          maxLength={160}
                          rows={3}
                          className="w-full border border-border rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface resize-none"
                          placeholder="Short description of this step..."
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Status</label>
                        <select
                          value={activeStep.status}
                          onChange={(e) => handlePropertyChange("status", e.target.value as any)}
                          className="w-full h-9 border border-border rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface cursor-pointer"
                        >
                          <option value="Published">Published</option>
                          <option value="Draft">Draft</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Estimated Time (min)</label>
                        <input
                          type="number"
                          value={activeStep.estimatedTime}
                          onChange={(e) => handlePropertyChange("estimatedTime", Number(e.target.value))}
                          className="w-full h-9 border border-border rounded-lg px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Difficulty</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                          {["Beginner", "Intermediate", "Advanced"].map((level) => {
                            const isActive = activeStep?.difficulty === level;
                            return (
                              <button
                                key={level}
                                onClick={() => handlePropertyChange("difficulty", level as any)}
                                className={`py-1.5 border rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                  isActive
                                    ? "bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]/30"
                                    : "border-border hover:bg-surface-secondary text-text-secondary"
                                }`}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 pt-1">
                        <label className="text-[11px] font-semibold text-text-secondary">Visibility</label>
                        <div className="flex items-center justify-between p-2.5 bg-surface border border-border rounded-xl">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-text-primary">{activeStep.visibility}</span>
                              <span className="text-[9px] text-text-muted">Anyone can view this step</span>
                            </div>
                          </div>
                          <button className="px-2 py-1 text-[10px] font-semibold border border-border rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer">
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border mt-4">
                        <span className="text-[11px] font-bold text-danger uppercase tracking-wider block">Danger Zone</span>
                        <div className="bg-danger-light/35 border border-danger/10 rounded-xl p-3.5 flex flex-col gap-2 mt-2">
                          <span className="text-[10px] text-text-secondary font-medium">Deleting this step will permanently remove all associated markdown content and attachments.</span>
                          <button
                            onClick={handleDeleteActiveStep}
                            className="w-full flex items-center justify-center gap-1 py-2 rounded-lg bg-danger hover:bg-[#B91C1C] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Delete this step
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-text-secondary text-center py-8">
                      Options config panels.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 select-none">
                <Settings className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-xs text-text-secondary">No active configurations</span>
              </div>
            )}
          </aside>
        )}

      </div>

      {/* Command Bar Modal Popup (Ctrl+K) */}
      {showCommandBar && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 p-4 select-none animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-xl rounded-xl shadow-md overflow-hidden flex flex-col">
            
            <div className="flex items-center gap-2 px-4 border-b border-border h-12">
              <Search className="w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Search commands or jump to step..."
                className="flex-1 focus:outline-none text-xs font-semibold text-text-primary"
                autoFocus
              />
              <button
                onClick={() => setShowCommandBar(false)}
                className="text-[10px] font-semibold border border-border bg-surface-secondary text-text-secondary px-1.5 py-0.5 rounded cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block px-2.5 py-1">Quick Actions</span>
              {filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      cmd.action();
                      setShowCommandBar(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-surface-secondary transition-colors cursor-pointer text-xs font-medium text-text-primary"
                  >
                    <Icon className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>{cmd.name}</span>
                  </button>
                );
              })}
              {filteredCommands.length === 0 && (
                <div className="text-center py-6 text-xs text-text-muted">No results found.</div>
              )}
            </div>

            {allStepsList.length > 0 && (
              <div className="p-2 border-t border-border-light space-y-1 bg-surface-secondary">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block px-2.5 py-1">Steps list</span>
                <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                  {allStepsList.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        handleSelectStep(st.id);
                        setShowCommandBar(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-surface text-left transition-colors cursor-pointer text-[11px] font-semibold text-text-secondary"
                    >
                      <span>{st.title}</span>
                      <span className="text-[9px] text-text-muted font-mono">Jump</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
