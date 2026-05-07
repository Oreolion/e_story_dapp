// Tests for authStore subscription functionality
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be at the top — vi.mock is hoisted
vi.mock("../../lib/storage", () => ({
  removeItem: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve()),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: { session: null }, error: new Error("Not mocked") })),
      signUp: vi.fn(() => Promise.resolve({ data: { session: null, user: null }, error: new Error("Not mocked") })),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      setSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: new Error("Not mocked") })),
      verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
  },
}));

vi.mock("../../lib/api", () => ({
  api: vi.fn(),
  setAuthToken: vi.fn(() => Promise.resolve()),
  clearAuthToken: vi.fn(() => Promise.resolve()),
}));

import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

const mockApi = vi.mocked(api);

describe("authStore subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      authMethod: null,
      subscription: { plan: "free", active: false, expires_at: null },
    });
  });

  it("should have default subscription state as free", () => {
    const state = useAuthStore.getState();
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
    expect(state.subscription.expires_at).toBeNull();
  });

  it("should refresh subscription from API", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { plan: "creator", active: true, expires_at: "2026-12-01T00:00:00Z" },
    });

    await useAuthStore.getState().refreshSubscription();

    const state = useAuthStore.getState();
    expect(state.subscription.plan).toBe("creator");
    expect(state.subscription.active).toBe(true);
    expect(state.subscription.expires_at).toBe("2026-12-01T00:00:00Z");
    expect(mockApi).toHaveBeenCalledWith("/api/payment/status");
  });

  it("should handle subscription API failure gracefully", async () => {
    mockApi.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await expect(useAuthStore.getState().refreshSubscription()).resolves.toBeUndefined();

    const state = useAuthStore.getState();
    // State should remain unchanged (default free)
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
  });

  it("should reset subscription on logout", async () => {
    // Set active subscription first
    useAuthStore.setState({
      subscription: { plan: "storyteller", active: true, expires_at: "2026-06-01T00:00:00Z" },
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
    expect(state.subscription.expires_at).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should reset subscription on deleteAccount", async () => {
    mockApi.mockResolvedValueOnce({ ok: true, status: 200 });

    useAuthStore.setState({
      subscription: { plan: "creator", active: true, expires_at: "2026-12-01T00:00:00Z" },
      isAuthenticated: true,
    });

    await useAuthStore.getState().deleteAccount();

    const state = useAuthStore.getState();
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
    expect(state.subscription.expires_at).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should include subscription fields in UserProfile type", () => {
    const mockUser = {
      id: "user-123",
      name: "Test User",
      username: "testuser",
      avatar: null,
      wallet_address: null,
      email: "test@example.com",
      bio: null,
      badges: null,
      google_id: null,
      subscription_plan: "storyteller",
      subscription_expires_at: "2026-06-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
    };

    // Update store with user that has subscription fields
    useAuthStore.setState({ user: mockUser });

    const state = useAuthStore.getState();
    expect(state.user?.subscription_plan).toBe("storyteller");
    expect(state.user?.subscription_expires_at).toBe("2026-06-01T00:00:00Z");
  });

  it("should handle API returning 404 for subscription status", async () => {
    mockApi.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "Not found",
    });

    await useAuthStore.getState().refreshSubscription();

    const state = useAuthStore.getState();
    // Should keep default free state when API fails
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
  });

  it("should handle API returning free plan explicitly", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { plan: "free", active: false, expires_at: null },
    });

    await useAuthStore.getState().refreshSubscription();

    const state = useAuthStore.getState();
    expect(state.subscription.plan).toBe("free");
    expect(state.subscription.active).toBe(false);
    expect(state.subscription.expires_at).toBeNull();
  });
});
