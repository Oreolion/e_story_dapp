import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPendingCount: vi.fn(),
  isOnline: vi.fn().mockResolvedValue(true),
  onNetworkChange: vi.fn().mockReturnValue(vi.fn()),
  processQueue: vi.fn(),
}));

vi.mock("../../lib/offline", () => ({
  getPendingCount: mocks.getPendingCount,
  isOnline: mocks.isOnline,
  onNetworkChange: mocks.onNetworkChange,
  processQueue: mocks.processQueue,
}));

import { useSyncStore } from "../../stores/syncStore";

describe("syncStore owner scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({
      activeOwnerId: null,
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: null,
      lastSyncResult: null,
    });
  });

  it("does not let a stale owner count overwrite the active account", async () => {
    let resolveFirstOwner!: (count: number) => void;
    mocks.getPendingCount.mockImplementation((ownerId: string) => {
      if (ownerId === "user-a") {
        return new Promise<number>((resolve) => {
          resolveFirstOwner = resolve;
        });
      }
      return Promise.resolve(2);
    });

    const firstRefresh =
      useSyncStore.getState().refreshPendingCount("user-a");
    const secondRefresh =
      useSyncStore.getState().refreshPendingCount("user-b");

    await secondRefresh;
    resolveFirstOwner(5);
    await firstRefresh;

    expect(useSyncStore.getState()).toMatchObject({
      activeOwnerId: "user-b",
      pendingCount: 2,
    });
  });

  it("keeps sync results attached to the owner that is still active", async () => {
    let finishSync!: (result: { processed: number; failed: number }) => void;
    mocks.processQueue.mockReturnValue(
      new Promise((resolve) => {
        finishSync = resolve;
      })
    );
    mocks.getPendingCount.mockResolvedValue(0);

    const syncPromise = useSyncStore
      .getState()
      .sync("user-a", vi.fn());
    await useSyncStore.getState().refreshPendingCount("user-b");
    finishSync({ processed: 1, failed: 0 });
    await syncPromise;

    expect(useSyncStore.getState()).toMatchObject({
      activeOwnerId: "user-b",
      pendingCount: 0,
      lastSyncAt: null,
      lastSyncResult: null,
      isSyncing: false,
    });
  });
});
