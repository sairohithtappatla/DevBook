import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Markdown, extractHeadings } from "@/components/Markdown";
import { flattenSteps, getBook, findStep, type Book } from "@/lib/mock-data";
import { useProgress, useHydrated } from "@/stores/progress";

type Search = { phase?: string; step?: string };

export const Route = createFileRoute("/books/$slug/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    phase: typeof s.phase === "string" ? s.phase : undefined,
    step: typeof s.step === "string" ? s.step : undefined,
  }),
  loader: ({ params }) => {
    const book = getBook(params.slug);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.book.title} — DevBook` },
          { name: "description", content: loaderData.book.description },
          { property: "og:title", content: loaderData.book.title },
          { property: "og:description", content: loaderData.book.description },
        ]
      : [{ title: "Book not found — DevBook" }],
  }),
  component: Reader,
});

function Reader() {
  const { book } = Route.useLoaderData() as { book: Book };
  const search = Route.useSearch();
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const markLast = useProgress((s) => s.markLast);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(book.phases.map((p) => [p.slug, true])),
  );

  const active = useMemo(() => {
    const phaseSlug = search.phase ?? book.phases[0].slug;
    const phase = book.phases.find((p) => p.slug === phaseSlug) ?? book.phases[0];
    const stepSlug = search.step ?? phase.steps[0].slug;
    return findStep(book, phase.slug, stepSlug) ?? findStep(book, book.phases[0].slug, book.phases[0].steps[0].slug)!;
  }, [book, search.phase, search.step]);

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
    const opts: IntersectionObserverInit = { rootMargin: "-30% 0px -60% 0px" };
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) setActiveHeading(e.target.id);
      }
    }, opts);
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [headings, active.step.id]);

  const lastUpdated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <TopBar
        crumbs={[
          { label: "Docs" },
          { label: book.title },
        ]}
        right={
          <Link
            to="/books/$slug/edit"
            params={{ slug: book.slug }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
          >
            Edit book
          </Link>
        }
      />
      <div className="px-6">
        <div className="relative mx-auto flex max-w-[1400px] flex-row py-10">
          {/* Left: book TOC — Next.js docs style */}
          <aside className="sticky top-[89px] hidden h-[calc(100vh-89px)] w-[284px] shrink-0 flex-col md:flex">
            <nav className="scroll-thin flex h-full flex-col overflow-y-auto pb-4 pr-2">
              <Link
                to="/books"
                className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" /> All books
              </Link>
              <ul>
                {book.phases.map((p) => {
                  const isActivePhase = p.slug === active.phase.slug;
                  const isOpen = openPhases[p.slug] ?? isActivePhase;
                  return (
                    <li key={p.id} className="my-1.5 ml-[3px]">
                      <button
                        onClick={() => setOpenPhases((o) => ({ ...o, [p.slug]: !isOpen }))}
                        className={`relative flex w-full cursor-pointer items-center justify-between rounded-md py-1 pl-2 pr-2 text-left text-sm font-medium transition-colors ${
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
                                <Link
                                  to="/books/$slug"
                                  params={{ slug: book.slug }}
                                  search={{ phase: p.slug, step: s.slug }}
                                  className={`relative flex w-full items-center justify-between rounded-md py-1 pl-2 text-left text-sm transition-colors ${
                                    isActive
                                      ? "text-[color:var(--color-accent-blue)] font-medium"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <span className="truncate">{s.title}</span>
                                </Link>
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
                <Link to="/books" className="hover:text-foreground">Docs</Link>
                <ChevronRight className="h-3 w-3" />
                <Link to="/books/$slug" params={{ slug: book.slug }} className="hover:text-foreground">
                  {book.title}
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{active.step.title}</span>
              </div>

              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
                {active.step.title}
              </h1>
              <div className="mt-3 text-[13px] text-muted-foreground">Last updated {lastUpdated}</div>

              <hr className="my-8 border-hairline" />

              <div className="prose-docs">
                <Markdown key={active.step.id}>{active.step.content}</Markdown>
              </div>

              <nav className="mt-16 grid grid-cols-2 gap-4 border-t border-hairline pt-8">
                {prev ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/books/$slug",
                        params: { slug: book.slug },
                        search: { phase: prev.phase.slug, step: prev.step.slug },
                      })
                    }
                    className="group flex flex-col items-start gap-1 rounded-lg border border-hairline p-4 text-left transition-colors hover:border-foreground/30"
                  >
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <ChevronLeft className="h-3 w-3" /> Previous
                    </span>
                    <span className="truncate text-sm font-medium">{prev.step.title}</span>
                  </button>
                ) : <div />}
                {next ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/books/$slug",
                        params: { slug: book.slug },
                        search: { phase: next.phase.slug, step: next.step.slug },
                      })
                    }
                    className="group flex flex-col items-end gap-1 rounded-lg border border-hairline p-4 text-right transition-colors hover:border-foreground/30"
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
          <aside className="sticky top-[89px] hidden h-[calc(100vh-89px)] w-[240px] shrink-0 xl:block">
            <nav className="scroll-thin flex h-full flex-col overflow-y-auto pl-4">
              <div className="mb-3 text-sm font-semibold text-foreground">On this page</div>
              <ul className="flex flex-col gap-2 text-[13px]">
                {headings.map((h) => (
                  <li key={h.id} className={h.depth >= 3 ? "pl-3" : ""}>
                    <a
                      href={`#${h.id}`}
                      className={`block transition-colors ${
                        activeHeading === h.id
                          ? "text-[color:var(--color-accent-blue)]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
}