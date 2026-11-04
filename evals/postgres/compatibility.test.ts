import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createPostgresFixture } from "../support/postgres";

const owner = "00000000-0000-4000-8000-000000000011";
const other = "00000000-0000-4000-8000-000000000099";
const legacy = "00000000-0000-4000-8000-000000000012";
const fresh = "00000000-0000-4000-8000-000000000013";
const result = { themes: ["work"], emotional_tone: "reflective", life_domain: "work", intensity_score: 0.5, significance_score: 0.6, people_mentioned: [], places_mentioned: [], time_references: [], brief_insight: "Synthetic observation", actionable_advice: "Consider a short note." };

describe.each(["uuid", "text"] as const)("migration compatibility with %s story owners", ownerType => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createPostgresFixture({ ownerType, beforeDurableMigration: async fixture => {
      await fixture.query("INSERT INTO users(id,wallet_address) VALUES($1,'synthetic-owner')", [owner]);
      await fixture.query("INSERT INTO stories(id,author_id,title,content) VALUES($1,$2,$3,$4)", [legacy, owner, "t".repeat(201), "x".repeat(50_001)]);
    } });
  }, 60000);
  afterAll(async () => { await db?.close(); });

  it("preserves counter updates on existing over-limit content without enqueue or quota", async () => {
    await db.query("UPDATE stories SET likes=likes+1 WHERE id=$1", [legacy]);
    expect((await db.query("SELECT likes,revision FROM stories WHERE id=$1", [legacy])).rows[0]).toEqual({ likes: 1, revision: 1 });
    expect((await db.query("SELECT * FROM ai_jobs WHERE story_id=$1", [legacy])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM api_rate_limits")).rows).toHaveLength(0);
  });

  it("rejects newly introduced oversized content and title", async () => {
    await expect(db.query("INSERT INTO stories(author_id,title,content) VALUES($1,'New',$2)", [owner, "x".repeat(50_001)])).rejects.toThrow("Story text limit exceeded");
    await expect(db.query("UPDATE stories SET title=$2 WHERE id=$1", [legacy, "n".repeat(201)])).rejects.toThrow("Story text limit exceeded");
    await expect(db.query("UPDATE stories SET content=content||'x' WHERE id=$1", [legacy])).rejects.toThrow("Story text limit exceeded");
  });

  it("allows correcting one legacy field without requiring a rewrite of the other", async () => {
    await db.query("UPDATE stories SET title='Corrected title' WHERE id=$1", [legacy]);
    expect((await db.query("SELECT title,length(content) AS length,revision FROM stories WHERE id=$1", [legacy])).rows[0]).toMatchObject({ title: "Corrected title", length: 50_001, revision: 2 });
    expect((await db.query("SELECT * FROM ai_jobs WHERE story_id=$1", [legacy])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM ai_daily_provider_calls")).rows).toHaveLength(0);
  });

  it("saves, deduplicates, retries and completes a canonical owner's job", async () => {
    await db.query("INSERT INTO stories(id,author_id,title,content) VALUES($1,$2,'New','A synthetic saved story with sufficient text for queued analysis.')", [fresh, owner]);
    await db.query("SELECT ensure_ai_job($1,$2)", [owner, fresh]);
    await expect(db.query("SELECT ensure_ai_job($1,$2)", [other, fresh])).rejects.toThrow("Story not found");
    const jobs = (await db.query<{ id: string }>("SELECT id FROM ai_jobs WHERE story_id=$1", [fresh])).rows;
    expect(jobs).toHaveLength(1);
    const first = (await db.query<{ id: string; lease_token: string }>("SELECT * FROM claim_ai_job($1)", [jobs[0].id])).rows[0];
    expect(first).toBeDefined();
    await db.query("SELECT fail_ai_job($1,$2,'provider_failure',false)", [first.id, first.lease_token]);
    expect((await db.query("SELECT retry_ai_job($1,$2)", [other, fresh])).rows[0]).toEqual({ retry_ai_job: false });
    expect((await db.query("SELECT retry_ai_job($1,$2)", [owner, fresh])).rows[0]).toEqual({ retry_ai_job: true });
    const second = (await db.query<{ id: string; lease_token: string }>("SELECT * FROM claim_ai_job($1)", [jobs[0].id])).rows[0];
    expect((await db.query("SELECT complete_ai_job($1,$2,$3::jsonb)", [second.id, second.lease_token, JSON.stringify(result)])).rows[0]).toEqual({ complete_ai_job: true });
    expect((await db.query("SELECT brief_insight,source_revision FROM story_metadata WHERE story_id=$1", [fresh])).rows[0]).toMatchObject({ brief_insight: result.brief_insight, source_revision: 1 });
  });
});

describe("payments created by the previous application before migration", () => {
  let db: PGlite;
  const pending = "00000000-0000-4000-8000-000000000021";
  const completed = "00000000-0000-4000-8000-000000000022";
  const receipt = "00000000-0000-4000-8000-000000000031";
  beforeAll(async () => {
    db = await createPostgresFixture({ beforeDurableMigration: async fixture => {
      await fixture.query("INSERT INTO users(id,wallet_address) VALUES($1,'synthetic-legacy-payer')", [owner]);
      await fixture.query("INSERT INTO payments(id,user_id,plan,payment_address,amount_expected,status) VALUES($1,$3,'storyteller','synthetic-pending',2.99,'pending'),($2,$3,'storyteller','synthetic-completed',2.99,'completed')", [pending, completed, owner]);
    } });
  }, 60000);
  afterAll(async () => { await db?.close(); });
  it("settles a pre-migration pending payment once without losing its purchased time", async () => {
    await db.query("SELECT activate_paid_payment($1,2.99,$2)", [pending, receipt]);
    const first = (await db.query("SELECT subscription_expires_at FROM users WHERE id=$1", [owner])).rows;
    await db.query("SELECT activate_paid_payment($1,2.99,$2)", [pending, receipt]);
    expect((await db.query("SELECT subscription_expires_at FROM users WHERE id=$1", [owner])).rows).toEqual(first);
    expect((await db.query("SELECT payment_id FROM payment_notification_outbox")).rows).toEqual([{ payment_id: pending }]);
  });
  it("does not guess whether a historical completed payment already granted access", async () => {
    const before = (await db.query("SELECT subscription_expires_at FROM users WHERE id=$1", [owner])).rows;
    await expect(db.query("SELECT activate_paid_payment($1,2.99,$2)", [completed, "00000000-0000-4000-8000-000000000032"])).rejects.toThrow("Legacy completed payment requires reconciliation");
    expect((await db.query("SELECT subscription_expires_at FROM users WHERE id=$1", [owner])).rows).toEqual(before);
    expect((await db.query("SELECT provider_receipt_id FROM payments WHERE id=$1", [completed])).rows[0]).toEqual({ provider_receipt_id: null });
  });
});
