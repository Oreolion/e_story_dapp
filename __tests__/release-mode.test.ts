// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const effects = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), getUser: vi.fn(), analysis: vi.fn(), notice: vi.fn(), receipt: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: effects.server }));
vi.mock("@supabase/supabase-js", () => ({ createClient: effects.admin }));
vi.mock("@/lib/ai/jobs", () => ({ processAnalysisJob: effects.analysis }));
vi.mock("@/lib/payments/notices", () => ({ dispatchPaymentNotice: effects.notice }));
vi.mock("@/lib/payments/receipts", () => ({ applyVerifiedReceipt: effects.receipt, PaymentUnavailable: class extends Error {} }));
import { middleware } from "@/middleware";
import { validateAuthOrReject } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { releaseMode, assertReleaseActive, ReleasePausedError } from "@/lib/runtime/release";
import { runtimeConfiguration } from "@/lib/runtime/config";
import { POST as aiWorker } from "@/app/api/internal/ai-jobs/route";
import { POST as paymentWorker } from "@/app/api/internal/payment-notices/route";
import { POST as webhook } from "@/app/api/payment/webhook/route";
import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_RELEASE_MODE", undefined);
  effects.server.mockReturnValue({ auth: { getUser: effects.getUser } });
  effects.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
const request = (path: string, method = "GET") => new NextRequest("https://synthetic.invalid" + path, { method });

describe("paused recovery without downstream work", () => {
  it("keeps existing deployments active by default and rejects ambiguous settings", () => {
    expect(releaseMode({})).toBe("active");
    expect(releaseMode({ APP_RELEASE_MODE: "active" })).toBe("active");
    expect(releaseMode({ APP_RELEASE_MODE: "paused" })).toBe("paused");
    for (const value of ["", "true", "PAUSED", "active ", "private-invalid-value"]) {
      expect(releaseMode({ APP_RELEASE_MODE: value })).toBe("invalid");
      expect(() => assertReleaseActive({ APP_RELEASE_MODE: value })).toThrow(ReleasePausedError);
    }
  });
  it.each([
    ["/", "GET"], ["/profile", "GET"], ["/record", "POST"],
    ["/api/journal/save", "POST"], ["/api/stories/synthetic.png", "DELETE"],
    ["/api/auth/callback?code=synthetic", "GET"], ["/api/auth/refresh", "POST"],
    ["/api/cron/re-engagement", "GET"], ["/api/payment/webhook", "POST"],
    ["/api/internal/ai-jobs", "POST"], ["/api/ready", "POST"], ["/_next/image?url=synthetic", "GET"],
  ])("stops %s %s before session refresh or any handler", async (path, method) => {
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    const response = await middleware(request(path, method));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(effects.server).not.toHaveBeenCalled();
    expect(effects.admin).not.toHaveBeenCalled();
    if (path.startsWith("/api/")) expect(await response.json()).toMatchObject({ code: "SERVICE_PAUSED" });
    else expect(await response.text()).toContain("Please try again shortly");
  });
  it("lets active browser navigation retain its existing same-origin auth behavior", async () => {
    expect((await middleware(request("/profile"))).status).toBe(200);
    expect(effects.getUser).toHaveBeenCalledOnce();
  });
  it("allows liveness/readiness probes but never reports paused traffic as ready", async () => {
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    for (const path of ["/api/health", "/api/ready"]) expect((await middleware(request(path))).status).toBe(200);
    const live = await health();
    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({ releaseMode: "paused", acceptingTraffic: false });
    expect((await ready()).status).toBe(503);
    expect(effects.server).not.toHaveBeenCalled();
    expect(effects.admin).not.toHaveBeenCalled();
  });
  it("does not echo malformed release settings into public responses", async () => {
    vi.stubEnv("APP_RELEASE_MODE", "private-invalid-value");
    const response = await middleware(request("/api/journal/save", "POST"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-invalid-value");
    expect((await ready()).status).toBe(503);
  });
  it("blocks the canonical auth guard and database factory even without middleware", async () => {
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    expect((await validateAuthOrReject(request("/api/user/profile", "PUT")) as Response).status).toBe(503);
    expect(() => createSupabaseAdminClient()).toThrow(ReleasePausedError);
    expect(() => runtimeConfiguration()).toThrow(ReleasePausedError);
    expect(effects.server).not.toHaveBeenCalled();
    expect(effects.admin).not.toHaveBeenCalled();
  });
  it.each([aiWorker, paymentWorker, webhook])("blocks privileged entry points before tokens, claims or receipt handling", async handler => {
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    vi.stubEnv("AI_WORKER_ENABLED", "true"); vi.stubEnv("PAYMENT_NOTICE_WORKER_ENABLED", "true");
    const response = await handler(request("/api/internal/synthetic", "POST"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SERVICE_PAUSED" });
    expect(effects.admin).not.toHaveBeenCalled();
    expect(effects.analysis).not.toHaveBeenCalled();
    expect(effects.notice).not.toHaveBeenCalled();
    expect(effects.receipt).not.toHaveBeenCalled();
  });
});
