import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { validateMdx, summarizeDiff, type MdxIssue } from "@/lib/mdx-validate";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { EditorArea } from "@/components/editor/EditorArea";
import { PreviewArea } from "@/components/editor/PreviewArea";


import { parseMarkdownToTree } from "@/lib/book-utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useAllProfiles } from "@/hooks/useProfile";
import { useBookMembers, useAddBookMember, useRemoveBookMember } from "@/hooks/useCollaboration";
import { insforge } from "@/lib/insforge";
import { useUploadAttachment } from "@/hooks/useAttachments";

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
  useDeleteBook,
} from "@/hooks/useBooks";
import {
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Upload,
  Eye,
  Check,
  Globe,
  BookOpen,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";

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
  const deleteBookMutation = useDeleteBook();
  const uploadAttachmentMutation = useUploadAttachment();

  const { user } = useAuth();
  const { data: dbProfiles = [] } = useAllProfiles();
  const { data: bookMembers = [] } = useBookMembers(bookId);
  const addMemberMutation = useAddBookMember();
  const removeMemberMutation = useRemoveBookMember();

  const [collabUserId, setCollabUserId] = useState<string>("");
  const [collabRole, setCollabRole] = useState<"OWNER" | "EDITOR" | "VIEWER">("EDITOR");

  const [tab, setTab] = useState<"editor" | "collaborators" | "import">("editor");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [editorView, setEditorView] = useState<"rich" | "raw">("rich");
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);



  // Local state representing the tree of phases and steps
  const [phases, setPhases] = useState<PhaseNode[]>([]);
  const [activeStepRef, setActiveStepRef] = useState<{ phaseId: string; stepId: string } | null>(null);

  // Decoupled states for local typing, debounced preview, and parent sync
  const [markdown, setMarkdown] = useState("");
  const [previewMarkdown, setPreviewMarkdown] = useState("");

  // Sync local editor state when selection changes
  useEffect(() => {
    const activeStepFound = (() => {
      if (!activeStepRef) return null;
      for (const p of phases) {
        const found = p.steps.find((s) => s.id === activeStepRef.stepId);
        if (found) return found;
      }
      return null;
    })();
    if (activeStepFound) {
      setMarkdown(activeStepFound.markdown);
      setPreviewMarkdown(activeStepFound.markdown);
    }
  }, [activeStepRef?.stepId]);

  // Debounce expensive preview updates (AST parsing, Shiki, Mermaid)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewMarkdown(markdown);
    }, 300);
    return () => clearTimeout(timer);
  }, [markdown]);



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

  // Keep refs of active markdown & phases to avoid rebuilding callbacks on every keystroke
  const markdownRef = useRef(markdown);
  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);

  const phasesRef = useRef(phases);
  useEffect(() => {
    phasesRef.current = phases;
  }, [phases]);

  // Auto-save state and refs
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimeoutRef = useRef<any>(null);

  const syncDatabase = useCallback(async () => {
    try {
      const activeStepFound = (() => {
        if (!activeStepRef) return null;
        for (const p of phasesRef.current) {
          const found = p.steps.find((s) => s.id === activeStepRef.stepId);
          if (found) return found;
        }
        return null;
      })();

      if (activeStepFound && activeStepRef) {
        const currentMarkdown = markdownRef.current;
        await updateStepMutation.mutateAsync({
          stepId: activeStepFound.id,
          phaseId: activeStepRef.phaseId,
          bookId,
          updates: {
            title: activeStepFound.title,
            position: 1,
            content: {
              slug: activeStepFound.slug,
              markdown: currentMarkdown,
              description: activeStepFound.description,
              status: activeStepFound.status,
              difficulty: activeStepFound.difficulty,
              estimatedTime: activeStepFound.estimatedTime,
              visibility: activeStepFound.visibility,
            },
          },
        });
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaveStatus("unsaved");
    }
  }, [activeStepRef, bookId, updateStepMutation]);

  const triggerAutoSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      syncDatabase();
    }, 1500);
  }, [syncDatabase]);

  // Handle markdown change in active step (local state only)
  const handleMarkdownChange = useCallback((val: string) => {
    setMarkdown(val);
    triggerAutoSave();
  }, [triggerAutoSave]);

  // Handle active step properties change
  const handlePropertyChange = useCallback(<K extends keyof StepNode>(field: K, val: StepNode[K]) => {
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
    // Direct sync properties on 500ms delay
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      syncDatabase();
    }, 500);
  }, [activeStepRef, syncDatabase]);

  // Clean up autosave timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Drag and Drop phases (batched reordering via Promise.all)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = phases.findIndex((p) => p.id === active.id);
    const to = phases.findIndex((p) => p.id === over.id);
    if (from !== -1 && to !== -1) {
      const reordered = arrayMove(phases, from, to);
      setPhases(reordered);
      try {
        await Promise.all(
          reordered.map((phase, idx) =>
            updatePhaseMutation.mutateAsync({
              phaseId: phase.id,
              bookId,
              updates: { title: phase.title, position: idx + 1 },
            })
          )
        );
        showToast("Phases reordered", "success");
      } catch (err) {
        showToast("Failed to save reordering", "error");
      }
    }
  }, [phases, bookId, updatePhaseMutation, showToast]);

  // Add Phase
  const addPhase = useCallback(async () => {
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
  }, [phases.length, bookId, createPhaseMutation, showToast]);

  // Delete Phase
  const deletePhase = useCallback(async (phaseId: string) => {
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
  }, [phases, bookId, deletePhaseMutation, showToast]);

  // Add Step
  const addStep = useCallback(async (phaseId: string) => {
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
        bookId,
      });
      setActiveStepRef({ phaseId, stepId: created.id });
      showToast("Step created", "success");
    } catch (err: any) {
      console.error("Create step error:", err);
      showToast(`Failed to create step: ${err.message || err}`, "error");
    }
  }, [phases, bookId, createStepMutation, showToast]);

  // Delete Step
  const deleteStep = useCallback(async (phaseId: string, stepId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this step?");
    if (!confirm) return;

    try {
      await deleteStepMutation.mutateAsync({ stepId, phaseId, bookId });
      if (activeStepRef?.stepId === stepId) {
        setActiveStepRef(null);
      }
      showToast("Step deleted", "info");
    } catch (err) {
      showToast("Failed to delete step", "error");
    }
  }, [activeStepRef, bookId, deleteStepMutation, showToast]);

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

  const handleImageFile = async (file: File) => {
    if (!activeStep || !user?.id) return;
    try {
      showToast(`Uploading ${file.name}...`, "info");
      
      const attachment = await uploadAttachmentMutation.mutateAsync({
        stepId: activeStep.id,
        file,
        createdBy: user.id,
      });

      const urlResult = insforge.storage
        .from("book-assets")
        .getPublicUrl(attachment.storage_path);
      const publicUrl = urlResult.data?.publicUrl || "";

      const alt = file.name.replace(/\.[^.]+$/, "") || "file";
      const isImg = file.type.startsWith("image/");
      const markdownLink = isImg
        ? `\n![${alt}](${publicUrl})\n`
        : `\n[${alt}](${publicUrl})\n`;
      
      insertTextAtCursor(markdownLink);
      showToast(`Uploaded and embedded ${file.name} successfully`, "success");
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to upload ${file.name}: ${err.message || err}`, "error");
    }
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

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabUserId) return;
    try {
      await addMemberMutation.mutateAsync({
        bookId,
        userId: collabUserId,
        role: collabRole,
      });
      setCollabUserId("");
      showToast("Collaborator added successfully", "success");
    } catch (err: any) {
      showToast(`Failed to add collaborator: ${err.message || err}`, "error");
    }
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
      await deleteBookMutation.mutateAsync(bookId);
      showToast("Book deleted successfully", "success");
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
      ) : tab === "collaborators" ? (
        <main className="mx-auto w-full max-w-5xl px-6 py-8 flex-1 overflow-y-auto animate-in fade-in duration-200">
          <div className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-semibold">Settings</div>
              <h1 className="text-xl font-bold tracking-tight">Collaborators</h1>
            </div>
            <button
              onClick={() => setTab("editor")}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              ← Back to editor
            </button>
          </div>

          <div className="max-w-xl mx-auto">
            {/* Book Collaborators */}
            <div className="rounded-xl border border-hairline bg-surface p-5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground mb-4">Book Collaborators</h3>
              
              {/* Add Collaborator Form */}
              <form onSubmit={handleAddCollaborator} className="flex gap-2 mb-4">
                <select
                  value={collabUserId}
                  onChange={(e) => setCollabUserId(e.target.value)}
                  className="flex-1 bg-background border border-hairline rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="">Select a developer...</option>
                  {dbProfiles
                    .filter(
                      (p) =>
                        p.id !== user?.id &&
                        !bookMembers.some((m) => m.user_id === p.id)
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id}
                      </option>
                    ))}
                </select>
                <select
                  value={collabRole}
                  onChange={(e) => setCollabRole(e.target.value as any)}
                  className="bg-background border border-hairline rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={!collabUserId}
                  className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  Add
                </button>
              </form>

              {/* Collaborators List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-b border-hairline pb-2 mb-2">
                  <span>Developer</span>
                  <span>Role</span>
                </div>
                {bookMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No additional collaborators. You are the sole creator.</p>
                ) : (
                  bookMembers.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={member.user?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"}
                          alt={member.user?.name || "Member"}
                          className="w-5 h-5 rounded-full object-cover border border-border"
                        />
                        <span className="font-medium text-foreground">{member.user?.name || "Developer"}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] uppercase bg-surface-2 border border-hairline px-1.5 py-0.5 rounded text-muted-foreground">
                          {member.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMemberMutation.mutate({ bookId, userId: member.user_id })}
                          className="text-destructive hover:underline text-[10px] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[268.8px_minmax(0,1fr)] overflow-hidden">
          <EditorSidebar
            dbBook={dbBook}
            phases={phases}
            activeStepRef={activeStepRef}
            setActiveStepRef={setActiveStepRef}
            sensors={sensors}
            onDragEnd={onDragEnd}
            addPhase={addPhase}
            deletePhase={deletePhase}
            addStep={addStep}
            deleteStep={deleteStep}
            onBack={onBack}
          />

          {/* Center: split editor + live preview */}
          {activeStep ? (
            <div className="flex min-w-0 flex-col min-h-0 h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline px-6 py-3 shrink-0 bg-background/50 backdrop-blur-xs z-10">
                <input
                  value={activeStep.title}
                  onChange={(e) => handlePropertyChange("title", e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold tracking-tight focus:outline-none"
                />
                <div className="flex items-center gap-3 shrink-0 ml-3 bg-surface-2 border border-hairline p-0.5 rounded select-none">
                  <button
                    onClick={() => setTab("editor")}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                      tab === "editor"
                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setTab("collaborators")}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                      (tab as string) === "collaborators"
                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Collaborators
                  </button>
                  <button
                    onClick={() => setTab("import")}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                      (tab as string) === "import"
                        ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Import
                  </button>
                </div>
              </div>

              <motion.div
                key="split"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex min-w-0 flex-1 overflow-hidden"
              >
                <EditorArea
                  editorContainerRef={editorContainerRef}
                  editorView={editorView}
                  setEditorView={setEditorView}
                  editorRef={editorRef}
                  markdown={markdown}
                  handleMarkdownChange={handleMarkdownChange}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  isDraggingFile={isDraggingFile}
                />

                <PreviewArea
                  previewContainerRef={previewContainerRef}
                  previewMarkdown={previewMarkdown}
                  menuRef={menuRef}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  dbBook={dbBook}
                  handleBookVisibilityChange={handleBookVisibilityChange}
                  handleBookDelete={handleBookDelete}
                />
              </motion.div>

              <div className="flex items-center gap-4 border-t border-hairline bg-surface/60 px-4 py-1.5 font-mono text-[10px] text-muted-foreground shrink-0 select-none">
                <span>Lines {markdown.split("\n").length}</span>
                <span>Words {markdown.split(/\s+/).filter(Boolean).length}</span>
                <span>Characters {markdown.length}</span>
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
