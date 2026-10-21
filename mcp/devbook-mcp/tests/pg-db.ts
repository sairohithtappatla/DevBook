// SIMULATION of the postgrest-js builder subset that createInsforgeStore uses, executed as SQL on a disposable native
// PostgreSQL. It is NOT PostgREST and NOT InsForge: it only lets the Store's queries run against real tables, constraints,
// triggers and RLS-bypassing ownership. Connects as the superuser, standing in for the (unverified) service credential.
import pg from "npm:pg@8.13.1";

type Result = { data: unknown; error: { code?: string; message: string } | null };
const IDENT = /^[a-z_][a-z0-9_]*$/; // lower-case SQL identifiers (digits allowed after the first character, e.g. content_sha256)
const TABLES = new Set(["mcp_tokens", "book_members", "books", "phases", "steps", "mcp_audit_events"]);
const RPCS = new Set(["mcp_rate_take"]);

export class PgDb {
  private types = new Map<string, string>();
  constructor(public pool: pg.Pool) {}
  from(table: string) { if (!TABLES.has(table)) throw new Error("table not allowed in the emulator"); return new Query(this, table); }
  // postgrest-js style rpc(fn, namedArgs) -> { data: <scalar result>, error }
  async rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
    if (!RPCS.has(fn)) throw new Error("function not allowed in the emulator");
    const keys = Object.keys(args);
    if (!keys.every((k) => IDENT.test(k))) throw new Error("bad argument name");
    try {
      const r = await this.pool.query(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as v`, keys.map((k) => args[k]));
      return { data: r.rows[0].v, error: null };
    } catch (e) { const err = e as { code?: string; message?: string }; return { data: null, error: { code: err.code, message: String(err.message) } }; }
  }
  async typeOf(table: string, col: string): Promise<string> {
    const key = `${table}.${col}`;
    let t = this.types.get(key);
    if (!t) {
      if (!IDENT.test(col)) throw new Error("bad column");
      const r = await this.pool.query("select format_type(atttypid, atttypmod) as t from pg_attribute where attrelid = $1::regclass and attname = $2 and not attisdropped", [`public.${table}`, col]);
      if (!r.rows[0]) throw new Error(`unknown column ${key}`);
      t = r.rows[0].t as string; this.types.set(key, t);
    }
    return t;
  }
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" = "select";
  private cols = "*";
  private filters: { kind: "eq" | "in" | "is"; col: string; val: unknown }[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max?: number;
  private skip = 0;
  private payload: Record<string, unknown>[] = [];
  private mode: "many" | "single" | "maybe" = "many";
  constructor(private db: PgDb, private table: string) {}
  select(cols = "*") { this.cols = cols; return this; }
  insert(rows: Record<string, unknown>[]) { this.op = "insert"; this.payload = rows; return this; }
  update(patch: Record<string, unknown>) { this.op = "update"; this.payload = [patch]; return this; }
  eq(col: string, val: unknown) { this.filters.push({ kind: "eq", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ kind: "in", col, val }); return this; }
  is(col: string, val: null) { this.filters.push({ kind: "is", col, val }); return this; }
  order(col: string, o: { ascending?: boolean } = {}) { this.orders.push({ col, asc: o.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  range(from: number, to: number) { this.skip = from; this.max = to - from + 1; return this; } // postgrest-js: inclusive bounds
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  then<A, B>(ok?: (r: Result) => A | PromiseLike<A>, bad?: (e: unknown) => B | PromiseLike<B>) { return this.run().then(ok, bad); }

  private async value(col: string, v: unknown, params: unknown[]): Promise<string> {
    const type = await this.db.typeOf(this.table, col);
    params.push(type === "jsonb" || type === "json" ? JSON.stringify(v) : v);
    return `$${params.length}::${type}`;
  }
  private async run(): Promise<Result> {
    try {
      const cols = this.cols.split(",").map((c) => c.trim());
      if (!cols.every((c) => c === "*" || IDENT.test(c))) throw new Error("bad select list");
      const colList = cols.join(", ");
      const params: unknown[] = [];
      const where: string[] = [];
      for (const f of this.filters) {
        if (!IDENT.test(f.col)) throw new Error("bad column");
        const type = await this.db.typeOf(this.table, f.col);
        if (f.kind === "is") where.push(`${f.col} is null`);
        else if (f.kind === "eq") { params.push(f.val); where.push(`${f.col} = $${params.length}::${type}`); }
        else { params.push(f.val); where.push(`${f.col} = any($${params.length}::${type}[])`); }
      }
      const w = where.length ? ` where ${where.join(" and ")}` : "";
      let sql: string;
      if (this.op === "select") {
        const ord = this.orders.length ? ` order by ${this.orders.map((o) => `${o.col} ${o.asc ? "asc" : "desc"}`).join(", ")}` : "";
        sql = `select to_jsonb(t) as j from (select ${colList} from public.${this.table}${w}${ord}${this.max !== undefined ? ` limit ${Number(this.max)}` : ""}${this.skip ? ` offset ${Number(this.skip)}` : ""}) t`;
      } else if (this.op === "insert") {
        const row = this.payload[0];
        const keys = Object.keys(row);
        if (!keys.every((k) => IDENT.test(k))) throw new Error("bad column");
        const vals: string[] = [];
        for (const k of keys) vals.push(await this.value(k, row[k], params));
        sql = `with r as (insert into public.${this.table} (${keys.join(", ")}) values (${vals.join(", ")}) returning ${colList}) select to_jsonb(r) as j from r`;
      } else {
        const patch = this.payload[0];
        const keys = Object.keys(patch);
        if (!keys.every((k) => IDENT.test(k))) throw new Error("bad column");
        const sets: string[] = [];
        for (const k of keys) sets.push(`${k} = ${await this.value(k, patch[k], params)}`);
        // WHERE parameters were numbered first ($1..$m), SET values follow ($m+1..), so the array is used as built
        const sql2 = `with r as (update public.${this.table} set ${sets.join(", ")}${where.length ? ` where ${where.join(" and ")}` : ""} returning ${colList}) select to_jsonb(r) as j from r`;
        const res = await this.db.pool.query(sql2, params);
        return this.shape(res.rows.map((r: { j: unknown }) => r.j));
      }
      const res = await this.db.pool.query(sql, params);
      return this.shape(res.rows.map((r: { j: unknown }) => r.j));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return { data: null, error: { code: err.code, message: String(err.message) } };
    }
  }
  private shape(rows: unknown[]): Result {
    if (this.mode === "many") return { data: rows, error: null };
    if (this.mode === "single") return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { code: "PGRST116", message: "expected exactly one row" } };
    return rows.length <= 1 ? { data: rows[0] ?? null, error: null } : { data: null, error: { code: "PGRST116", message: "more than one row" } };
  }
}
