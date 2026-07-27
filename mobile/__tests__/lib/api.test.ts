import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(() => Promise.resolve("secret-access-token" as string | null)),
  enqueue: vi.fn((_request: unknown) => Promise.resolve()),
  isOnline: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { API_BASE_URL: "https://estories.app" } } },
}));

vi.mock("../../lib/storage", () => ({
  getItem: mocks.getItem,
  setItem: vi.fn(() => Promise.resolve()),
  removeItem: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/offline", () => ({
  enqueue: mocks.enqueue,
  isOnline: mocks.isOnline,
}));

import { api } from "../../lib/api";

describe("api offline policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Network request failed")))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not queue mutations unless the caller explicitly opts in", async () => {
    const result = await api("/api/payment/create", {
      method: "POST",
      body: { plan: "creator" },
    });

    expect(result.queued).toBeUndefined();
    expect(result.ok).toBe(false);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("queues an opted-in same-origin mutation without persisting its bearer token", async () => {
    const result = await api("/api/journal/save", {
      method: "POST",
      body: { content: "Offline story" },
      offlineQueue: {
        ownerId: "user-123",
        idempotencyKey: "story-request-123",
      },
    });

    expect(result.queued).toBe(true);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    const queued = mocks.enqueue.mock.calls[0]?.[0] as
      | {
          ownerId: string;
          idempotencyKey: string;
          headers: Record<string, string>;
        }
      | undefined;
    expect(queued).toBeDefined();
    if (!queued) throw new Error("Expected a queued request");
    expect(queued.ownerId).toBe("user-123");
    expect(queued.idempotencyKey).toBe("story-request-123");
    expect(queued.headers.Authorization).toBeUndefined();
    expect(queued.headers["Idempotency-Key"]).toBe("story-request-123");
  });

  it("never queues absolute external URLs", async () => {
    await api("https://example.com/mutation", {
      method: "POST",
      body: { value: true },
      offlineQueue: {
        ownerId: "user-123",
        idempotencyKey: "external-request",
      },
    });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
