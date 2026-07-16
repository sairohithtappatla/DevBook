import { memo } from "react";
import {
  ChevronLeft,
  BookOpen,
  Trash2,
  Plus,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type EditorSidebarProps = {
  dbBook: any;
  phases: PhaseNode[];
  activeStepRef: { phaseId: string; stepId: string } | null;
  setActiveStepRef: (ref: { phaseId: string; stepId: string } | null) => void;
  sensors: any;
  onDragEnd: (e: any) => void;
  addPhase: () => void;
  deletePhase: (id: string) => void;
  addStep: (phaseId: string) => void;
  deleteStep: (phaseId: string, stepId: string) => void;
  onBack: () => void;
};

const SortableItem = memo(function SortableItem({
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
      <div {...attributes} {...listeners} className="cursor-grab select-none text-muted-foreground/60 active:cursor-grabbing">
        ⋮⋮
      </div>
      <span className="min-w-0 flex-1 truncate font-semibold leading-[18px] text-foreground">{title}</span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export const EditorSidebar = memo(function EditorSidebar({
  dbBook,
  phases,
  activeStepRef,
  setActiveStepRef,
  sensors,
  onDragEnd,
  addPhase,
  deletePhase,
  addStep,
  deleteStep,
  onBack,
}: EditorSidebarProps) {
  return (
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
                            className={`flex-1 rounded-md px-2 py-1 text-left text-xs transition-colors truncate cursor-pointer ${
                              isActive
                                ? "bg-surface-2 text-foreground"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground"
                            }`}
                          >
                            <span className="font-mono text-[9px] leading-[16px] text-muted-foreground/70 mr-1.5">
                              {phaseIdx}.{si + 1}
                            </span>
                            <span className="truncate text-[12px] leading-[16px]">
                              {s.title.replace(/^\d+\.\d+\s*/, "")}
                            </span>
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
  );
});
