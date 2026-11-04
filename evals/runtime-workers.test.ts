import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const dependencies = vi.hoisted(() => ({ admin: vi.fn(), analysis: vi.fn(), notice: vi.fn(), provider: vi.fn() }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: dependencies.admin }));
vi.mock("@/lib/ai/jobs", () => ({ processAnalysisJob: dependencies.analysis }));
vi.mock("@/lib/payments/notices", () => ({ dispatchPaymentNotice: dependencies.notice }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: dependencies.provider }));
import { POST as aiWorker } from "@/app/api/internal/ai-jobs/route";
import { POST as paymentWorker } from "@/app/api/internal/payment-notices/route";
import { createTextGenerator } from "@/lib/ai/provider";
import { RuntimeConfigurationError } from "@/lib/runtime/config";

describe("worker switches and fixture inference", () => {
  it.each([
    ["AI_WORKER_SECRET", "AI_WORKER_ENABLED", aiWorker],
    ["PAYMENT_WORKER_SECRET", "PAYMENT_NOTICE_WORKER_ENABLED", paymentWorker],
  ] as const)("authenticates a paused worker without accessing its database: %s", async (secretName, flagName, worker) => {
    const secret = "synthetic-worker-token-with-at-least-32-characters";
    vi.stubEnv(secretName, secret); vi.stubEnv(flagName, "false");
    const rejected = await worker(new NextRequest("https://synthetic.invalid/api/internal/worker", { method: "POST" }));
    expect(rejected.status).toBe(401);
    const response = await worker(new NextRequest("https://synthetic.invalid/api/internal/worker", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: "disabled" });
    expect(dependencies.admin).not.toHaveBeenCalled();
    expect(dependencies.analysis).not.toHaveBeenCalled(); expect(dependencies.notice).not.toHaveBeenCalled();
  });
  it("returns truthful fixture analysis without initializing a provider", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "mock");
    const usage = vi.fn();
    const result = JSON.parse(await createTextGenerator(1000, usage)("Synthetic story"));
    expect(result.brief_insight).toContain("no live model");
    expect(usage).toHaveBeenCalledWith({ inputTokens: 0, outputTokens: 0, totalTokens: 0, mockResponses: 1 });
    expect(dependencies.provider).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses disabled inference before initializing a provider", () => {
    vi.stubEnv("AI_PROVIDER_MODE", "disabled");
    expect(() => createTextGenerator()).toThrow(RuntimeConfigurationError);
    expect(dependencies.provider).not.toHaveBeenCalled();
  });
});
