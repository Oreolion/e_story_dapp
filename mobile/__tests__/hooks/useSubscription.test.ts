// Tests for useSubscription hook
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSubscription } from "../../hooks/useSubscription";

// Mock the API client
const mockApi = vi.fn();
vi.mock("../../lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

// Mock auth store
const mockRefreshSubscription = vi.fn();
const mockSubscription = { plan: "free", active: false, expires_at: null };

vi.mock("../../stores/authStore", () => ({
  useAuthStore: () => ({
    subscription: mockSubscription,
    refreshSubscription: mockRefreshSubscription,
  }),
}));

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with free plan status", () => {
    const { result } = renderHook(() => useSubscription());

    expect(result.current.status.plan).toBe("free");
    expect(result.current.status.active).toBe(false);
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.creatingPlan).toBeNull();
    expect(result.current.verifying).toBe(false);
  });

  it("should sync with auth store subscription on mount", () => {
    const { result } = renderHook(() => useSubscription());

    // Mobile hook syncs with auth store, not auto-fetching on mount
    expect(result.current.status.plan).toBe("free");
    expect(result.current.status.active).toBe(false);
  });

  it("should create payment and show payment info", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      data: {
        address: "0xABC123",
        amount: 2.99,
        currency: "USDC",
        plan: "storyteller",
        network: "Base",
        note: "Send exactly the amount shown",
      },
    });

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.subscribe("storyteller");
    });

    await waitFor(() => {
      expect(result.current.paymentInfo).not.toBeNull();
    });

    expect(result.current.paymentInfo?.address).toBe("0xABC123");
    expect(result.current.paymentInfo?.amount).toBe(2.99);
    expect(result.current.paymentInfo?.currency).toBe("USDC");
    expect(mockApi).toHaveBeenCalledWith("/api/payment/create", {
      method: "POST",
      body: { plan: "storyteller" },
    });
  });

  it("should handle auto-activated payment", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      data: {
        activated: true,
        plan: "storyteller",
        expires_at: "2026-06-01T00:00:00Z",
      },
    });

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.subscribe("storyteller");
    });

    await waitFor(() => {
      expect(mockRefreshSubscription).toHaveBeenCalled();
    });

    expect(result.current.paymentInfo).toBeNull();
  });

  it("should throw on payment creation failure", async () => {
    mockApi.mockResolvedValueOnce({
      ok: false,
      error: "Invalid plan",
    });

    const { result } = renderHook(() => useSubscription());

    await expect(result.current.subscribe("invalid")).rejects.toThrow("Invalid plan");
  });

  it("should verify payment and clear payment info on success", async () => {
    mockApi
      .mockResolvedValueOnce({
        ok: true,
        data: {
          address: "0xABC123",
          amount: 2.99,
          currency: "USDC",
          plan: "storyteller",
          network: "Base",
          note: "Send USDC",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { verified: true, message: "Payment confirmed!" },
      });

    const { result } = renderHook(() => useSubscription());

    // Create payment first
    await act(async () => {
      await result.current.subscribe("storyteller");
    });

    await waitFor(() => {
      expect(result.current.paymentInfo).not.toBeNull();
    });

    // Verify payment
    await act(async () => {
      const verifyResult = await result.current.verifyPayment();
      expect(verifyResult.verified).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.paymentInfo).toBeNull();
    });

    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it("should return not verified when no deposit found", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      data: { verified: false, message: "No deposit found yet" },
    });

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      const verifyResult = await result.current.verifyPayment();
      expect(verifyResult.verified).toBe(false);
      expect(verifyResult.message).toBe("No deposit found yet");
    });
  });

  it("should poll for payment status when paymentInfo is set", async () => {
    mockApi
      .mockResolvedValueOnce({
        ok: true,
        data: {
          address: "0xABC123",
          amount: 2.99,
          currency: "USDC",
          plan: "storyteller",
          network: "Base",
          note: "Send USDC",
        },
      })
      .mockResolvedValue({
        ok: true,
        data: { plan: "storyteller", active: true, expires_at: "2026-06-01T00:00:00Z" },
      });

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.subscribe("storyteller");
    });

    await waitFor(() => {
      expect(result.current.paymentInfo).not.toBeNull();
    });

    // Fast-forward 15 seconds (polling interval)
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/api/payment/status");
    });
  }, 10000);

  it("should clear payment info", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      data: {
        address: "0xABC123",
        amount: 2.99,
        currency: "USDC",
        plan: "storyteller",
        network: "Base",
        note: "Send USDC",
      },
    });

    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await result.current.subscribe("storyteller");
    });

    await waitFor(() => {
      expect(result.current.paymentInfo).not.toBeNull();
    });

    act(() => {
      result.current.clearPaymentInfo();
    });

    expect(result.current.paymentInfo).toBeNull();
  });
});
