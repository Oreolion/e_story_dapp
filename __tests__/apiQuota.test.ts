import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeApiQuota } from "@/lib/apiQuota";

const POLICY = {
  action: "ai_test_hour",
  maxRequests: 10,
  windowSeconds: 3600,
};

function mockAdmin(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    admin: { rpc } as unknown as Parameters<typeof consumeApiQuota>[0],
    rpc,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consumeApiQuota", () => {
  it("returns the durable quota result and sends the complete policy to the RPC", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-31T12:00:00.000Z"));
    const { admin, rpc } = mockAdmin({
      data: [{ allowed: true, remaining: 9, reset_at: "2026-07-31T13:00:00.000Z" }],
      error: null,
    });

    await expect(consumeApiQuota(admin, "550e8400-e29b-41d4-a716-446655440000", POLICY))
      .resolves.toEqual({
        allowed: true,
        remaining: 9,
        retryAfter: 3600,
        unavailable: false,
      });

    expect(rpc).toHaveBeenCalledWith("consume_api_quota", {
      p_user_id: "550e8400-e29b-41d4-a716-446655440000",
      p_action: "ai_test_hour",
      p_max_requests: 10,
      p_window_seconds: 3600,
    });
  });

  it("reports a consumed quota without treating it as an outage", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-31T12:59:45.000Z"));
    const { admin } = mockAdmin({
      data: [{ allowed: false, remaining: 0, reset_at: "2026-07-31T13:00:00.000Z" }],
      error: null,
    });

    await expect(consumeApiQuota(admin, "550e8400-e29b-41d4-a716-446655440000", POLICY))
      .resolves.toEqual({
        allowed: false,
        remaining: 0,
        retryAfter: 15,
        unavailable: false,
      });
  });

  it("fails closed when the quota RPC returns an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { admin } = mockAdmin({ data: null, error: { message: "database unavailable" } });

    await expect(consumeApiQuota(admin, "550e8400-e29b-41d4-a716-446655440000", POLICY))
      .resolves.toEqual({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
        unavailable: true,
      });
  });

  it("fails closed when the quota client throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const admin = {
      rpc: vi.fn().mockRejectedValue(new Error("network failure")),
    } as unknown as Parameters<typeof consumeApiQuota>[0];

    await expect(consumeApiQuota(admin, "550e8400-e29b-41d4-a716-446655440000", POLICY))
      .resolves.toEqual({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
        unavailable: true,
      });
  });
});
