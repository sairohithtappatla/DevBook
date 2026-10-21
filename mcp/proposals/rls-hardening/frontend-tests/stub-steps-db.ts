// Stand-in for src/lib/insforge.ts for the editor-save tests: an in-memory `phases`/`steps` store with the subset of the
// postgrest-js builder that DBService uses (select/eq/in/order/single/update). Like the real audit trigger, every UPDATE
// sets a new `updated_at`. `beforeUpdate` lets a test simulate another session saving between our read and our write.
// SIMULATED: no InsForge, no RLS. It checks the client-side write logic only.
type Row = Record<string, any>;
export const db: { phases: Row[]; steps: Row[]; tick: number; beforeUpdate: (() => void) | null; updates: Row[] } = { phases: [], steps: [], tick: 0, beforeUpdate: null, updates: [] };
export const nextStamp = () => `2026-10-20T12:00:00.${String(++db.tick).padStart(6, "0")}+00:00`;
export const reset = () => { db.phases = []; db.steps = []; db.tick = 0; db.beforeUpdate = null; db.updates = []; };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

class Query {
  private op: "select" | "update" = "select";
  private patch: Row = {};
  private cols = "*";
  private filters: ((r: Row) => boolean)[] = [];
  private mode: "many" | "single" = "many";
  constructor(private table: "phases" | "steps") {}
  select(cols = "*") { this.cols = cols; return this; }
  update(patch: Row) { this.op = "update"; this.patch = clone(patch); return this; } // JSON round trip, like the wire: undefined keys vanish
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  order(col: string) { this.filters.push(() => true); void col; return this; }
  single() { this.mode = "single"; return this; }
  then(res: any, rej: any) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  private pick(r: Row) { if (this.cols === "*") return clone(r); return Object.fromEntries(this.cols.split(",").map((c) => c.trim()).map((c) => [c, clone(r[c])])); }
  private run() {
    const rows = db[this.table];
    if (this.op === "update") {
      db.beforeUpdate?.();
      const hit = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const r of hit) { Object.assign(r, this.patch); r.updated_at = nextStamp(); db.updates.push(clone(this.patch)); }
      const data = hit.map((r) => clone(r));
      return this.mode === "single" ? (data.length === 1 ? { data: data[0], error: null } : { data: null, error: new Error("not exactly one row") }) : { data, error: null };
    }
    const data = rows.filter((r) => this.filters.every((f) => f(r))).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => this.pick(r));
    return this.mode === "single" ? (data.length === 1 ? { data: data[0], error: null } : { data: null, error: new Error("not exactly one row") }) : { data, error: null };
  }
}

export const insforge = { database: { from: (table: "phases" | "steps") => new Query(table) } };
