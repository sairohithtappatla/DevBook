// Stand-in for src/lib/insforge.ts: replays recorded outputs of the real SQL (fixtures/reader-fixtures.json).
import fx from "./fixtures/reader-fixtures.json";

export const control: { actor: string; failTable: string | null; rpcOverride: ((args: any) => any) | null } = { actor: "anon", failTable: null, rpcOverride: null };
export const calls: { rpc: any[]; deletes: { table: string; filters: any[] }[]; selects: { table: string; cols: string }[] } = { rpc: [], deletes: [], selects: [] };
export const reset = () => { calls.rpc.length = 0; calls.deletes.length = 0; calls.selects.length = 0; control.failTable = null; control.rpcOverride = null; };

const bookKey = (id: string) => Object.entries((fx as any).ids.books).find(([, v]) => v === id)?.[0];

class Query {
  private op: "select" | "delete" = "select";
  private cols = "";
  private filters: any[] = [];
  constructor(private table: string) {}
  select(cols: string) { this.cols = cols; return this; }
  delete() { this.op = "delete"; return this; }
  in(col: string, vals: string[]) { this.filters.push({ type: "in", col, vals }); return this; }
  eq(col: string, val: string) { this.filters.push({ type: "eq", col, val }); return this; }
  then(res: any, rej: any) { return Promise.resolve(this.run()).then(res, rej); }
  private run() {
    if (control.failTable === this.table) return { data: null, error: new Error(`${this.table} failed`) };
    if (this.op === "delete") { calls.deletes.push({ table: this.table, filters: this.filters }); return { data: null, error: null }; }
    calls.selects.push({ table: this.table, cols: this.cols });
    const ids: string[] = this.filters.find((f) => f.type === "in" && f.col === "book_id")?.vals ?? [];
    if (this.table === "reader_book_step_counts") return { data: (fx as any).counts[control.actor].filter((r: any) => ids.includes(r.book_id)), error: null };
    if (this.table === "phases" && this.cols.includes("steps(id)")) {
      return { data: (fx as any).embed[control.actor].filter((r: any) => ids.includes(r.book_id)), error: null };
    }
    throw new Error(`unexpected select on ${this.table}(${this.cols})`);
  }
}

export const insforge = {
  database: {
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args: any) => {
      calls.rpc.push({ fn, args });
      if (control.rpcOverride) return control.rpcOverride(args);
      if (fn !== "reader_book_tree") throw new Error("unexpected rpc " + fn);
      const key = bookKey(args.target_book_id);
      const tree = key ? (fx as any).trees[control.actor][`${key}:${!!args.include_drafts}`] : null;
      return { data: tree ?? null, error: null };
    },
  },
};
