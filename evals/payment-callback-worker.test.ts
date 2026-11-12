import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const effects = vi.hoisted(() => ({ create: vi.fn(), replay: vi.fn(), notice: vi.fn() }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: effects.create }));
vi.mock("@/lib/payments/callbacks", () => ({ replayPaymentCallback: effects.replay }));
vi.mock("@/lib/payments/notices", () => ({ dispatchPaymentNotice: effects.notice }));
import { POST } from "@/app/api/internal/payment-notices/route";
const secret="synthetic-payment-worker-credential-32-bytes";
const request=(authorized=true)=>new NextRequest("http://localhost/api/internal/payment-notices",{method:"POST",headers:authorized?{authorization:`Bearer ${secret}`}:{}});
beforeEach(()=>{
  vi.stubEnv("APP_RELEASE_MODE","active"); vi.stubEnv("PAYMENT_WORKER_SECRET",secret);
  vi.stubEnv("PAYMENT_CALLBACK_MODE","retain"); vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED",undefined);
  effects.create.mockReset().mockReturnValue({}); effects.replay.mockReset().mockResolvedValue({status:"processed"}); effects.notice.mockReset().mockResolvedValue({status:"idle"});
});
describe("bounded callback replay dispatch",()=>{
  it("leaves replay off by default",async()=>{
    expect((await POST(request())).status).toBe(200); expect(effects.replay).not.toHaveBeenCalled(); expect(effects.notice).toHaveBeenCalledOnce();
  });
  it("requires worker authentication before any storage or receipt action",async()=>{
    vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED","true");
    expect((await POST(request(false))).status).toBe(401); expect(effects.create).not.toHaveBeenCalled(); expect(effects.replay).not.toHaveBeenCalled();
  });
  it("replays once and then dispatches the independent outbox",async()=>{
    vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED","true");
    const response=await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({status:"idle",receiptStatus:"processed"});
    expect(effects.replay).toHaveBeenCalledOnce(); expect(effects.notice).toHaveBeenCalledOnce();
  });
  it("keeps claims off while paused or consumers are disabled",async()=>{
    vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED","true"); vi.stubEnv("APP_RELEASE_MODE","paused");
    expect((await POST(request())).status).toBe(503); expect(effects.create).not.toHaveBeenCalled();
    vi.stubEnv("APP_RELEASE_MODE","active"); vi.stubEnv("PAYMENT_NOTICE_WORKER_ENABLED","false");
    expect(await (await POST(request())).json()).toEqual({status:"disabled"}); expect(effects.replay).not.toHaveBeenCalled();
  });
  it("fails closed on invalid replay configuration or missing retain mode",async()=>{
    vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED","yes");
    expect((await POST(request())).status).toBe(503); expect(effects.create).not.toHaveBeenCalled();
    vi.stubEnv("PAYMENT_CALLBACK_REPLAY_ENABLED","true"); vi.stubEnv("PAYMENT_CALLBACK_MODE",undefined);
    expect((await POST(request())).status).toBe(503); expect(effects.replay).not.toHaveBeenCalled();
  });
});
