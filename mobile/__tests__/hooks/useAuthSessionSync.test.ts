import { act, renderHook } from "@testing-library/react";
import { AppState } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: { access_token: string } | null) => void),
  syncSessionToken: vi.fn(() => Promise.resolve()),
  unsubscribe: vi.fn(),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
      startAutoRefresh: mocks.startAutoRefresh,
      stopAutoRefresh: mocks.stopAutoRefresh,
    },
  },
}));

vi.mock("../../stores/authStore", () => ({
  useAuthStore: (selector: (state: { syncSessionToken: typeof mocks.syncSessionToken }) => unknown) =>
    selector({ syncSessionToken: mocks.syncSessionToken }),
}));

import { useAuthSessionSync } from "../../hooks/useAuthSessionSync";

describe("useAuthSessionSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener = null;
  });

  it("propagates refreshed and signed-out sessions", () => {
    const { unmount } = renderHook(() => useAuthSessionSync());

    expect(mocks.startAutoRefresh).toHaveBeenCalled();
    expect(mocks.listener).not.toBeNull();

    act(() => {
      mocks.listener?.("TOKEN_REFRESHED", { access_token: "new-token" });
      mocks.listener?.("SIGNED_OUT", null);
    });

    expect(mocks.syncSessionToken).toHaveBeenNthCalledWith(1, "new-token");
    expect(mocks.syncSessionToken).toHaveBeenNthCalledWith(2, null);

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(mocks.stopAutoRefresh).toHaveBeenCalled();
  });

  it("stops and restarts refresh with native app state", () => {
    renderHook(() => useAuthSessionSync());
    const mockAppState = AppState as typeof AppState & {
      __emit: (state: "active" | "background") => void;
    };

    act(() => mockAppState.__emit("background"));
    expect(mocks.stopAutoRefresh).toHaveBeenCalled();

    act(() => mockAppState.__emit("active"));
    expect(mocks.startAutoRefresh).toHaveBeenCalledTimes(2);
  });
});
