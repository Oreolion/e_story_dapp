import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function createPostgresFixture(options: {
  ownerType?: "uuid" | "text";
  beforeDurableMigration?: (db: PGlite) => Promise<void>;
  verifiedIdentity?: boolean;
} = {}) {
  const db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';");
  const base = await readFile("supabase/migrations/000_create_base_tables.sql", "utf8");
  // The historical deployed schema used TEXT owners without this foreign key.
  await db.exec(options.ownerType === "text"
    ? base.replace("author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE", "author_id TEXT NOT NULL")
    : base);
  if (options.verifiedIdentity) {
    await db.exec(await readFile("supabase/migrations/003_add_oauth_fields.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/009_create_auth_nonces_table.sql", "utf8"));
  }
  await db.exec(await readFile("supabase/migrations/001_create_weekly_reflections.sql", "utf8"));
  await db.exec("ALTER TABLE stories ADD COLUMN story_type text DEFAULT 'personal_journal'; ALTER TABLE stories ADD COLUMN parent_story_id uuid REFERENCES stories(id); ALTER TABLE story_metadata ADD COLUMN actionable_advice text;");
  await db.exec(await readFile("supabase/migrations/012_add_subscriptions_and_payments.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/010_create_notifications_table.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/017_add_subscription_notification_type.sql", "utf8"));
  const safety = await readFile("supabase/migrations/019_create_content_safety_and_account_deletion.sql", "utf8");
  await db.exec(safety.slice(0, safety.indexOf("CREATE OR REPLACE FUNCTION block_user")));
  await options.beforeDurableMigration?.(db);
  await db.exec(await readFile("supabase/migrations/020_durable_ai_jobs.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/021_atomic_payment_activation.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/018_atomic_counter_rpcs.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/022_restrict_counter_rpcs.sql", "utf8"));
  if (options.verifiedIdentity) await db.exec(await readFile("supabase/migrations/023_verified_identity_links.sql", "utf8"));
  return db;
}
// Test-only PostgREST-shaped adapter. SQL is real; production JWT/RLS and HTTP
// transport to Supabase are deliberately not simulated by this adapter.
const identifier = (name: string) => { if (!/^[a-z_][a-z_0-9]*$/i.test(name)) throw new Error("Invalid fixture identifier"); return `"${name}"`; };
export function postgresAdmin(db: PGlite) {
  return {
    from: (table: string) => new Query(db, table),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        const pairs = Object.entries(args);
        const placeholders = pairs.map(([key], i) => `${identifier(key)} => $${i + 1}`).join(",");
        const { rows } = await db.query(`SELECT * FROM ${identifier(name)}(${placeholders})`, pairs.map(([, value]) => value));
        if (["complete_ai_job", "fail_ai_job", "activate_paid_payment", "finish_payment_notice", "prepare_payment_notice_email", "retry_ai_job", "consume_wallet_nonce"].includes(name)) return { data: (rows[0] as Record<string, unknown>)?.[name], error: null };
        return { data: JSON.parse(JSON.stringify(rows)), error: null };
      } catch (error) {
        const detail = error as { code?: string; message?: string };
        return { data: null, error: { code: detail.code ?? "fixture_sql_failure", message: detail.message ?? "Synthetic RPC failure" } };
      }
    },
  };
}
class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private where: string[] = [];
  private args: unknown[] = [];
  private cap = 10000;
  private skip = 0;
  private sorted: string[] = [];
  private operation: "select" | "insert" | "update" = "select";
  private value: Record<string, unknown> = {};
  private joins = false;
  private conflict = false;
  constructor(private db: PGlite, private table: string) {}
  select(columns = "*") { this.joins = columns.includes("story_metadata(") || columns.includes("story_metadata ("); return this; }
  eq(key: string, value: unknown) { this.args.push(value); this.where.push(`${identifier(key)}=$${this.args.length}`); return this; }
  in(key: string, values: unknown[]) { this.where.push(`${identifier(key)} IN (${values.map(value => { this.args.push(value); return `$${this.args.length}`; }).join(",")})`); return this; }
  gte(key: string, value: unknown) { this.args.push(value); this.where.push(`${identifier(key)}>=$${this.args.length}`); return this; }
  lte(key: string, value: unknown) { this.args.push(value); this.where.push(`${identifier(key)}<=$${this.args.length}`); return this; }
  order(key: string, options?: { ascending?: boolean }) { this.sorted.push(`${identifier(key)} ${options?.ascending === false ? "DESC" : "ASC"}`); return this; }
  limit(limit: number) { this.cap = limit; return this; }
  range(start: number, end: number) { this.skip = start; this.cap = end - start + 1; return this; }
  insert(value: Record<string, unknown> | Record<string, unknown>[]) { this.operation = "insert"; this.value = Array.isArray(value) ? value[0] : value; return this; }
  upsert(value: Record<string, unknown>) { this.conflict = true; return this.insert(value); }
  update(value: Record<string, unknown>) { this.operation = "update"; this.value = value; return this; }
  private async execute(single = false) {
    try {
      let sql: string;
      if (this.operation === "insert") {
        const values = Object.entries(this.value).filter(([, value]) => value !== undefined);
        sql = `INSERT INTO ${identifier(this.table)}(${values.map(([key]) => identifier(key)).join(",")}) VALUES(${values.map(([, value], i) => { this.args.push(value); return `$${i + 1}`; }).join(",")}) ${this.conflict ? "ON CONFLICT(id) DO NOTHING" : ""} RETURNING *`;
      } else if (this.operation === "update") {
        const assignments = Object.entries(this.value).map(([key, value]) => { this.args.push(value); return `${identifier(key)}=$${this.args.length}`; });
        sql = `UPDATE ${identifier(this.table)} SET ${assignments.join(",")} ${this.where.length ? `WHERE ${this.where.join(" AND ")}` : ""} RETURNING *`;
      } else sql = `SELECT * FROM ${identifier(this.table)} ${this.where.length ? `WHERE ${this.where.join(" AND ")}` : ""} ${this.sorted.length ? `ORDER BY ${this.sorted.join(",")}` : ""} LIMIT ${this.cap} OFFSET ${this.skip}`;
      const { rows } = await this.db.query<Record<string, unknown>>(sql, this.args);
      if (this.joins) for (const row of rows) row.story_metadata = (await this.db.query("SELECT * FROM story_metadata WHERE story_id=$1", [row.id])).rows;
      return { data: single ? rows[0] ?? null : rows, error: null };
    } catch { return { data: null, error: { code: "fixture_sql_failure", message: "Synthetic query failure" } }; }
  }
  single() { return this.execute(true); }
  maybeSingle() { return this.execute(true); }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(fulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null, rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return this.execute().then(fulfilled, rejected); }
}
