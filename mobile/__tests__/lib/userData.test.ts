import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  removeItem: vi.fn(() => Promise.resolve()),
  clearQueue: vi.fn(() => Promise.resolve()),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { removeItem: mocks.removeItem },
}));

vi.mock("../../lib/offline", () => ({
  clearQueue: mocks.clearQueue,
}));

import {
  clearUserLocalData,
  getRecordDraftKey,
} from "../../lib/userData";

describe("user-scoped local data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a distinct record draft key per account", () => {
    expect(getRecordDraftKey("user-a")).toBe("estories_record_draft:user-a");
    expect(getRecordDraftKey("user-b")).toBe("estories_record_draft:user-b");
  });

  it("preserves only the scoped draft on an expired session", async () => {
    await clearUserLocalData({ ownerId: "user-a", preserveDraft: true });

    expect(mocks.clearQueue).toHaveBeenCalled();
    expect(mocks.removeItem).toHaveBeenCalledWith("estories_record_draft");
    expect(mocks.removeItem).not.toHaveBeenCalledWith(
      "estories_record_draft:user-a"
    );
  });

  it("removes the scoped draft on explicit logout", async () => {
    await clearUserLocalData({ ownerId: "user-a" });

    expect(mocks.removeItem).toHaveBeenCalledWith("estories_record_draft");
    expect(mocks.removeItem).toHaveBeenCalledWith(
      "estories_record_draft:user-a"
    );
  });
});
