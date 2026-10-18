// In-memory Store written independently of createInsforgeStore (plain arrays, trigger-like updated_at).
import type { BookRow, MemberBook, PhaseRow, Role, Store, StepContent, StepRow, TokenRow } from "../handler.ts";
import { StoreError } from "../handler.ts";

export class FakeStore implements Store {
  tokens: TokenRow[] & { hash?: string }[] = [] as never;
  tokenHashes = new Map<string, TokenRow>();
  books: BookRow[] = [];
  members: { book_id: string; user_id: string; role: Role }[] = [];
  phases: PhaseRow[] = [];
  steps: StepRow[] = [];
  clock = 0;
  failWith: Error | null = null; // make every call throw (backend outage / leaky error)
  beforeCas: (() => void) | null = null; // hook to simulate a concurrent editor save between read and write
  casCalls = 0;

  private tick() { this.clock++; return `2026-10-18T10:00:00.${String(this.clock).padStart(6, "0")}+00:00`; }
  private check() { if (this.failWith) throw this.failWith; }
  addToken(hash: string, row: TokenRow) { this.tokenHashes.set(hash, row); }
  addBook(b: Partial<BookRow> & { id: string }, members: [string, Role][]): void {
    this.books.push({ title: b.id, slug: b.id, description: null, tags: [], publication_status: "PUBLISHED", access_level: "PUBLIC", deleted_at: null, ...b });
    for (const [u, r] of members) this.members.push({ book_id: b.id, user_id: u, role: r });
  }
  addPhase(id: string, book_id: string, title: string, position = 1) { this.phases.push({ id, book_id, title, position }); }
  addStep(id: string, phase_id: string, title: string, position: number, content: StepContent) { this.steps.push({ id, phase_id, title, position, content, updated_at: this.tick() }); }
  snapshot() { return JSON.stringify({ b: this.books, p: this.phases, s: this.steps, m: this.members }); }
  step(id: string) { return this.steps.find((s) => s.id === id)!; }

  async findToken(h: string) { this.check(); return this.tokenHashes.get(h) ?? null; }
  async touchToken(id: string, at: string) { this.check(); for (const t of this.tokenHashes.values()) if (t.id === id) t.last_used_at = at; }
  async listMemberBooks(userId: string): Promise<MemberBook[]> {
    this.check();
    return this.members.filter((m) => m.user_id === userId).flatMap((m) => { const book = this.books.find((b) => b.id === m.book_id && b.deleted_at === null); return book ? [{ book: structuredClone(book), role: m.role }] : []; });
  }
  async getMemberBook(userId: string, bookId: string) { this.check(); return (await this.listMemberBooks(userId)).find((x) => x.book.id === bookId) ?? null; }
  async listPhases(bookId: string) { this.check(); return this.phases.filter((p) => p.book_id === bookId).sort((a, b) => a.position - b.position).map((x) => ({ ...x })); }
  async listSteps(phaseIds: string[]) { this.check(); return this.steps.filter((s) => phaseIds.includes(s.phase_id)).sort((a, b) => a.position - b.position).map((s) => structuredClone(s)); }
  async getPhase(id: string) { this.check(); const p = this.phases.find((x) => x.id === id); return p ? { ...p } : null; }
  async getStep(id: string) { this.check(); const s = this.steps.find((x) => x.id === id); return s ? structuredClone(s) : null; }
  async insertPhase(bookId: string, title: string, _by: string) {
    this.check();
    const position = Math.max(0, ...this.phases.filter((p) => p.book_id === bookId).map((p) => p.position)) + 1;
    const p = { id: crypto.randomUUID(), book_id: bookId, title, position }; this.phases.push(p); return { ...p };
  }
  async insertStep(phaseId: string, title: string, content: StepContent, _by: string) {
    this.check();
    const position = Math.max(0, ...this.steps.filter((s) => s.phase_id === phaseId).map((s) => s.position)) + 1;
    const s: StepRow = { id: crypto.randomUUID(), phase_id: phaseId, title, position, content: structuredClone(content), updated_at: this.tick() }; this.steps.push(s); return structuredClone(s);
  }
  async updateStepCas(stepId: string, expected: string, patch: { title?: string; content?: StepContent }) {
    this.check(); this.casCalls++;
    this.beforeCas?.();
    const s = this.steps.find((x) => x.id === stepId);
    if (!s || s.updated_at !== expected) return null;
    if (patch.title !== undefined) s.title = patch.title;
    if (patch.content !== undefined) s.content = structuredClone(patch.content);
    s.updated_at = this.tick();
    return structuredClone(s);
  }
}
export { StoreError };
