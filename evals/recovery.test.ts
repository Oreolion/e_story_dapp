import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => ({ generate: vi.fn(), provider: vi.fn() }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: effects.provider }));
import { createTextGenerator, inferenceErrorStatus } from "@/lib/ai/provider";
import { processAnalysisJob } from "@/lib/ai/jobs";
import { dispatchPaymentNotice } from "@/lib/payments/notices";
import { applyVerifiedReceipt } from "@/lib/payments/receipts";
import { ReleasePausedError } from "@/lib/runtime/release";
import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_RELEASE_MODE", "active");
  vi.stubEnv("AI_PROVIDER_MODE", "live");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "synthetic-not-a-provider-key");
  effects.provider.mockImplementation(function () { return { getGenerativeModel: () => ({ generateContent: effects.generate }) }; });
});
afterEach(() => vi.unstubAllEnvs());

describe("compatible paused recovery keeps external and durable state untouched", () => {
  it("rejects new inference before provider construction", () => {
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    expect(() => createTextGenerator()).toThrow(ReleasePausedError);
    expect(effects.provider).not.toHaveBeenCalled();
    expect(inferenceErrorStatus(new ReleasePausedError())).toBe(503);
  });
  it("checks again when a previously constructed generator is invoked", async () => {
    const generate = createTextGenerator();
    expect(effects.provider).toHaveBeenCalledOnce();
    vi.stubEnv("APP_RELEASE_MODE", "paused");
    await expect(generate("Synthetic content")).rejects.toThrow(ReleasePausedError);
    expect(effects.generate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([processAnalysisJob, dispatchPaymentNotice, (admin: ReturnType<typeof createSupabaseAdminClient>) => applyVerifiedReceipt(admin, {})])(
    "does not claim jobs, activate receipts or advance the outbox when paused", async operation => {
      const rpc = vi.fn(() => { throw new Error("UNEXPECTED_DURABLE_WRITE"); });
      const from = vi.fn(() => { throw new Error("UNEXPECTED_DATABASE_ACCESS"); });
      const admin = { rpc, from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
      vi.stubEnv("APP_RELEASE_MODE", "paused");
      await expect(operation(admin)).rejects.toThrow(ReleasePausedError);
      expect(rpc).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
      expect(effects.generate).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
});
