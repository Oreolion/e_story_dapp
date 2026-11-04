import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createPostgresFixture } from "../support/postgres";

// Catalog metadata observed on production 2026-11-03. No production rows are
// copied: nullable TEXT owners, generated numeric IDs, and no users.updated_at.
const owner = "10000000-0000-4000-8000-000000000001";
const oauth = "10000000-0000-4000-8000-000000000002";
const payment = "20000000-0000-4000-8000-000000000001";
const wallet = `0x${"a".repeat(40)}`;
let db: PGlite;
beforeAll(async () => {
  db = await createPostgresFixture({ ownerType: "text", verifiedIdentity: true, beforeDurableMigration: async fixture => {
    await fixture.exec("ALTER TABLE users DROP COLUMN updated_at; ALTER TABLE stories ALTER COLUMN author_id DROP NOT NULL; ALTER TABLE stories ALTER COLUMN title DROP NOT NULL; ALTER TABLE stories ALTER COLUMN content DROP NOT NULL; ALTER TABLE stories ADD COLUMN numeric_id bigserial NOT NULL; INSERT INTO stories(author_id,title,content) VALUES(NULL,NULL,NULL);");
  } });
}, 60000);
beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO users(id,wallet_address) VALUES($1,$2)", [owner, wallet]);
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db?.close(); });

describe("candidate migrations on observed production catalog shape", () => {
  it("activates a payment when the original users table had no update timestamp", async () => {
    await db.query("INSERT INTO payments(id,user_id,plan,payment_address,amount_expected) VALUES($1,$2,'storyteller','synthetic-live-shape',2.99)", [payment, owner]);
    await db.query("SELECT activate_paid_payment($1,2.99,$1)", [payment]);
    expect((await db.query("SELECT subscription_plan FROM users")).rows[0]).toEqual({ subscription_plan: "storyteller" });
    expect((await db.query("SELECT status FROM payments")).rows[0]).toEqual({ status: "completed" });
  });
  it("finalizes a verified identity and preserves a legacy nullable story", async () => {
    await db.exec("UPDATE stories SET likes=1 WHERE author_id IS NULL");
    await db.query("INSERT INTO auth_link_challenges(challenge_hash,owner_id,initiator_subject,direction,wallet_address,origin,message,expires_at) VALUES($1,$2,$2,'wallet_to_google',$3,'https://synthetic.invalid','Synthetic verified identity message',now()+interval '5 minutes')", ["c".repeat(64), owner, wallet]);
    expect((await db.query("SELECT id FROM finalize_identity_link($1,$2,'synthetic-google','https://synthetic.invalid')", ["c".repeat(64), oauth])).rows[0]).toEqual({ id: owner });
    expect((await db.query("SELECT numeric_id IS NOT NULL AS generated,author_id IS NULL AS legacy FROM stories")).rows[0]).toEqual({ generated: true, legacy: true });
  });
});
