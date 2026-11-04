type Row = Record<string, unknown>;
interface Result { data: Row[] | Row | null; error: { code: string; message: string } | null; count?: number }

/** Isolated query double, not a PostgreSQL/RLS/transaction emulator. */
export class FixtureDatabase {
  tables = new Map<string, Row[]>();
  failWrites = new Set<string>();
  writes: { table: string; operation: string; values: Row[] }[] = [];
  private sequence = 0;
  rows(table: string) { if (!this.tables.has(table)) this.tables.set(table, []); return this.tables.get(table)!; }
  id() { return `00000000-0000-4000-8000-${String(++this.sequence).padStart(12, "0")}`; }
  from(table: string) { return new FixtureQuery(this, table); }
}

class FixtureQuery implements PromiseLike<Result> {
  private predicates: ((row: Row) => boolean)[] = [];
  private operation = "select";
  private values: Row[] = [];
  private columns = "*";
  private cap = Infinity;
  private descending: string | undefined;
  private counted = false;
  private result: Result | undefined;
  constructor(private db: FixtureDatabase, private table: string) {}
  select(columns = "*", options?: { count?: string; head?: boolean }) { this.columns = columns; this.counted = !!options?.count; return this; }
  eq(key: string, value: unknown) { this.predicates.push(row => row[key] === value); return this; }
  neq(key: string, value: unknown) { this.predicates.push(row => row[key] !== value); return this; }
  gte(key: string, value: unknown) { this.predicates.push(row => String(row[key]) >= String(value)); return this; }
  in(key: string, values: unknown[]) { this.predicates.push(row => values.includes(row[key])); return this; }
  order(key: string, options?: { ascending?: boolean }) { if (options?.ascending === false) this.descending = key; return this; }
  limit(cap: number) { this.cap = cap; return this; }
  insert(values: Row | Row[]) { this.operation = "insert"; this.values = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Row) { this.operation = "upsert"; this.values = [values]; return this; }
  update(values: Row) { this.operation = "update"; this.values = [values]; return this; }
  private execute(): Result {
    if (this.result) return this.result;
    if (this.operation !== "select" && this.db.failWrites.has(this.table)) return this.result = { data: null, error: { code: "fixture_failure", message: "Synthetic write failure" } };
    const table = this.db.rows(this.table);
    let found = table.filter(row => this.predicates.every(predicate => predicate(row)));
    if (this.operation === "insert") {
      found = this.values.map(value => ({ id: this.db.id(), created_at: new Date().toISOString(), ...value })); table.push(...found);
    } else if (this.operation === "upsert") {
      found = this.values.map(value => {
        const existing = table.find(row => value.story_id !== undefined && row.story_id === value.story_id);
        if (existing) { Object.assign(existing, value); return existing; }
        const created = { id: this.db.id(), ...value }; table.push(created); return created;
      });
    } else if (this.operation === "update") found.forEach(row => Object.assign(row, this.values[0]));
    if (this.operation !== "select") this.db.writes.push({ table: this.table, operation: this.operation, values: structuredClone(found) });
    if (this.descending) { const key = this.descending; found.sort((a, b) => String(b[key]).localeCompare(String(a[key]))); }
    found = found.slice(0, this.cap).map(row => ({ ...row }));
    if (this.columns.includes("story_metadata")) found = found.map(row => ({ ...row, story_metadata: this.db.rows("story_metadata").filter(meta => meta.story_id === row.id) }));
    return this.result = { data: found, error: null, ...(this.counted ? { count: found.length } : {}) };
  }
  async single(): Promise<Result> { const result = this.execute(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; }
  maybeSingle() { return this.single(); }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return Promise.resolve(this.execute()).then(onfulfilled, onrejected); }
}
