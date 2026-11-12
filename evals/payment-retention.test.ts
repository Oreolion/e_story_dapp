import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import { createPostgresFixture, postgresAdmin } from "./support/postgres";
const state = vi.hoisted(() => ({ admin: null as unknown as ReturnType<typeof postgresAdmin>, callback: vi.fn(), regular: vi.fn() }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createPaymentCallbackClient: () => { state.callback(); return state.admin; }, createSupabaseAdminClient: () => { state.regular(); return state.admin; } }));
import { POST } from "@/app/api/payment/webhook/route";
import { replayPaymentCallback } from "@/lib/payments/callbacks";
import { rejectPausedRequest } from "@/lib/runtime/releaseResponse";
import { rejectOperatorRequest } from "@/lib/runtime/cohortResponse";

const epoch = "00000000-0000-4000-8000-000000000001", key = "a".repeat(64);
const owner = "00000000-0000-4000-8000-000000000011", payment = "00000000-0000-4000-8000-000000000012";
const receipt = { id: "00000000-0000-4000-8000-000000000021", recipientAddress: "0x" + "1".repeat(40), amountPaid: "2.99", confirmed: true, status: "SUCCESS", type: "DEPOSIT", network: "mainnet", asset: { id: "00000000-0000-4000-8000-000000000031", symbol: "USDC" }, wallet: { id: "00000000-0000-4000-8000-000000000041" }, address: { id: "00000000-0000-4000-8000-000000000051" } };
let db: PGlite;
function request(value: unknown = receipt, signature?: string) {
  const raw = JSON.stringify({ event: "deposit.success", data: value });
  return new NextRequest("http://localhost/api/payment/webhook", { method: "POST", body: raw,
    headers: { "x-blockradar-signature": signature ?? createHmac("sha512", "synthetic-only").update(raw).digest("hex") } });
}
beforeAll(async () => {
  db = await createPostgresFixture();
  await db.exec("CREATE ROLE authenticator;");
  for (const file of ["install", "install-bridge"]) await db.exec(await readFile(`ops/release/cutover/${file}.sql`, "utf8"));
  const adapter = postgresAdmin(db);
  state.admin = { ...adapter, rpc: async (name: string, args?: Record<string, unknown>) => {
    const result = await adapter.rpc(name, args);
    if (name === "istory_retain_payment_callback" || name === "istory_finish_payment_callback") {
      return { ...result, data: Array.isArray(result.data) ? result.data[0]?.[name] : result.data };
    }
    return result;
  } };
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("TRUNCATE users CASCADE; TRUNCATE istory_release.payment_callbacks;");
  await db.query("UPDATE istory_release.control SET mode='paused',epoch=$1,key_sha256=$2", [epoch, Buffer.from(createHash("sha256").update(key).digest("hex"), "hex")]);
  await db.query("INSERT INTO users(id,wallet_address) VALUES($1,'synthetic')", [owner]);
  await db.query("INSERT INTO payments(id,user_id,plan,payment_address,blockradar_address_id,amount_expected) VALUES($1,$2,'storyteller',$3,$4,2.99)", [payment, owner, receipt.recipientAddress, receipt.address.id]);
  vi.stubEnv("APP_RELEASE_MODE", "paused"); vi.stubEnv("PAYMENT_CALLBACK_MODE", "retain");
  vi.stubEnv("DATA_API_RELEASE_EPOCH", epoch); vi.stubEnv("DATA_API_RELEASE_KEY", key);
  vi.stubEnv("BLOCKRADAR_WEBHOOK_SECRET", "synthetic-only"); vi.stubEnv("BLOCKRADAR_ACCEPTED_ASSET_IDS", receipt.asset.id);
  vi.stubEnv("BLOCKRADAR_WALLET_ID", receipt.wallet.id); vi.stubEnv("BLOCKRADAR_PAYMENT_NETWORK", "mainnet");
  state.regular.mockClear(); state.callback.mockClear();
});

