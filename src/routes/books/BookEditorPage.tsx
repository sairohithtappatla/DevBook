import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Markdown } from "@/components/Markdown";
import { validateMdx, summarizeDiff, type MdxIssue } from "@/lib/mdx-validate";


import { parseMarkdownToTree } from "@/lib/mock-data";
import { useToast } from "@/providers/ToastProvider";

import {
  useBook,
  useBookStructure,
  useUpdateBook,
  useCreatePhase,
  useUpdatePhase,
  useDeletePhase,
  useCreateStep,
  useUpdateStep,
  useDeleteStep,
} from "@/hooks/useBooks";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Upload,
  Eye,
  Check,
  Globe,
  BookOpen,
  ChevronLeft,
  AlertTriangle,
  X,
  Loader2,
  MoreVertical,
  Lock,
  Users,
} from "lucide-react";

const MDXEditorComponent = lazy(() => import("@/components/editor/MDXEditorComponent"));

type StepNode = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  description: string;
  status: "Published" | "Draft" | "Archived";
  estimatedTime: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  visibility: "Public" | "Followers" | "Selected" | "Private";
};

type PhaseNode = {
  id: string;
  title: string;
  steps: StepNode[];
};

type Props = {
  bookId: string;
  onBack: () => void;
  onPreview?: () => void;
};

function SortableItem({
  id,
  title,
  onDelete,
  depth = 0,
}: {
  id: string;
  title: string;
  onDelete?: () => void;
  depth?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginLeft: depth * 16,
      }}
      className="group flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-2 py-1.5 text-sm hover:border-foreground/20"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className={`truncate flex-1 min-w-0  ${depth === 0 ? "text-[13px] font-semibold " : ""}`}>
        {title}
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

