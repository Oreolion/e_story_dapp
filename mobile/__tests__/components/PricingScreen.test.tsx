import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

jest.mock("../../stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

import PricingScreen from "../../app/pricing/index";
import { useAuthStore } from "../../stores/authStore";

const mockUseAuthStore = useAuthStore as jest.Mock;

describe("PricingScreen Google Play release", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      subscription: { plan: "free", active: false, expires_at: null },
    });
  });

  it("shows a consumption-only mobile access screen", () => {
    render(<PricingScreen />);

    expect(screen.getByText("Mobile Access")).toBeTruthy();
    expect(
      screen.getByText(
        "This Google Play release does not sell subscriptions, tokens, or digital items."
      )
    ).toBeTruthy();
    expect(screen.queryByText(/Subscribe Now/i)).toBeNull();
    expect(screen.queryByText(/USDC|\$STORY|payment address/i)).toBeNull();
  });

  it("preserves an existing account entitlement without offering checkout", () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: {
        plan: "storyteller",
        active: true,
        expires_at: "2026-12-01T00:00:00Z",
      },
    });

    render(<PricingScreen />);

    expect(screen.getByText("Storyteller plan")).toBeTruthy();
    expect(screen.getByText("Start Writing")).toBeTruthy();
  });

  it("routes signed-out users to login", () => {
    render(<PricingScreen />);

    fireEvent.press(screen.getByText("Sign In to Continue"));

    expect(router.push).toHaveBeenCalledWith("/auth/login");
  });

  it("routes signed-in users to the recording screen", () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: "free", active: false, expires_at: null },
    });

    render(<PricingScreen />);
    fireEvent.press(screen.getByText("Start Writing"));

    expect(router.push).toHaveBeenCalledWith("/record");
  });
});
