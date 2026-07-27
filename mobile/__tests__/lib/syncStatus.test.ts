import { describe, expect, it } from "vitest";
import { getSyncStatus } from "../../components/SyncStatusBanner";

describe("getSyncStatus", () => {
  it("stays hidden when there is nothing to sync", () => {
    expect(
      getSyncStatus({
        isOnline: true,
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
      })
    ).toBeNull();
  });

  it("shows owner-visible queued work while offline", () => {
    expect(
      getSyncStatus({
        isOnline: false,
        isSyncing: false,
        pendingCount: 2,
        failedCount: 0,
      })?.label
    ).toBe("Offline · 2 stories waiting");
  });

  it("surfaces failed replay attempts instead of hiding them", () => {
    expect(
      getSyncStatus({
        isOnline: true,
        isSyncing: false,
        pendingCount: 1,
        failedCount: 1,
      })?.label
    ).toBe("Sync needs attention · 1 waiting");
  });
});