describe("durable maintenance callbacks", () => {
  async function guard(role: "anon" | "authenticated" | "service_role", headers: Record<string, string> = {}, path = "/payments", method = "GET") {
    await db.exec("BEGIN;");
    try {
      await db.query("SELECT set_config('request.headers',$1,true),set_config('request.path',$2,true),set_config('request.method',$3,true)", [JSON.stringify(headers), path, method]);
      await db.exec(`SET LOCAL ROLE ${role};`);
      await db.query("SELECT public.istory_release_guard()");
    } finally { await db.exec("ROLLBACK;"); }
  }
  it("denies legacy service calls after reopening and binds admission to the current epoch/key", async () => {
    const headers = { "x-istory-release-epoch": epoch, "x-istory-release-key": key };
    await expect(guard("service_role", headers)).rejects.toThrow("Application maintenance in progress");
    await expect(guard("service_role", headers, "/rpc/istory_retain_payment_callback", "POST")).resolves.toBeUndefined();
    await expect(guard("anon", headers, "/rpc/istory_retain_payment_callback", "POST")).rejects.toThrow();
    await db.exec("UPDATE istory_release.control SET mode='candidate';");
    await expect(guard("service_role")).rejects.toThrow("Application maintenance in progress");
    await expect(guard("service_role", headers)).resolves.toBeUndefined();
    await expect(guard("authenticated")).resolves.toBeUndefined(); // Existing RLS still governs this actor.
    await expect(guard("service_role", { ...headers, "x-istory-release-key": "b".repeat(64) })).rejects.toThrow();
    await expect(guard("service_role", { ...headers, "x-istory-release-epoch": owner })).rejects.toThrow();
    await db.exec("UPDATE istory_release.control SET mode='paused';");
    await expect(guard("authenticated")).rejects.toThrow();
  });
  it("admits only the opted-in POST and acknowledges durable receipt without entitlement work", async () => {
    expect(rejectPausedRequest(request())).toBeNull();
    expect(await rejectOperatorRequest(request())).toBeNull();
    expect(rejectPausedRequest(new Request("http://localhost/api/payment/webhook"))?.status).toBe(503);
    expect(rejectPausedRequest(new Request("http://localhost/api/payment/verify", { method: "POST" }))?.status).toBe(503);
    const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ received: true, retained: true });
    expect((await POST(request())).status).toBe(200);
    expect((await db.query("SELECT count(*) AS count FROM istory_release.payment_callbacks")).rows[0]).toEqual({ count: 1 });
    expect((await db.query("SELECT status FROM payments")).rows[0]).toEqual({ status: "pending" });
    expect(state.regular).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not acknowledge missing storage, invalid signatures, conflicting receipts or a different wallet", async () => {
    expect((await POST(request(receipt, "0".repeat(128)))).status).toBe(401);
    expect((await POST(request({ ...receipt, wallet: { id: owner } }))).status).toBe(400);
    await POST(request());
    expect((await POST(request({ ...receipt, amountPaid: "7.99" }))).status).toBe(503);
    await db.exec("ALTER FUNCTION public.istory_retain_payment_callback(jsonb) RENAME TO temporarily_unavailable_callback;");
    try { expect((await POST(request())).status).toBe(503); }
    finally { await db.exec("ALTER FUNCTION public.temporarily_unavailable_callback(jsonb) RENAME TO istory_retain_payment_callback;"); }
  });
  it("preserves the global pause with retention unset or malformed", async () => {
    vi.stubEnv("PAYMENT_CALLBACK_MODE", undefined);
    expect((await POST(request())).status).toBe(503);
    expect(state.callback).not.toHaveBeenCalled();
    vi.stubEnv("PAYMENT_CALLBACK_MODE", "retain"); vi.stubEnv("DATA_API_RELEASE_KEY", "bad");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("APP_RELEASE_MODE", "active"); vi.stubEnv("DATA_API_RELEASE_KEY", undefined); vi.stubEnv("DATA_API_RELEASE_EPOCH", undefined);
    expect((await POST(request())).status).toBe(503);
    expect(state.regular).not.toHaveBeenCalled();
  });
  it("bounds real streamed bytes independently of Content-Length", async () => {
    const oversized = new NextRequest("http://localhost/api/payment/webhook", {
      method: "POST", body: "a".repeat(128 * 1024 + 1),
      headers: { "x-blockradar-signature": "0".repeat(128), "Content-Length": "1" },
    });
    expect((await POST(oversized)).status).toBe(413);
    expect(state.callback).not.toHaveBeenCalled();
  });
  it("cancels unfinished body reads at the deadline without acknowledging them", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    try {
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel: cancelled });
      const pending = POST(new NextRequest("http://localhost/api/payment/webhook", {
        method: "POST", body, duplex: "half", headers: { "x-blockradar-signature": "0".repeat(128) },
      } as ConstructorParameters<typeof NextRequest>[1]));
      await vi.advanceTimersByTimeAsync(2001);
      expect((await pending).status).toBe(400); expect(cancelled).toHaveBeenCalled();
      expect(state.callback).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("refuses anonymous direct SQL access to retained payloads and service table access", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await db.exec(`SET ROLE ${role};`);
      try { await expect(db.query("SELECT * FROM istory_release.payment_callbacks")).rejects.toThrow(); }
      finally { await db.exec("RESET ROLE;"); }
    }
    await db.exec("SET ROLE anon;");
    try { await expect(db.query("SELECT istory_retain_payment_callback($1)", [receipt])).rejects.toThrow(); }
    finally { await db.exec("RESET ROLE;"); }
  });
  it("keeps callbacks durable with providers disabled, then processes once after explicit reopening", async () => {
    await POST(request());
    vi.stubEnv("PAYMENT_PROVIDER_MODE", "disabled");
    await expect(replayPaymentCallback(state.admin as never)).rejects.toThrow();
    expect((await db.query("SELECT attempts FROM istory_release.payment_callbacks")).rows[0]).toEqual({ attempts: 0 });
    vi.stubEnv("APP_RELEASE_MODE", "active"); vi.stubEnv("PAYMENT_PROVIDER_MODE", "live");
    expect(await replayPaymentCallback(state.admin as never)).toEqual({ status: "processed" });
    const expires = (await db.query("SELECT subscription_expires_at FROM users")).rows;
    expect(await replayPaymentCallback(state.admin as never)).toEqual({ status: "idle" });
    expect((await POST(request())).status).toBe(200);
    expect((await db.query("SELECT subscription_expires_at FROM users")).rows).toEqual(expires);
    expect((await db.query("SELECT count(*) AS count FROM payment_notification_outbox")).rows[0]).toEqual({ count: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("replays safely after an ambiguous completion and preserves unmatched receipts for reconciliation", async () => {
    await POST(request()); vi.stubEnv("APP_RELEASE_MODE", "active");
    let loseAcknowledgement = true;
    const adapter = { ...state.admin, rpc: async (name: string, args?: Record<string, unknown>) => {
      if (name === "istory_finish_payment_callback" && args?.p_success === true && loseAcknowledgement) {
        loseAcknowledgement = false; return { data: null, error: { message: "synthetic acknowledgement loss" } };
      }
      return state.admin.rpc(name, args);
    } };
    expect(await replayPaymentCallback(adapter as never)).toEqual({ status: "retry_or_failed" });
    const first = (await db.query("SELECT subscription_expires_at FROM users")).rows;
    await db.exec("UPDATE istory_release.payment_callbacks SET available_at=now()-interval '1 second';");
    expect(await replayPaymentCallback(adapter as never)).toEqual({ status: "processed" });
    expect((await db.query("SELECT subscription_expires_at FROM users")).rows).toEqual(first);
    await POST(request({ ...receipt, id: owner, address: { id: owner } }));
    expect(await replayPaymentCallback(state.admin as never)).toEqual({ status: "retry_or_failed" });
    expect((await db.query("SELECT status FROM istory_release.payment_callbacks WHERE receipt_id=$1", [owner])).rows[0]).toEqual({ status: "pending" });
  });
  it("requires current leases and stops automatic attempts after five failures", async () => {
    await POST(request({ ...receipt, address: { id: owner } })); vi.stubEnv("APP_RELEASE_MODE", "active");
    for (let i = 0; i < 5; i++) {
      await db.exec("UPDATE istory_release.payment_callbacks SET available_at=now()-interval '1 second';");
      expect(await replayPaymentCallback(state.admin as never)).toEqual({ status: "retry_or_failed" });
    }
    expect(await replayPaymentCallback(state.admin as never)).toEqual({ status: "idle" });
    expect((await db.query("SELECT attempts,status FROM istory_release.payment_callbacks")).rows[0]).toEqual({ attempts: 5, status: "failed" });
    expect((await db.query("SELECT istory_finish_payment_callback($1,$2,true) AS finished", [receipt.id, owner])).rows[0]).toEqual({ finished: false });
  });
  it("allows only one outstanding lease and fences a worker after its lease is replaced", async () => {
    await POST(request());
    const first = await db.query<{ lease_token: string }>("SELECT * FROM istory_claim_payment_callback()");
    expect(first.rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM istory_claim_payment_callback()")).rows).toHaveLength(0);
    await db.exec("UPDATE istory_release.payment_callbacks SET lease_until=now()-interval '1 second';");
    expect((await db.query("SELECT istory_finish_payment_callback($1,$2,true) AS finished", [receipt.id, first.rows[0].lease_token])).rows[0]).toEqual({ finished: false });
    const second = await db.query<{ lease_token: string }>("SELECT * FROM istory_claim_payment_callback()");
    expect(second.rows[0].lease_token).not.toBe(first.rows[0].lease_token);
    expect((await db.query("SELECT istory_finish_payment_callback($1,$2,true) AS finished", [receipt.id, first.rows[0].lease_token])).rows[0]).toEqual({ finished: false });
    expect((await db.query("SELECT istory_finish_payment_callback($1,$2,true) AS finished", [receipt.id, second.rows[0].lease_token])).rows[0]).toEqual({ finished: true });
  });
});
