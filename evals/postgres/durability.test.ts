import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresFixture } from "../support/postgres";
const owner = "00000000-0000-4000-8000-000000000011";
const story = "00000000-0000-4000-8000-000000000012";
const result = { themes: ["work"], emotional_tone: "reflective", life_domain: "work", intensity_score: 0.5, significance_score: 0.6, people_mentioned: [], places_mentioned: [], time_references: [], brief_insight: "Synthetic observation", actionable_advice: "Consider a short note." };
let db: PGlite;
beforeAll(async () => { db = await createPostgresFixture(); }, 60000);
beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO users(id,wallet_address,subscription_plan,subscription_expires_at) VALUES($1,'synthetic-wallet','storyteller',now()+interval '30 days')", [owner]);
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db?.close(); });
async function save() { await db.query("INSERT INTO stories(id,author_id,title,content) VALUES($1,$2,'Synthetic','A synthetic story long enough for analysis and containing no real private data.')", [story, owner]); }
async function claim() { return (await db.query<Record<string, unknown>>("SELECT * FROM claim_ai_job(NULL)")).rows[0]; }

describe("AI job transactions in embedded PostgreSQL", () => {
  it("bounds the lease and total execution deadline", async () => {
    await save(); await claim();
    expect((await db.query("SELECT extract(epoch FROM lease_expires_at-now())::integer AS lease, extract(epoch FROM deadline_at-now())::integer AS deadline FROM ai_jobs")).rows[0]).toEqual({ lease: 45, deadline: 90 });
  });
  it("shares a lifetime budget across UTC days and both inference entry points", async () => {
    await save();
    await db.exec("INSERT INTO ai_daily_provider_calls VALUES((now() AT TIME ZONE 'UTC')::date-1,7)");
    expect((await db.query("SELECT * FROM admit_ai_text_call($1,'enhancement',4,8)", [owner])).rows[0]).toMatchObject({ allowed: true });
    expect((await db.query("SELECT * FROM claim_ai_job(NULL,4,8)")).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM admit_ai_text_call($1,'tracker',4,8)", [owner])).rows[0]).toMatchObject({ allowed: false, reason: "budget" });
    expect((await db.query("SELECT sum(reserved_calls)::integer AS total FROM ai_daily_provider_calls")).rows[0]).toEqual({ total: 8 });
  });
  it("enqueues atomically and rolls back with the story", async () => {
    await db.exec("SAVEPOINT story_write"); await save();
    expect((await db.query("SELECT * FROM ai_jobs")).rows).toHaveLength(1);
    await db.exec("ROLLBACK TO SAVEPOINT story_write");
    expect((await db.query("SELECT * FROM ai_jobs")).rows).toHaveLength(0);
  });
  it("does not duplicate jobs or spend quota again on the same revision", async () => {
    await save(); await db.query("SELECT ensure_ai_job($1,$2)", [owner, story]);
    expect((await db.query("SELECT * FROM ai_jobs")).rows).toHaveLength(1);
    const first = await claim(); expect(first.attempts).toBe(1);
    expect(await claim()).toBeUndefined();
    await db.query("SELECT fail_ai_job($1,$2,'provider_transient',true)", [first.id, first.lease_token]);
    await db.exec("UPDATE ai_jobs SET available_at = now()-interval '1 second'");
    const retry = await claim(); expect(retry.attempts).toBe(2);
    expect((await db.query<{ request_count: number }>("SELECT request_count FROM api_rate_limits WHERE action='ai_analyze_hour'")).rows[0].request_count).toBe(1);
  });
  it("fences expired workers and refuses stale revision results", async () => {
    await save(); const old = await claim();
    await db.exec("UPDATE ai_jobs SET lease_expires_at = now()-interval '1 second'");
    const replacement = await claim(); expect(replacement.lease_token).not.toBe(old.lease_token);
    expect((await db.query<{ complete_ai_job: boolean }>("SELECT complete_ai_job($1,$2,$3::jsonb,'{}'::jsonb)", [old.id, old.lease_token, JSON.stringify(result)])).rows[0].complete_ai_job).toBe(false);
    await db.query("UPDATE stories SET content=content||' Edited.' WHERE id=$1", [story]);
    expect((await db.query<{ complete_ai_job: boolean }>("SELECT complete_ai_job($1,$2,$3::jsonb,'{}'::jsonb)", [replacement.id, replacement.lease_token, JSON.stringify(result)])).rows[0].complete_ai_job).toBe(false);
    expect((await db.query("SELECT * FROM story_metadata")).rows).toHaveLength(0);
  });
  it("persists metadata and success together and preserves author annotations", async () => {
    await save(); await db.query("INSERT INTO story_metadata(story_id,is_canonical,ai_readable) VALUES($1,true,true)", [story]);
    const job = await claim();
    await db.query("SELECT complete_ai_job($1,$2,$3::jsonb,'{}'::jsonb)", [job.id, job.lease_token, JSON.stringify(result)]);
    expect((await db.query<{ status: string }>("SELECT status FROM ai_jobs")).rows[0].status).toBe("succeeded");
    expect((await db.query("SELECT is_canonical,ai_readable,source_revision FROM story_metadata")).rows[0]).toMatchObject({ is_canonical: true, ai_readable: true, source_revision: 1 });
    await db.query("UPDATE stories SET content=content||' New revision.' WHERE id=$1", [story]);
    expect((await db.query("SELECT source_revision FROM story_metadata")).rows[0]).toMatchObject({ source_revision: 0 });
  });
  it("fails after bounded attempts and cannot be reset by enqueue", async () => {
    await save(); const one = await claim();
    await db.query("SELECT fail_ai_job($1,$2,'provider_transient',true)", [one.id, one.lease_token]);
    await db.exec("UPDATE ai_jobs SET available_at=now()-interval '1 second'"); const two = await claim();
    await db.query("SELECT fail_ai_job($1,$2,'provider_transient',true)", [two.id, two.lease_token]);
    await db.query("SELECT ensure_ai_job($1,$2)", [owner, story]);
    expect(await claim()).toBeUndefined();
    expect((await db.query("SELECT status,attempts FROM ai_jobs")).rows[0]).toMatchObject({ status: "failed", attempts: 2 });
  });
  it("permits one explicit recovery without resetting the lifetime attempt budget", async () => {
    await save(); const job = await claim();
    await db.query("SELECT fail_ai_job($1,$2,'privacy_configuration',false)", [job.id, job.lease_token]);
    expect((await db.query<{ retry_ai_job: boolean }>("SELECT retry_ai_job($1,$2)", [owner, story])).rows[0].retry_ai_job).toBe(true);
    const second = await claim(); expect(second.attempts).toBe(2);
    await db.query("SELECT fail_ai_job($1,$2,'invalid_output',false)", [second.id, second.lease_token]);
    expect((await db.query<{ retry_ai_job: boolean }>("SELECT retry_ai_job($1,$2)", [owner, story])).rows[0].retry_ai_job).toBe(false);
  });
  it("does not allow ordinary roles to claim work or read jobs", async () => {
    await save();
    await db.exec("SET LOCAL ROLE authenticated");
    await expect(db.query("SELECT * FROM claim_ai_job(NULL)")).rejects.toThrow(/permission denied/);
  });
  it("denies direct counter manipulation by an authenticated role", async () => {
    await save(); await db.exec("SET LOCAL ROLE authenticated");
    await expect(db.query("SELECT increment_story_likes($1)", [story])).rejects.toThrow(/permission denied/);
  });
  it("fails closed when free monthly quota is exhausted", async () => {
    await db.query("UPDATE users SET subscription_plan='free' WHERE id=$1", [owner]);
    await db.query("INSERT INTO api_rate_limits(user_id,action,request_count) VALUES($1,'ai_month_'||to_char(now() AT TIME ZONE 'UTC','YYYYMM'),10)", [owner]);
    await save(); expect(await claim()).toBeUndefined();
    expect((await db.query("SELECT status,error_code FROM ai_jobs")).rows[0]).toMatchObject({ status: "failed", error_code: "quota_exceeded" });
  });
  it("shares the daily text-call budget across editing and queued analysis", async () => {
    await save();
    expect((await db.query("SELECT * FROM admit_ai_text_call($1,'enhancement',1)", [owner])).rows[0]).toMatchObject({ allowed: true });
    expect((await db.query("SELECT * FROM claim_ai_job(NULL,1)")).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM admit_ai_text_call($1,'tracker',1)", [owner])).rows[0]).toMatchObject({ allowed: false, reason: "budget" });
    expect((await db.query("SELECT reserved_calls FROM ai_daily_provider_calls")).rows[0]).toEqual({ reserved_calls: 1 });
  });
});

describe("atomic payment activation", () => {
  async function payment() { await db.query("INSERT INTO payments(id,user_id,plan,payment_address,amount_expected) VALUES($1,$2,'storyteller','synthetic-address',2.99)", [story, owner]); }
  it("deduplicates activation, including after subscription expiry", async () => {
    await payment(); await db.query("SELECT activate_paid_payment($1,2.99,'00000000-0000-4000-8000-000000000022')", [story]);
    const expiry = (await db.query("SELECT activated_expires_at FROM payments")).rows[0];
    await db.query("UPDATE users SET subscription_expires_at=now()-interval '1 day' WHERE id=$1", [owner]);
    await db.query("SELECT activate_paid_payment($1,2.99,'00000000-0000-4000-8000-000000000022')", [story]);
    expect((await db.query("SELECT activated_expires_at FROM payments")).rows[0]).toEqual(expiry);
    expect((await db.query("SELECT * FROM payment_notification_outbox")).rows).toHaveLength(1);
  });
  it("rolls back receipt status if entitlement write fails", async () => {
    await payment(); await db.exec("CREATE FUNCTION reject_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic write failure'; END $$; CREATE TRIGGER reject_entitlement BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_entitlement(); SAVEPOINT activation_attempt;");
    await expect(db.query("SELECT activate_paid_payment($1,2.99,'00000000-0000-4000-8000-000000000022')", [story])).rejects.toThrow("synthetic write failure");
    await db.exec("ROLLBACK TO SAVEPOINT activation_attempt");
    expect((await db.query("SELECT status,activated_expires_at FROM payments")).rows[0]).toMatchObject({ status: "pending", activated_expires_at: null });
  });
  it("rejects underpayment and public execution", async () => {
    await payment(); await db.exec("SAVEPOINT underpayment");
    await expect(db.query("SELECT activate_paid_payment($1,0.01,'00000000-0000-4000-8000-000000000022')", [story])).rejects.toThrow(/Insufficient/);
    await db.exec("ROLLBACK TO SAVEPOINT underpayment; SET LOCAL ROLE anon;");
    await expect(db.query("SELECT activate_paid_payment($1,2.99,'00000000-0000-4000-8000-000000000022')", [story])).rejects.toThrow(/permission denied/);
  });
  it("keeps a late lower-plan payment as a durable credit instead of downgrading active access", async () => {
    await db.query("UPDATE users SET subscription_plan='creator' WHERE id=$1", [owner]);
    await payment();
    const activated = (await db.query<{ activate_paid_payment: { deferred: boolean } }>("SELECT activate_paid_payment($1,2.99,'00000000-0000-4000-8000-000000000022')", [story])).rows[0].activate_paid_payment;
    expect(activated.deferred).toBe(true);
    expect((await db.query("SELECT subscription_plan FROM users")).rows[0]).toEqual({ subscription_plan: "creator" });
    await db.query("UPDATE users SET subscription_expires_at=now()-interval '1 day' WHERE id=$1", [owner]);
    await db.query("SELECT activate_due_payment_credit()");
    expect((await db.query("SELECT status,deferred FROM payments")).rows[0]).toEqual({ status: "completed", deferred: false });
    expect((await db.query("SELECT subscription_plan FROM users")).rows[0]).toEqual({ subscription_plan: "storyteller" });
  });
});
