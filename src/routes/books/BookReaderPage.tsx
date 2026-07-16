import { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Markdown, extractHeadings } from "@/components/Markdown";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useBook } from "@/hooks/useBooks";
import { BOOKS, findStep, flattenSteps } from "@/lib/mock-data";
import { useProgress } from "@/stores/progress";

type Props = {
  bookId: string;
  onBack: () => void;
  onEdit?: () => void;
};

export function BookReaderPage({ bookId, onBack, onEdit }: Props) {
  const { data: dbBook } = useBook(bookId);
  const markLast = useProgress((s) => s.markLast);

  // Match dbBook by slug, or default to the first mock book for exact visual verification
  const book = useMemo(() => {
    return BOOKS.find((b) => b.slug === dbBook?.slug) || BOOKS[0];
  }, [dbBook?.slug]);

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(book.phases.map((p) => [p.slug, true])),
  );

  // Store active slugs locally (matching the search params behavior of TanStack Router)
  const [activeSlugs, setActiveSlugs] = useState<{ phase: string; step: string }>(() => ({
    phase: book.phases[0].slug,
    step: book.phases[0].steps[0].slug,
  }));

  // Sync active step when book changes
  useEffect(() => {
    setActiveSlugs({
      phase: book.phases[0].slug,
      step: book.phases[0].steps[0].slug,
    });
    setOpenPhases(Object.fromEntries(book.phases.map((p) => [p.slug, true])));
  }, [book]);

  const active = useMemo(() => {
    const phaseSlug = activeSlugs.phase || book.phases[0].slug;
    const phase = book.phases.find((p) => p.slug === phaseSlug) ?? book.phases[0];
    const stepSlug = activeSlugs.step || phase.steps[0].slug;
    return findStep(book, phase.slug, stepSlug) ?? findStep(book, book.phases[0].slug, book.phases[0].steps[0].slug)!;
  }, [book, activeSlugs]);

  useEffect(() => {
    markLast(book.slug, active.phase.slug, active.step.slug);
  }, [book.slug, active.phase.slug, active.step.slug, markLast]);

  const flat = flattenSteps(book);
  const flatIdx = flat.findIndex(
    (x) => x.phase.slug === active.phase.slug && x.step.slug === active.step.slug,
  );
  const prev = flat[flatIdx - 1];
  const next = flat[flatIdx + 1];

  const headings = useMemo(() => extractHeadings(active.step.content), [active.step.content]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const offset = 110;
      let current = headings[0]?.id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveHeading(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const lastUpdated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <TopBar
        crumbs={[
          { label: "Docs" },
          { label: book.title },
        ]}
        right={
          onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20 cursor-pointer"
            >
              Edit book
            </button>
          )
        }
      />
      <div className="px-6">
        <div className="relative mx-auto flex max-w-[1400px] flex-row py-10">
          {/* Left: book TOC — Next.js docs style */}
          <aside className="sticky top-[89px] hidden h-[calc(100vh-89px)] w-[284px] shrink-0 flex-col md:flex">
            <nav className="scroll-thin flex h-full flex-col overflow-y-auto pb-4 pr-2">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onBack();
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground text-left cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> All books
              </a>
              <ul>
                {book.phases.map((p) => {
                  const isActivePhase = p.slug === active.phase.slug;
                  const isOpen = openPhases[p.slug] ?? isActivePhase;
                  return (
                    <li key={p.id} className="my-1.5 ml-[3px]">
                      <button
                        onClick={() => setOpenPhases((o) => ({ ...o, [p.slug]: !isOpen }))}
                        className={`relative flex w-full cursor-pointer items-center justify-between rounded-md py-1 pl-2 pr-2 text-left text-[13px] font-medium leading-5 tracking-[-0.01em] transition-colors ${
                          isActivePhase
                            ? "text-[color:var(--color-accent-blue)]"
                            : "text-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{p.title.replace(/^Phase \d+ · /, "")}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                            isOpen ? "" : "-rotate-90"
                          }`}
                        />
                      </button>
                      <div
                        className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-in-out"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0 }}
                      >
                        <ul className="min-h-0 overflow-hidden px-0.5">
                          {p.steps.map((s) => {
                            const isActive = p.slug === active.phase.slug && s.slug === active.step.slug;
                            return (
                              <li key={s.id} className="my-1.5">
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setActiveSlugs({ phase: p.slug, step: s.slug });
                                  }}
                                  className={`relative flex w-full items-center justify-between rounded-md py-1 pl-2 text-[14px] leading-5 transition-colors cursor-pointer ${
                                    isActive
                                      ? "text-[color:var(--color-accent-blue)] font-medium"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <span className="truncate">{s.title}</span>
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Center: article */}
          <main className="min-w-0 flex-1 md:px-10">
            <div className="mx-auto max-w-[--ds-prose,720px]">
              {/* Breadcrumb */}
              <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                <button onClick={onBack} className="hover:text-foreground cursor-pointer">Docs</button>
                <ChevronRight className="h-3 w-3" />
                <span className="hover:text-foreground">{book.title}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{active.step.title}</span>
              </div>

              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
                {active.step.title}
              </h1>
              <div className="mt-3 text-[13px] text-muted-foreground">Last updated {lastUpdated}</div>

              <hr className="my-8 border-hairline" />

              <div className="prose-docs">
                <ErrorBoundary>
                  <Markdown key={active.step.id}>{active.step.content}</Markdown>
                </ErrorBoundary>
              </div>

              <nav className="mt-16 grid grid-cols-2 gap-4 border-t border-hairline pt-8">
                {prev ? (
                  <button
                    onClick={() => setActiveSlugs({ phase: prev.phase.slug, step: prev.step.slug })}
                    className="group flex flex-col items-start gap-1 rounded-lg border border-hairline p-4 text-left transition-colors hover:border-foreground/30 cursor-pointer"
                  >
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <ChevronLeft className="h-3 w-3" /> Previous
                    </span>
                    <span className="truncate text-sm font-medium">{prev.step.title}</span>
                  </button>
                ) : <div />}
                {next ? (
                  <button
                    onClick={() => setActiveSlugs({ phase: next.phase.slug, step: next.step.slug })}
                    className="group flex flex-col items-end gap-1 rounded-lg border border-hairline p-4 text-right transition-colors hover:border-foreground/30 cursor-pointer"
                  >
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      Next <ChevronRight className="h-3 w-3" />
                    </span>
                    <span className="truncate text-sm font-medium">{next.step.title}</span>
                  </button>
                ) : <div />}
              </nav>
            </div>
          </main>

          {/* Right: On this page */}
          <nav className="order-last hidden w-56 shrink-0 lg:block mx-0 ml-10">
            <div className="sticky top-[126px] h-[calc(100vh-121px)]">
              <div className="mb-1 mt-[7px] text-lg font-bold text-foreground">On This Page</div>
              <div className="relative" data-table-of-contents="">
                <div aria-hidden="true" className="from-background z-1 absolute left-0 top-0 h-3 w-full bg-gradient-to-b"></div>
                <div aria-hidden="true" className="from-background absolute bottom-0 left-0 z-10 h-3 w-full bg-gradient-to-t"></div>
                <ul className="scroll-thin max-h-[70vh] space-y-2.5 overflow-y-auto py-2 text-sm">
                  {headings.map((h) => (
                    <li key={h.id} className={h.depth >= 3 ? "pl-3" : ""}>
                      <a
                        href={`#${h.id}`}
                        className={`block leading-[1.6] transition-colors ${
                          activeHeading === h.id
                            ? "text-[color:var(--color-accent-blue)] font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 space-y-2 border-t border-hairline pt-5 text-sm text-muted-foreground"></div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="hover:text-foreground flex items-center gap-x-1.5 text-sm text-muted-foreground transition-opacity cursor-pointer"
                type="button"
              >
                Scroll to top{" "}
                <svg viewBox="0 0 16 16" height="16" width="16" fill="currentColor">
                  <path fillRule="evenodd" d="M7.25 10.75v.75h1.5V6.56l1.47 1.47.53.53 1.06-1.06-.53-.53-2.75-2.75a.75.75 0 0 0-1.06 0L4.72 6.97l-.53.53 1.06 1.06.53-.53 1.47-1.47zM14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16" clipRule="evenodd"></path>
                </svg>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
