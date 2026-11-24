import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  google: vi.fn(),
  wallet: vi.fn(),
  complete: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    signInWithGoogle: mocks.google,
    profile: {
      id: "synthetic-google",
      name: "Writer",
      email: "writer@example.com",
      auth_provider: "google",
    },
    needsOnboarding: true,
    isLoading: false,
    completeOnboarding: mocks.complete,
  }),
}));
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: mocks.wallet }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/meta-pixel", () => ({ trackCompleteRegistration: vi.fn() }));
import { AuthModal } from "@/components/AuthModal";
import Onboarding from "@/app/onboarding/OnboardingPageClient";
beforeEach(() => vi.resetAllMocks());
describe("wallet-optional login and onboarding", () => {
  it("offers Google first and reports failures without dismissing login", async () => {
    mocks.google.mockRejectedValue(new Error("private-provider-detail"));
    const close = vi.fn();
    render(<AuthModal isOpen onClose={close} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    expect(await screen.findByRole("alert")).not.toHaveTextContent(
      "private-provider-detail",
    );
    expect(close).not.toHaveBeenCalled();
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it("completes a Google profile and goes straight to recording", async () => {
    mocks.complete.mockResolvedValue(undefined);
    render(<Onboarding />);
    expect(screen.getByLabelText("Name")).toHaveValue("Writer");
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "writer_1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Start my first story" }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/record"));
    expect(mocks.complete).toHaveBeenCalledWith({
      name: "Writer",
      username: "writer_1",
      email: "writer@example.com",
    });
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it("keeps the form on persistence failure and does not claim completion", async () => {
    mocks.complete.mockRejectedValue(new Error("private-database-detail"));
    render(<Onboarding />);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "writer_1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Start my first story" }),
    );
    expect(await screen.findByRole("alert")).not.toHaveTextContent(
      "private-database-detail",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
