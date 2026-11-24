import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  owner: vi.fn(),
  hold: vi.fn(),
  admit: vi.fn(),
  generate: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  validateAuthOrReject: mocks.auth,
  resolveUserId: mocks.owner,
  isAuthError: (value: unknown) => value instanceof Response,
}));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({}),
}));
vi.mock("@/lib/ai/availability", () => ({ aiGenerationHold: mocks.hold }));
vi.mock("@/lib/ai/admission", () => ({ admitTextInference: mocks.admit }));
vi.mock("@/lib/ai/provider", () => ({
  createTextGenerator: mocks.create,
  inferenceErrorStatus: () => 502,
}));
import { POST } from "@/app/api/ai/interview/route";
const owner = "synthetic-owner";
const valid = {
  topic: "A journey",
  turns: [{ question: "Where did you go?", answer: "Home by train." }],
};
const request = (body: unknown = valid, account = owner) =>
  new NextRequest("https://estories.app/api/ai/interview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-profile-owner-id": account,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.owner.mockResolvedValue(owner);
  mocks.hold.mockReturnValue(null);
  mocks.admit.mockResolvedValue({ allowed: true });
  mocks.create.mockReturnValue(mocks.generate);
  mocks.generate.mockResolvedValue(
    '{"question":"What did you notice along the way?"}',
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
describe("interview admission and failure safety", () => {
  it("authenticates before reading private input or reserving inference", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects account changes", async () => {
    expect((await POST(request(valid, "other"))).status).toBe(409);
    expect(mocks.admit).not.toHaveBeenCalled();
  });
  it("honors the production setup hold without spending quota", async () => {
    mocks.hold.mockReturnValue({ code: "AI_SETUP_REQUIRED" });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects oversized streamed data despite a forged length header", async () => {
    const req = request({ turns: [], extra: "x".repeat(65536) });
    req.headers.set("content-length", "1");
    expect((await POST(req)).status).toBe(413);
    expect(mocks.admit).not.toHaveBeenCalled();
  });
  it.each([null, { ...valid, userId: "other" }, { turns: [] }])(
    "validates before admission: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.admit).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "fails closed when quota is denied (unavailable=%s)",
    async (unavailable) => {
      mocks.admit.mockResolvedValue({
        allowed: false,
        unavailable,
        retryAfter: 60,
      });
      const result = await POST(request());
      expect(result.status).toBe(unavailable ? 503 : 429);
      expect(result.headers.get("Retry-After")).toBe("60");
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );
  it("uses the canonical owner's shared assistance pool and reserves fallback separately", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.admit).toHaveBeenCalledWith({}, owner, "enhancement");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    const routing = mocks.create.mock.calls[0][3];
    await routing.reserveFallback();
    expect(mocks.admit).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid output without retrying or leaking it", async () => {
    mocks.generate.mockResolvedValue("private-provider-detail");
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-provider-detail");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});
