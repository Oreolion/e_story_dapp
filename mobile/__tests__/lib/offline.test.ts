import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
      return Promise.resolve();
    }),
    fetch: vi.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true })
    ),
    addEventListener: vi.fn(() => vi.fn()),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
    removeItem: mocks.removeItem,
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: mocks.fetch,
    addEventListener: mocks.addEventListener,
  },
}));

import {
  clearQueue,
  enqueue,
  getPendingCount,
  getQueue,
  processQueue,
} from "../../lib/offline";
import type { QueuedRequest } from "../../lib/offline";

const request = (ownerId: string, idempotencyKey: string) => ({
  ownerId,
  idempotencyKey,
  path: "/api/journal/save",
  method: "POST" as const,
  body: { content: `${ownerId}-story` },
  headers: { "Idempotency-Key": idempotencyKey },
});

describe("offline queue", () => {
  beforeEach(() => {
    mocks.values.clear();
    vi.clearAllMocks();
    mocks.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it("scopes pending requests to their owner", async () => {
    await enqueue(request("user-a", "request-a"));
    await enqueue(request("user-b", "request-b"));

    expect(await getPendingCount("user-a")).toBe(1);
    expect(await getPendingCount("user-b")).toBe(1);
    expect(await getQueue()).toHaveLength(2);
  });

  it("processes only the active owner's requests", async () => {
    await enqueue(request("user-a", "request-a"));
    await enqueue(request("user-b", "request-b"));
    const execute = vi.fn((_request: QueuedRequest) =>
      Promise.resolve({ ok: true })
    );

    const result = await processQueue("user-a", execute);

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].ownerId).toBe("user-a");
    expect(await getPendingCount("user-a")).toBe(0);
    expect(await getPendingCount("user-b")).toBe(1);
  });

  it("retains exhausted requests for recovery instead of dropping them", async () => {
    await enqueue(request("user-a", "request-a"));
    const queued = await getQueue("user-a");
    queued[0].retryCount = 3;
    mocks.values.set("@estory:sync_queue", JSON.stringify(queued));
    const execute = vi.fn((_request: QueuedRequest) =>
      Promise.resolve({ ok: true })
    );

    const result = await processQueue("user-a", execute);

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(execute).not.toHaveBeenCalled();
    expect(await getPendingCount("user-a")).toBe(1);
  });

  it("reports a failed replay attempt and keeps it queued with its error", async () => {
    await enqueue(request("user-a", "request-a"));

    const result = await processQueue("user-a", () =>
      Promise.resolve({ ok: false, error: "Server unavailable" })
    );

    expect(result).toEqual({ processed: 0, failed: 1 });
    const queued = await getQueue("user-a");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      retryCount: 1,
      lastError: "Server unavailable",
    });
  });

  it("clears one owner's queue without touching another owner", async () => {
    await enqueue(request("user-a", "request-a"));
    await enqueue(request("user-b", "request-b"));

    await clearQueue("user-a");

    expect(await getPendingCount("user-a")).toBe(0);
    expect(await getPendingCount("user-b")).toBe(1);
  });

  it("discards legacy unscoped requests rather than replaying them", async () => {
    mocks.values.set(
      "@estory:sync_queue",
      JSON.stringify([
        {
          id: "legacy",
          path: "/api/payment/create",
          method: "POST",
          body: { plan: "creator" },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ])
    );

    expect(await getQueue()).toEqual([]);
    expect(mocks.values.get("@estory:sync_queue")).toBe("[]");
  });
});