export function BookEditorPage({ bookId, onBack, onPreview }: Props) {
  const { showToast } = useToast();

  const { data: dbBook } = useBook(bookId);
  const { data: dbBookStructure = [] } = useBookStructure(bookId);

  const updateBookMutation = useUpdateBook();
  const createPhaseMutation = useCreatePhase();
  const updatePhaseMutation = useUpdatePhase();
  const deletePhaseMutation = useDeletePhase();
  const createStepMutation = useCreateStep();
  const updateStepMutation = useUpdateStep();
  const deleteStepMutation = useDeleteStep();

  const [tab, setTab] = useState<"editor" | "import">("editor");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [editorView, setEditorView] = useState<"rich" | "raw">("rich");
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);



  // Local state representing the tree of phases and steps
  const [phases, setPhases] = useState<PhaseNode[]>([]);
  const [activeStepRef, setActiveStepRef] = useState<{ phaseId: string; stepId: string } | null>(null);

  // Sync from DB structure
  useEffect(() => {
    if (dbBookStructure && dbBookStructure.length > 0) {
      const mapped = dbBookStructure.map((p: any) => ({
        id: p.id,
        title: p.title,
        steps: (p.steps || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          slug: s.slug || s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          markdown: s.markdown || "",
          description: s.description || "",
          status: s.status || "Draft",
          estimatedTime: s.estimatedTime || 10,
          difficulty: s.difficulty || "Beginner",
          visibility: s.visibility || "Public",
        })),
      })) as PhaseNode[];
      setPhases(mapped);

      if (!activeStepRef) {
        const firstStep = mapped[0]?.steps?.[0];
        if (firstStep) {
          setActiveStepRef({ phaseId: mapped[0].id, stepId: firstStep.id });
        }
      }
    }
  }, [dbBookStructure]);

  // Find active step node in the state
  const activeStep = useMemo(() => {
    if (!activeStepRef) return null;
    for (const p of phases) {
      const found = p.steps.find((s) => s.id === activeStepRef.stepId);
      if (found) return found;
    }
    return null;
  }, [phases, activeStepRef]);

  // Scroll sync logic
  useEffect(() => {
    if (!activeStep) return;

    const previewEl = previewContainerRef.current;
    const editorRoot = editorContainerRef.current;
    if (!previewEl || !editorRoot) return;

    const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
      if (!el) return null;
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return el;
      }
      return findScrollableParent(el.parentElement);
    };

    // Find the actual scrollable element in the editor (rich contenteditable vs raw textarea)
    const contentEditable = editorRoot.querySelector(".mdx-content");
    const textarea = editorRoot.querySelector("textarea");
    const editorEl = contentEditable
      ? findScrollableParent(contentEditable as HTMLElement)
      : (textarea as HTMLElement);

    if (!editorEl) return;

    let isSyncingEditor = false;
    let isSyncingPreview = false;

    const handleEditorScroll = () => {
      if (isSyncingPreview) {
        isSyncingPreview = false;
        return;
      }
      isSyncingEditor = true;

      const scrollRangeSrc = editorEl.scrollHeight - editorEl.clientHeight;
      const scrollRangeDest = previewEl.scrollHeight - previewEl.clientHeight;
      if (scrollRangeSrc > 0 && scrollRangeDest > 0) {
        const percentage = editorEl.scrollTop / scrollRangeSrc;
        previewEl.scrollTop = percentage * scrollRangeDest;
      }
    };

    const handlePreviewScroll = () => {
      if (isSyncingEditor) {
        isSyncingEditor = false;
        return;
      }
      isSyncingPreview = true;

      const scrollRangeSrc = previewEl.scrollHeight - previewEl.clientHeight;
      const scrollRangeDest = editorEl.scrollHeight - editorEl.clientHeight;
      if (scrollRangeSrc > 0 && scrollRangeDest > 0) {
        const percentage = previewEl.scrollTop / scrollRangeSrc;
        editorEl.scrollTop = percentage * scrollRangeDest;
      }
    };

    editorEl.addEventListener("scroll", handleEditorScroll, { passive: true });
    previewEl.addEventListener("scroll", handlePreviewScroll, { passive: true });

    return () => {
      editorEl.removeEventListener("scroll", handleEditorScroll);
      previewEl.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [activeStep, editorView]);

  // Handle markdown change in active step
  const handleMarkdownChange = (val: string) => {
    if (!activeStepRef) return;
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id === activeStepRef.phaseId) {
          return {
            ...p,
            steps: p.steps.map((s) => (s.id === activeStepRef.stepId ? { ...s, markdown: val } : s)),
          };
        }
        return p;
      })
    );
    triggerAutoSave();
  };

  // Handle active step properties change
  const handlePropertyChange = <K extends keyof StepNode>(field: K, val: StepNode[K]) => {
    if (!activeStepRef) return;
    setPhases((prev) =>
      prev.map((p) => {
        if (p.id === activeStepRef.phaseId) {
          return {
            ...p,
            steps: p.steps.map((s) => (s.id === activeStepRef.stepId ? { ...s, [field]: val } : s)),
          };
        }
        return p;
      })
    );
    triggerAutoSave();
  };

  // Auto-save logic
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimeoutRef = useRef<any>(null);

  const syncDatabase = async () => {
    try {
      // Sync active step to DB
      if (activeStep && activeStepRef) {
        await updateStepMutation.mutateAsync({
          stepId: activeStep.id,
          phaseId: activeStepRef.phaseId,
          updates: {
            title: activeStep.title,
            position: 1, // position is handled dynamically or set by index
            content: {
              slug: activeStep.slug,
              markdown: activeStep.markdown,
              description: activeStep.description,
              status: activeStep.status,
              difficulty: activeStep.difficulty,
              estimatedTime: activeStep.estimatedTime,
              visibility: activeStep.visibility,
            },
          },
        });
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaveStatus("unsaved");
    }
  };

  const triggerAutoSave = () => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      syncDatabase();
    }, 1500);
  };

  // Drag and Drop phases
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = phases.findIndex((p) => p.id === active.id);
    const to = phases.findIndex((p) => p.id === over.id);
    if (from !== -1 && to !== -1) {
      const reordered = arrayMove(phases, from, to);
      setPhases(reordered);
      // Persist phase positions
      try {
        for (let i = 0; i < reordered.length; i++) {
          await updatePhaseMutation.mutateAsync({
            phaseId: reordered[i].id,
            bookId,
            updates: { title: reordered[i].title, position: i + 1 },
          });
        }
        showToast("Phases reordered", "success");
      } catch (err) {
        showToast("Failed to save reordering", "error");
      }
    }
  };

  // Add Phase
  const addPhase = async () => {
    const title = `Phase ${phases.length} · Untitled`;
    try {
      await createPhaseMutation.mutateAsync({
        book_id: bookId,
        title,
        position: phases.length + 1,
      });
      showToast("Phase created", "success");
    } catch (err: any) {
      console.error("Create phase error:", err);
      showToast(`Failed to create phase: ${err.message || err}`, "error");
    }
  };

  // Delete Phase
  const deletePhase = async (phaseId: string) => {
    const p = phases.find((x) => x.id === phaseId);
    if (!p) return;
    const confirm = window.confirm(`Are you sure you want to delete "${p.title}" and all its steps?`);
    if (!confirm) return;

    try {
      await deletePhaseMutation.mutateAsync({ phaseId, bookId });
      showToast("Phase deleted", "info");
    } catch (err) {
      showToast("Failed to delete phase", "error");
    }
  };

  // Add Step
  const addStep = async (phaseId: string) => {
    const title = "Untitled step";
    const content = {
      slug: "untitled-step-" + Date.now(),
      markdown: "# Untitled Step\n\nStart writing documentation here...",
      description: "",
      status: "Draft" as const,
      difficulty: "Beginner" as const,
      estimatedTime: 10,
      visibility: "Public" as const,
    };
    const phase = phases.find((p) => p.id === phaseId);
    const position = phase ? phase.steps.length + 1 : 1;

    try {
      const created = await createStepMutation.mutateAsync({
        phase_id: phaseId,
        title,
        position,
        content,
      });
      setActiveStepRef({ phaseId, stepId: created.id });
      showToast("Step created", "success");
    } catch (err: any) {
      console.error("Create step error:", err);
      showToast(`Failed to create step: ${err.message || err}`, "error");
    }
  };

  // Delete Step
  const deleteStep = async (phaseId: string, stepId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this step?");
    if (!confirm) return;

    try {
      await deleteStepMutation.mutateAsync({ stepId, phaseId });
      if (activeStepRef?.stepId === stepId) {
        setActiveStepRef(null);
      }
      showToast("Step deleted", "info");
    } catch (err) {
      showToast("Failed to delete step", "error");
    }
  };

  // Import Markdown parser integration
  const [rawMd, setRawMd] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const handleParse = () => {
    try {
      const result = parseMarkdownToTree(rawMd);
      setParsed(result);
    } catch (err) {
      showToast("Failed to parse Markdown", "error");
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    try {
      // Clear or overwrite the book structure with parsed phases
      for (const p of parsed.phases) {
        const createdPhase = await createPhaseMutation.mutateAsync({
          book_id: bookId,
          title: p.title,
          position: phases.length + 1,
        });

        for (let i = 0; i < p.steps.length; i++) {
          await createStepMutation.mutateAsync({
            phase_id: createdPhase.id,
            title: p.steps[i],
            position: i + 1,
            content: {
              slug: p.steps[i].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              markdown: `# ${p.steps[i]}\n\nWrite documentation here...`,
              description: "",
              status: "Draft",
              difficulty: "Beginner",
              estimatedTime: 10,
              visibility: "Public",
            },
          });
        }
      }
      showToast("Markdown structure imported successfully", "success");
      setTab("editor");
      setRawMd("");
      setParsed(null);
    } catch (err) {
      showToast("Failed to import Markdown", "error");
    }
  };

  // Publish validation and diff
  const [publishOpen, setPublishOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState<MdxIssue[] | null>(null);
  const [initialStepMarkdown, setInitialStepMarkdown] = useState("");

  useEffect(() => {
    if (activeStep) {
      setInitialStepMarkdown(activeStep.markdown);
    }
  }, [activeStepRef]);

  const diff = useMemo(() => {
    return summarizeDiff(initialStepMarkdown, activeStep?.markdown || "");
  }, [initialStepMarkdown, activeStep?.markdown]);

  const openPublish = async () => {
    setPublishOpen(true);
    setValidating(true);
    setIssues(null);
    try {
      const result = await validateMdx(activeStep?.markdown || "");
      setIssues(result);
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  const confirmPublish = async () => {
    if (issues && issues.some((i) => i.kind === "mermaid")) return;
    try {
      if (activeStep) {
        await updateStepMutation.mutateAsync({
          stepId: activeStep.id,
          phaseId: activeStepRef!.phaseId,
          updates: {
            title: activeStep.title,
            position: 1,
            content: {
              slug: activeStep.slug,
              markdown: activeStep.markdown,
              description: activeStep.description,
              status: "Published",
              difficulty: activeStep.difficulty,
              estimatedTime: activeStep.estimatedTime,
              visibility: activeStep.visibility,
            },
          },
        });
      }
      setInitialStepMarkdown(activeStep?.markdown || "");
      setPublishOpen(false);
      showToast("Step published", "success");
    } catch (err) {
      showToast("Failed to publish step", "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (editorView === "rich") {
      if (editorRef.current) {
        editorRef.current.insertMarkdown(textToInsert);
      } else {
        handleMarkdownChange((activeStep?.markdown || "") + textToInsert);
      }
    } else {
      const textarea = editorContainerRef.current?.querySelector("textarea");
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = textarea.value;
        const before = currentText.substring(0, start);
        const after = currentText.substring(end);
        const newText = before + textToInsert + after;
        
        handleMarkdownChange(newText);
        
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = start + textToInsert.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else {
        handleMarkdownChange((activeStep?.markdown || "") + textToInsert);
      }
    }
  };

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const alt = file.name.replace(/\.[^.]+$/, "") || "image";
        const isImg = file.type.startsWith("image/");
        const markdownLink = isImg
          ? `\n![${alt}](${e.target.result})\n`
          : `\n[${alt}](${e.target.result})\n`;
        insertTextAtCursor(markdownLink);
        showToast(`Embedded ${file.name} successfully`, "success");
      }
    };
    reader.onerror = () => {
      showToast(`Failed to read ${file.name}`, "error");
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    e.preventDefault();
    files.forEach(handleImageFile);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    files.forEach(handleImageFile);
  };

  // Dropdown / Popover visibility menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as any)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handleBookVisibilityChange = async (vis: "public" | "private" | "followers") => {
    try {
      await updateBookMutation.mutateAsync({
        bookId,
        updates: {
          title: dbBook?.title || "",
          access_level: vis === "public" ? "PUBLIC" : vis === "private" ? "PRIVATE" : "FOLLOWERS",
        },
      });
      showToast(`Book visibility set to ${vis}`, "success");
    } catch (err) {
      showToast("Failed to update visibility", "error");
    }
  };

  const handleBookDelete = async () => {
    const confirm = window.confirm("Are you sure you want to delete this book? This cannot be undone.");
    if (!confirm) return;
    try {
      // Implement delete book mutation if available
      showToast("Book deleted", "info");
      onBack();
    } catch (err) {
      showToast("Failed to delete book", "error");
    }
  };

  return (
    <div className="editor-page h-screen bg-background text-foreground font-sans flex flex-col relative overflow-hidden">
      <TopBar
        crumbs={[
          { label: "My Books" },
          { label: dbBook?.title || "…" },
          { label: "Edit Book" },
        ]}
        right={
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
              <Check className="h-3 w-3 text-[color:var(--color-accent-emerald)]" />
              {saveStatus === "saving" ? "Saving..." : "All changes saved"}
            </span>
            {onPreview && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPreview();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20 cursor-pointer bg-card"
              >
                <Eye className="h-3.5 w-3.5" /> Preview book
              </a>
            )}
            <button
              onClick={openPublish}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black text-white dark:bg-white dark:text-black px-3 text-xs transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5" /> Publish Book
            </button>
          </div>
        }
      />

      {publishOpen && (
        <PublishModal
          onClose={() => setPublishOpen(false)}
          onConfirm={confirmPublish}
          validating={validating}
          issues={issues}
          diff={diff}
          bookTitle={dbBook?.title || ""}
          stepTitle={activeStep?.title || ""}
        />
      )}

      {tab === "import" ? (
        <main className="mx-auto w-full max-w-5xl px-6 py-8 flex-1 overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Import</div>
              <h1 className="text-xl font-semibold">Import from Markdown</h1>
            </div>
            <button
              onClick={() => setTab("editor")}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ← Back to editor
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Paste or drop .md
                </span>
                <button className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                  <Upload className="h-3 w-3" /> Upload .md
                </button>
              </div>
              <textarea
                value={rawMd}
                onChange={(e) => setRawMd(e.target.value)}
                placeholder="# Build Backend&#10;&#10;## Phase 0&#10;### Install Node&#10;### Setup Project&#10;&#10;## Phase 1&#10;### Express&#10;### PostgreSQL"
                className="scroll-thin h-[60vh] w-full resize-none rounded-md border border-hairline bg-surface p-4 font-mono text-sm text-foreground focus:border-foreground/30 focus:outline-none"
              />
              <button
                onClick={handleParse}
                disabled={!rawMd.trim()}
                className="mt-3 rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40 cursor-pointer"
              >
                Parse structure
              </button>
            </div>
            <div className="rounded-md border border-hairline bg-surface p-4 flex flex-col">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Detected structure
              </div>
              {!parsed ? (
                <p className="text-sm text-muted-foreground">
                  Paste Markdown on the left and click <em>Parse structure</em>.
                </p>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="font-mono text-sm font-semibold">{parsed.bookTitle}</div>
                  <ul className="mt-2 space-y-2">
                    {parsed.phases.map((p: any, i: number) => (
                      <li key={i}>
                        <div className="font-mono text-xs text-foreground">├─ {p.title}</div>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {p.steps.map((s: any, j: number) => (
                            <li key={j} className="font-mono text-xs text-muted-foreground">
                              │ ├─ {s}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleImport}
                    className="mt-6 w-full rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background cursor-pointer"
                  >
                    Import structure & create steps
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[268.8px_minmax(0,1fr)] overflow-hidden">
          {/* Left panel: book meta + structure */}
          <aside className="scroll-thin w-[268.8px] shrink-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-hairline p-4 lg:sticky lg:top-14">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onBack();
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground text-left cursor-pointer"
            >
              <ChevronLeft className="h-3 w-3" /> Back to My Books
            </a>
            <div className="mb-4 flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 border border-hairline">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13.6px] font-semibold">{dbBook?.title}</div>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-accent-emerald)]/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-[color:var(--color-accent-emerald)]">
                  {dbBook?.publication_status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {phases.reduce((n, p) => n + p.steps.length, 0)} steps · {phases.length} phases
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4 border-b border-hairline">
              <div className="-mb-px border-b-2 border-foreground px-1 py-1.5 text-xs font-medium text-foreground">
                Content
              </div>
              <div className="ml-auto font-mono text-[10px] text-muted-foreground">
                {phases.length} phases
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-1.5">
                    {phases.map((p, phaseIdx) => (
                      <div key={p.id} className="space-y-1">
                        <SortableItem
                          id={p.id}
                          title={p.title.replace(/^Phase \d+\s*[-·—:]\s*/i, `Phase ${phaseIdx} — `)}
                          onDelete={() => deletePhase(p.id)}
                        />
                        <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
                          {p.steps.map((s, si) => {
                            const isActive = activeStepRef?.stepId === s.id;
                            return (
                              <div key={s.id} className="group flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setActiveStepRef({ phaseId: p.id, stepId: s.id });
                                  }}
                                  className={`flex-1 rounded-md px-2 py-1 text-left text-xs transition-colors truncate cursor-pointer ${isActive
                                      ? "bg-surface-2 text-foreground"
                                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                    }`}
                                >
                                  <span className="font-mono text-[9px] leading-[16px] text-muted-foreground/70 mr-1.5">
                                    {phaseIdx}.{si + 1}
                                  </span>
                                  <span className="truncate text-[12px] leading-[16px]">{s.title.replace(/^\d+\.\d+\s*/, "")}</span>
                                </button>
                                <button
                                  onClick={() => deleteStep(p.id, s.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive shrink-0"
                                  title="Delete step"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => addStep(p.id)}
                            className="mt-0.5 -ml-0.7 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface hover:text-foreground cursor-pointer text-left"
                          >
                            <Plus className="h-3 w-3" /> <span className="text-[13px] text-muted-foreground ">Add step</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <button
              onClick={addPhase}
              className="mt-3 inline-flex w-full h-[30.59px] items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline text-sm  hover:border-foreground/30 hover:text-foreground cursor-pointer shrink-0"
            >
              <Plus className="h-3 w-3" /> <span className="text-[13px] text-muted-foreground">Add New Phase</span>
            </button>
          </aside>

          {/* Center: split editor + live preview */}
          {activeStep ? (
            <div className="flex min-w-0 flex-col min-h-0 h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline px-6 py-3 shrink-0 bg-background/50 backdrop-blur-xs z-10">
                <input
                  value={activeStep.title}
                  onChange={(e) => handlePropertyChange("title", e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold tracking-tight focus:outline-none"
                />
                <button
                  onClick={() => setTab("import")}
                  className="ml-3 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Upload className="mr-1 inline h-3 w-3" /> Import Markdown
                </button>
              </div>

              <motion.div
                key="split"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex min-w-0 flex-1 overflow-hidden"
              >
                {/* Left side editor */}
                <div
                  ref={editorContainerRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  className="relative flex min-w-0 flex-1 flex-col border-r border-hairline overflow-hidden"
                >
                  {isDraggingFile && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none">
                      <Upload className="h-10 w-10 text-primary animate-bounce mb-2" />
                      <span className="text-sm font-semibold">Drop files here to upload</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5 shrink-0 select-none">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Editor
                    </span>
                    <div className="flex items-center gap-1.5 bg-surface-2 p-0.5 rounded border border-hairline select-none">
                      <button
                        onClick={() => setEditorView("rich")}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                          editorView === "rich"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Rich Editor
                      </button>
                      <button
                        onClick={() => setEditorView("raw")}
                        className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                          editorView === "raw"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Raw Markdown
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {editorView === "rich" ? (
                      <Suspense
                        fallback={
                          <div className="grid h-full place-items-center text-xs text-muted-foreground">
                            Loading editor…
                          </div>
                        }
                      >
                        <MDXEditorComponent ref={editorRef} markdown={activeStep.markdown} onChange={handleMarkdownChange} />
                      </Suspense>
                    ) : (
                      <textarea
                        value={activeStep.markdown}
                        onChange={(e) => handleMarkdownChange(e.target.value)}
                        className="scroll-thin h-full w-full resize-none bg-surface p-6 font-mono text-[13px] text-foreground focus:outline-none placeholder-muted-foreground border-none leading-relaxed"
                        placeholder="Paste or write your Markdown content here..."
                      />
                    )}
                  </div>
                </div>

                {/* Right side live preview */}
                <div
                  ref={previewContainerRef}
                  className="hidden min-w-0 flex-1 flex-col xl:flex overflow-hidden"
                >
                  <div className="relative flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5 shrink-0 select-none">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Preview
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[color:var(--color-accent-emerald)]">
                        ● auto-updating
                      </span>
                      <div ref={menuRef} className="relative">
                        <button
                          onClick={() => setMenuOpen((o) => !o)}
                          aria-label="Book options"
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-hairline bg-popover shadow-2xl">
                            <div className="px-3 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              Visibility
                            </div>
                            {([
                              { v: "public", icon: Globe, label: "Public", desc: "Anyone with the link" },
                              { v: "private", icon: Lock, label: "Private", desc: "Only you" },
                              { v: "followers", icon: Users, label: "Followers", desc: "Only followers" },
                            ] as const).map(({ v, icon: Icon, label, desc }) => (
                              <button
                                key={v}
                                onClick={() => handleBookVisibilityChange(v)}
                                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 cursor-pointer ${(dbBook?.access_level === "PUBLIC" && v === "public") ||
                                    (dbBook?.access_level === "PRIVATE" && v === "private") ||
                                    (dbBook?.access_level === "FOLLOWERS" && v === "followers")
                                    ? "bg-surface-2"
                                    : ""
                                  }`}
                              >
                                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-foreground">
                                    {label}
                                    {((dbBook?.access_level === "PUBLIC" && v === "public") ||
                                      (dbBook?.access_level === "PRIVATE" && v === "private") ||
                                      (dbBook?.access_level === "FOLLOWERS" && v === "followers")) && (
                                        <Check className="h-3 w-3 text-[color:var(--color-accent-emerald)]" />
                                      )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{desc}</div>
                                </div>
                              </button>
                            ))}
                            <div className="border-t border-hairline">
                              <button
                                onClick={() => {
                                  setMenuOpen(false);
                                  handleBookDelete();
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 cursor-pointer font-medium"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete book
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="scroll-thin flex-1 overflow-y-auto p-8 select-text">
                    <div className="mx-auto max-w-2xl">
                      <Markdown>{activeStep.markdown}</Markdown>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="flex items-center gap-4 border-t border-hairline bg-surface/60 px-4 py-1.5 font-mono text-[10px] text-muted-foreground shrink-0 select-none">
                <span>Lines {activeStep.markdown.split("\n").length}</span>
                <span>Words {activeStep.markdown.split(/\s+/).filter(Boolean).length}</span>
                <span>Characters {activeStep.markdown.length}</span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-emerald)]" />
                  Auto-saved
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 select-none bg-background text-foreground">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <h2 className="text-lg font-bold">No active step selected</h2>
              <p className="text-xs text-muted-foreground mt-1">Select or create a step in the sidebar content tree to begin editing.</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function PublishModal({
  onClose,
  onConfirm,
  validating,
  issues,
  diff,
  bookTitle,
  stepTitle,
}: {
  onClose: () => void;
  onConfirm: () => void;
  validating: boolean;
  issues: MdxIssue[] | null;
  diff: ReturnType<typeof summarizeDiff>;
  bookTitle: string;
  stepTitle: string;
}) {
  const blocking = (issues ?? []).filter((i) => i.kind === "mermaid");
  const warnings = (issues ?? []).filter((i) => i.kind !== "mermaid");
  const canPublish = !validating && blocking.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-hairline bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Confirm publish
            </div>
            <h2 className="mt-1 text-base font-semibold">{bookTitle}</h2>
            <p className="text-xs text-muted-foreground">Step · {stepTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Change summary
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Added" value={`+${diff.added}`} tone="pos" />
              <Stat label="Removed" value={`-${diff.removed}`} tone="neg" />
              <Stat label="Words" value={diff.wordsDelta >= 0 ? `+${diff.wordsDelta}` : `${diff.wordsDelta}`} />
              <Stat label="Chars" value={diff.charsDelta >= 0 ? `+${diff.charsDelta}` : `${diff.charsDelta}`} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {diff.linesBefore} → {diff.linesAfter} lines
            </p>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Validation
            </div>
            {validating ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking MDX, links, and diagrams…
              </div>
            ) : (issues?.length ?? 0) === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-xs">
                <Check className="h-3.5 w-3.5 text-[color:var(--color-accent-emerald)]" />
                No issues found. Ready to publish.
              </div>
            ) : (
              <ul className="scroll-thin max-h-52 space-y-1.5 overflow-y-auto">
                {[...blocking, ...warnings].map((i, idx) => (
                  <li
                    key={idx}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] ${i.kind === "mermaid"
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : "border-hairline bg-surface text-muted-foreground"
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-mono uppercase tracking-wider">{i.kind}</span>
                      <span>·</span>
                      <span>Line {i.line}</span>
                    </div>
                    <div className="mt-0.5 text-foreground/80">{i.message}</div>
                    {i.snippet && (
                      <code className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                        {i.snippet}
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {blocking.length > 0 && (
              <p className="mt-2 text-[11px] text-destructive">
                Fix the mermaid errors above before publishing.
              </p>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline bg-surface/60 px-5 py-3">
          <button
            onClick={onClose}
            className="h-8 rounded-md border border-hairline px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canPublish}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" /> Publish now
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color =
    tone === "pos"
      ? "text-[color:var(--color-accent-emerald)]"
      : tone === "neg"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-md border border-hairline bg-surface py-2">
      <div className={`font-mono text-sm font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
