import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { createPostgresFixture, postgresAdmin } from "./support/postgres";
import type { PGlite } from "@electric-sql/pglite";
const state = vi.hoisted(() => ({ admin: null as unknown as ReturnType<typeof postgresAdmin> }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => state.admin }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: async () => "00000000-0000-4000-8000-000000000011", isAuthError: () => false, resolveUserId: async (value: string) => value }));
import { POST as webhook } from "@/app/api/payment/webhook/route";
import { dispatchPaymentNotice } from "@/lib/payments/notices";
const owner = "00000000-0000-4000-8000-000000000011", payment = "00000000-0000-4000-8000-000000000012";
const receipt = { id: "00000000-0000-4000-8000-000000000021", recipientAddress: "0x" + "1".repeat(40), amountPaid: "2.99", confirmed: true, status: "SUCCESS", type: "DEPOSIT", network: "mainnet", asset: { id: "00000000-0000-4000-8000-000000000031", symbol: "USDC" }, wallet: { id: "00000000-0000-4000-8000-000000000041" }, address: { id: "00000000-0000-4000-8000-000000000051" } };
let db: PGlite;
beforeAll(async () => { db = await createPostgresFixture(); state.admin = postgresAdmin(db); }, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("TRUNCATE users CASCADE");
  await db.query("INSERT INTO users(id,wallet_address) VALUES($1,'synthetic-wallet')", [owner]);
  await db.query("INSERT INTO payments(id,user_id,plan,payment_address,blockradar_address_id,amount_expected) VALUES($1,$2,'storyteller',$3,$4,2.99)", [payment, owner, receipt.recipientAddress, receipt.address.id]);
  vi.stubEnv("BLOCKRADAR_WEBHOOK_SECRET", "synthetic-signing-placeholder");
  vi.stubEnv("BLOCKRADAR_ACCEPTED_ASSET_IDS", receipt.asset.id);
  vi.stubEnv("BLOCKRADAR_WALLET_ID", receipt.wallet.id);
  vi.stubEnv("BLOCKRADAR_PAYMENT_NETWORK", "mainnet");
});
function request(data: unknown, signature?: string) {
  const raw = JSON.stringify({ event: "deposit.success", data });
  return new NextRequest("http://localhost/api/payment/webhook", { method: "POST", body: raw, headers: { "x-blockradar-signature": signature ?? createHmac("sha512", "synthetic-signing-placeholder").update(raw).digest("hex") } });
}
describe("authenticated receipt to atomic entitlement", () => {
  it("activates once, persists an outbox event and ignores duplicate delivery", async () => {
    expect((await webhook(request(receipt))).status).toBe(200);
    const first = (await db.query("SELECT subscription_expires_at FROM users")).rows;
    expect((await webhook(request(receipt))).status).toBe(200);
    expect((await db.query("SELECT subscription_expires_at FROM users")).rows).toEqual(first);
    expect((await db.query("SELECT * FROM payment_notification_outbox")).rows).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{ ...receipt, confirmed: false }, { ...receipt, status: "PROCESSING" }, { ...receipt, network: "testnet" }, { ...receipt, amountPaid: "Infinity" }, { ...receipt, asset: { ...receipt.asset, id: "00000000-0000-4000-8000-000000000099" } }])("rejects signed but nonqualifying deposits", async value => {
    expect((await webhook(request(value))).status).toBe(400);
    expect((await db.query("SELECT status FROM payments")).rows[0]).toEqual({ status: "pending" });
  });
  it("denies invalid signatures and unconfigured asset acceptance", async () => {
    expect((await webhook(request(receipt, "0".repeat(128)))).status).toBe(401);
    vi.stubEnv("BLOCKRADAR_ACCEPTED_ASSET_IDS", "");
    expect((await webhook(request(receipt))).status).toBe(503);
    expect((await db.query("SELECT status FROM payments")).rows[0]).toEqual({ status: "pending" });
  });
  it("returns retryable failure when entitlement persistence fails", async () => {
    await db.exec("CREATE FUNCTION reject_payment_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic entitlement failure'; END $$; CREATE TRIGGER reject_payment_update BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_payment_update();");
    try {
      expect((await webhook(request(receipt))).status).toBe(503);
      expect((await db.query("SELECT status FROM payments")).rows[0]).toEqual({ status: "pending" });
    } finally { await db.exec("DROP TRIGGER reject_payment_update ON users; DROP FUNCTION reject_payment_update();"); }
  });
  it("delivers one in-app notice from the durable outbox with no email address", async () => {
    await webhook(request(receipt));
    expect(await dispatchPaymentNotice(state.admin as never)).toEqual({ status: "sent" });
    expect(await dispatchPaymentNotice(state.admin as never)).toEqual({ status: "idle" });
    expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retries an ambiguous email send using a frozen payload and the same idempotency key", async () => {
    await db.query("UPDATE users SET email='synthetic@example.invalid',name='Before' WHERE id=$1", [owner]);
    await webhook(request(receipt));
    vi.stubEnv("RESEND_API_KEY", "synthetic-email-placeholder");
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ id: "synthetic-email" }), { status: 200 }));
    let failCompletion = true;
    const admin = { ...state.admin, rpc: async (name: string, args: Record<string, unknown> = {}) => {
      if (name === "finish_payment_notice" && args.p_success === true && failCompletion) { failCompletion = false; return { data: null, error: { message: "Synthetic acknowledgement loss" } }; }
      return state.admin.rpc(name, args);
    } };
    expect(await dispatchPaymentNotice(admin as never)).toEqual({ status: "retry_or_failed" });
    await db.exec("UPDATE payment_notification_outbox SET available_at=now()-interval '1 second'; UPDATE users SET name='After';");
    expect(await dispatchPaymentNotice(admin as never)).toEqual({ status: "sent" });
    const sent = vi.mocked(fetch).mock.calls;
    expect(sent).toHaveLength(2); expect(sent[0][1]?.body).toBe(sent[1][1]?.body);
    expect(new Headers(sent[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(sent[1][1]?.headers).get("Idempotency-Key"));
    expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(1);
  });
});
