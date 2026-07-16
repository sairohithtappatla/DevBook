import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Markdown } from "@/components/Markdown";
import { getBook, parseMarkdownToTree, type Book } from "@/lib/mock-data";
import { validateMdx, summarizeDiff, type MdxIssue } from "@/lib/mdx-validate";
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

const MDXEditorComponent = lazy(() => import("@/components/MDXEditorComponent"));

export const Route = createFileRoute("/books/$slug/edit")({
  ssr: false,
  loader: ({ params }) => {
    const book = getBook(params.slug);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Editing ${loaderData.book.title} — DevBook` : "Editor — DevBook" },
      { name: "description", content: "Import Markdown or write manually. Organize phases and steps visually." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Editor,
});

type Node = { id: string; title: string; children?: Node[] };

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
      className="group flex items-center gap-2 rounded-md border border-hairline bg-card px-2 py-1.5 text-sm hover:border-foreground/20"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className={depth === 0 ? "text-sm font-semibold" : ""}>
        {title}
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

function Editor() {
  const { book } = Route.useLoaderData() as { book: Book };
  const navigate = useNavigate();
  const [tab, setTab] = useState<"editor" | "import">("editor");
  const initialMarkdown = book.phases[0]?.steps[0]?.content ?? "";
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [savedMarkdown, setSavedMarkdown] = useState(initialMarkdown);
  const [stepTitle, setStepTitle] = useState(book.phases[0]?.steps[0]?.title ?? "");
  const [visibility, setVisibility] = useState<"public" | "private" | "selected">("public");
  const [selectedPeople, setSelectedPeople] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  const [rawMd, setRawMd] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseMarkdownToTree> | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState<MdxIssue[] | null>(null);
  const diff = useMemo(() => summarizeDiff(savedMarkdown, markdown), [savedMarkdown, markdown]);

  const openPublish = async () => {
    setPublishOpen(true);
    setValidating(true);
    setIssues(null);
    try {
      const result = await validateMdx(markdown);
      setIssues(result);
    } finally {
      setValidating(false);
    }
  };

  const confirmPublish = () => {
    if (issues && issues.some((i) => i.kind === "mermaid")) return;
    setSavedMarkdown(markdown);
    setPublishOpen(false);
  };

  const [phases, setPhases] = useState<Node[]>(
    book.phases.map((p) => ({
      id: p.id,
      title: p.title,
      children: p.steps.map((s) => ({ id: s.id, title: s.title })),
    })),
  );
  const [activeStep, setActiveStep] = useState<{ phaseId: string; stepId: string } | null>(
    book.phases[0]?.steps[0]
      ? { phaseId: book.phases[0].id, stepId: book.phases[0].steps[0].id }
      : null,
  );

  const addPhase = () => {
    const id = `phase-${Date.now()}`;
    const idx = phases.length;
    setPhases([
      ...phases,
      { id, title: `Phase ${idx} · Untitled`, children: [] },
    ]);
  };

  const addStep = (phaseId: string) => {
    const id = `step-${Date.now()}`;
    setPhases(
      phases.map((p) =>
        p.id === phaseId
          ? { ...p, children: [...(p.children ?? []), { id, title: "Untitled step" }] }
          : p,
      ),
    );
    setActiveStep({ phaseId, stepId: id });
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = phases.findIndex((p) => p.id === active.id);
    const to = phases.findIndex((p) => p.id === over.id);
    if (from !== -1 && to !== -1) setPhases(arrayMove(phases, from, to));
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: "My Books" },
          { label: book.title },
          { label: "Edit Book" },
        ]}
        right={
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
              <Check className="h-3 w-3 text-[color:var(--color-accent-emerald)]" /> All changes saved
            </span>
            <Link
              to="/books/$slug"
              params={{ slug: book.slug }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
            >
              <Eye className="h-3.5 w-3.5" /> Preview book
            </Link>
            <button
              onClick={openPublish}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
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
          bookTitle={book.title}
          stepTitle={stepTitle}
        />
      )}


      {tab === "import" ? (
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Import</div>
              <h1 className="text-xl font-semibold">Import from Markdown</h1>
            </div>
            <button
              onClick={() => setTab("editor")}
              className="text-xs text-muted-foreground hover:text-foreground"
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
                <button className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
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
                onClick={() => setParsed(parseMarkdownToTree(rawMd))}
                disabled={!rawMd.trim()}
                className="mt-3 rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
              >
                Parse structure
              </button>
            </div>
            <div className="rounded-md border border-hairline bg-surface p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Detected structure
              </div>
              {!parsed ? (
                <p className="text-sm text-muted-foreground">
                  Paste Markdown on the left and click <em>Parse structure</em>.
                </p>
              ) : (
                <div>
                  <div className="font-mono text-sm font-semibold">{parsed.bookTitle}</div>
                  <ul className="mt-2 space-y-2">
                    {parsed.phases.map((p, i) => (
                      <li key={i}>
                        <div className="font-mono text-xs text-foreground">├─ {p.title}</div>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {p.steps.map((s, j) => (
                            <li key={j} className="font-mono text-xs text-muted-foreground">
                              │ ├─ {s}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left panel: book meta + structure */}
          <aside className="scroll-thin max-h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-hairline p-4 lg:sticky lg:top-14">
            <Link
              to="/books"
              className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3 w-3" /> Back to My Books
            </Link>
            <div className="mb-4 flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{book.title}</div>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-accent-emerald)]/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-[color:var(--color-accent-emerald)]">
                  Published
                </span>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {book.phases.reduce((n, p) => n + p.steps.length, 0)} steps · {book.phases.length} phases
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

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {phases.map((p, phaseIdx) => (
                    <div key={p.id}>
                      <SortableItem
                        id={p.id}
                        title={p.title.replace(/^Phase \d+ · /, `Phase ${phaseIdx} — `)}
                        onDelete={() => setPhases(phases.filter((x) => x.id !== p.id))}
                      />
                      <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
                        {p.children?.map((s, si) => {
                          const isActive =
                            activeStep?.phaseId === p.id && activeStep?.stepId === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => {
                                setActiveStep({ phaseId: p.id, stepId: s.id });
                                setStepTitle(s.title);
                              }}
                              className={`group flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                                isActive
                                  ? "bg-surface-2 text-foreground"
                                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
                              }`}
                            >
                              <span className="font-mono text-[9px] text-muted-foreground/70">
                                {phaseIdx}.{si + 1}
                              </span>
                              <span className="flex-1 truncate">{s.title}</span>
                              {isActive && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-blue)]" />
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => addStep(p.id)}
                          className="mt-0.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> Add step
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              onClick={addPhase}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline py-1.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Phase
            </button>
          </aside>

          {/* Center: split editor + live preview */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b border-hairline px-6 py-3">
              <input
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                className="w-full bg-transparent text-lg font-semibold tracking-tight focus:outline-none"
              />
              <button
                onClick={() => setTab("import")}
                className="ml-3 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Upload className="mr-1 inline h-3 w-3" /> Import Markdown
              </button>
            </div>

            <motion.div
              key="split"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex min-w-0 flex-1"
            >
              <div className="flex min-w-0 flex-1 flex-col border-r border-hairline">
                <div className="flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Editor
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    live preview →
                  </span>
                </div>
                <Suspense
                  fallback={
                    <div className="grid h-[calc(100vh-14rem)] place-items-center text-xs text-muted-foreground">
                      Loading editor…
                    </div>
                  }
                >
                  <div className="h-[calc(100vh-14rem)] min-w-0">
                    <MDXEditorComponent markdown={markdown} onChange={setMarkdown} />
                  </div>
                </Suspense>
              </div>
              <div className="hidden min-w-0 flex-1 flex-col xl:flex">
                <div className="relative flex items-center justify-between border-b border-hairline bg-surface/40 px-4 py-1.5">
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
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
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
                            { v: "selected", icon: Users, label: "Selected people", desc: "Invite specific people" },
                          ] as const).map(({ v, icon: Icon, label, desc }) => (
                            <button
                              key={v}
                              onClick={() => setVisibility(v)}
                              className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2 ${
                                visibility === v ? "bg-surface-2" : ""
                              }`}
                            >
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-foreground">
                                  {label}
                                  {visibility === v && (
                                    <Check className="h-3 w-3 text-[color:var(--color-accent-emerald)]" />
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{desc}</div>
                              </div>
                            </button>
                          ))}
                          {visibility === "selected" && (
                            <div className="border-t border-hairline px-3 py-2">
                              <input
                                value={selectedPeople}
                                onChange={(e) => setSelectedPeople(e.target.value)}
                                placeholder="alice@team.dev, bob@team.dev"
                                className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[11px] text-foreground focus:border-foreground/30 focus:outline-none"
                              />
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                Comma-separated emails or usernames.
                              </div>
                            </div>
                          )}
                          <div className="border-t border-hairline">
                            <button
                              onClick={() => {
                                setMenuOpen(false);
                                setConfirmDelete(true);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete book
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="scroll-thin h-[calc(100vh-14rem)] overflow-y-auto p-8">
                  <div className="mx-auto max-w-2xl">
                    <Markdown>{markdown}</Markdown>
                  </div>
                </div>
              </div>
            </motion.div>
            <div className="flex items-center gap-4 border-t border-hairline bg-surface/60 px-4 py-1.5 font-mono text-[10px] text-muted-foreground">
              <span>Lines {markdown.split("\n").length}</span>
              <span>Words {markdown.split(/\s+/).filter(Boolean).length}</span>
              <span>Characters {markdown.length}</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-emerald)]" />
                Auto-saved
              </span>
            </div>
          </div>
        </main>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Delete this book?
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              &quot;{book.title}&quot; and all its phases and steps will be permanently removed. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-8 rounded-md border border-hairline px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  navigate({ to: "/books" });
                }}
                className="h-8 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:opacity-90"
              >
                Delete book
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
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
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                      i.kind === "mermaid"
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
            className="h-8 rounded-md border border-hairline px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canPublish}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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