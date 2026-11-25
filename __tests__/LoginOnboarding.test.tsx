import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
const mocks = vi.hoisted(() => ({
  google: vi.fn(),
  wallet: vi.fn(),
  complete: vi.fn(),
  replace: vi.fn(),
  profile: {
    id: "synthetic-google",
    name: "Writer",
    email: "writer@example.com",
    auth_provider: "google",
  } as {
    id: string;
    name: string;
    email: string;
    auth_provider: string;
    username?: string;
  } | null,
  needsOnboarding: true,
  isLoading: false,
}));
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    signInWithGoogle: mocks.google,
    profile: mocks.profile,
    needsOnboarding: mocks.needsOnboarding,
    isLoading: mocks.isLoading,
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
beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile = {
    id: "synthetic-google",
    name: "Writer",
    email: "writer@example.com",
    auth_provider: "google",
  };
  mocks.needsOnboarding = true;
  mocks.isLoading = false;
});
describe("wallet-optional login and onboarding", () => {
  it("returns keyboard focus to the login control after dismissal", async () => {
    function Login() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Log in</button>
          <AuthModal isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Login />);
    const opener = screen.getByRole("button", { name: "Log in" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });
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
  it("switches between login and signup without invoking either provider", () => {
    render(<AuthModal isOpen onClose={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign up", exact: true }),
    );
    expect(
      screen.getByRole("heading", { name: "Create your eStories account" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Log in", exact: true }),
    );
    expect(
      screen.getByRole("heading", { name: "Log in to eStories" }),
    ).toBeVisible();
    expect(mocks.google).not.toHaveBeenCalled();
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it("starts Google only once while sign-in is pending", async () => {
    let finish!: () => void;
    mocks.google.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<AuthModal isOpen onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.google).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Opening Google…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Continue with a wallet" }),
    ).toBeDisabled();
    await act(async () => finish());
  });
  it("rejects an invalid username without sending the profile", () => {
    render(<Onboarding />);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "bad name" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Start my first story" })
        .closest("form")!,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("3–20");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("saves the profile only once and waits for persistence before navigating", async () => {
    let finish!: () => void;
    mocks.complete.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Onboarding />);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "writer_1" },
    });
    const form = screen
      .getByRole("button", { name: "Start my first story" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Saving your profile…" }),
    ).toBeDisabled();
    await act(async () => finish());
    expect(mocks.replace).toHaveBeenCalledWith("/record");
  });
  it("redirects signed-out visitors without presenting an editable profile", () => {
    mocks.profile = null;
    render(<Onboarding />);
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });
  it("sends already-onboarded users to recording without asking again", () => {
    mocks.needsOnboarding = false;
    render(<Onboarding />);
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/record");
  });
  it("prefills the newly selected account instead of retaining another account's input", async () => {
    const view = render(<Onboarding />);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "writer_1" },
    });
    mocks.profile = {
      id: "other-synthetic",
      name: "Another Writer",
      email: "another@example.com",
      auth_provider: "google",
    };
    view.rerender(<Onboarding />);
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Another Writer"),
    );
    expect(screen.getByLabelText("Email")).toHaveValue("another@example.com");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
