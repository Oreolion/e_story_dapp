import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    profile: null,
    isLoading: false,
    needsOnboarding: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));
// A connected wallet is not itself an authenticated app account.
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: true }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}));
import { AuthButton } from "@/components/AuthButton";
describe("standard login entry", () => {
  it("keeps login usable with a connected wallet and no authenticated profile", () => {
    render(<AuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Continue with a wallet" }),
    ).toBeVisible();
  });
  it("offers a separate signup entry using the existing Google onboarding", () => {
    render(<AuthButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Create your eStories account" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(screen.getByText(/choose your profile/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue with a wallet" })).toBeVisible();
  });
});
