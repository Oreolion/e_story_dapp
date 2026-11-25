import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
vi.mock("next/script", () => ({
  default: ({ id }: { id: string }) => <div data-testid={id} />,
}));
import {
  CookieConsent,
  CookiePreferencesButton,
  getConsent,
} from "@/components/CookieConsent";

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("optional marketing consent", () => {
  it("offers equal choices and supports changing a saved preference", () => {
    render(
      <>
        <CookieConsent />
        <CookiePreferencesButton />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(getConsent()).toBe("essential");
    expect(
      screen.queryByRole("button", { name: "Accept all" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(getConsent()).toBe("all");
  });
  it("does not render the pixel before consent and revokes after an essential-only choice", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
    const { MetaPixel } = await import("@/components/MetaPixel");
    const fbq = vi.fn();
    window.fbq = fbq;
    render(
      <>
        <MetaPixel />
        <CookieConsent />
        <CookiePreferencesButton />
      </>,
    );
    expect(screen.queryByTestId("meta-pixel-base")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(await screen.findByTestId("meta-pixel-base")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    await waitFor(() =>
      expect(screen.queryByTestId("meta-pixel-base")).not.toBeInTheDocument(),
    );
    expect(fbq).toHaveBeenLastCalledWith("consent", "revoke");
    act(() => {
      localStorage.removeItem("estories_cookie_consent");
      window.dispatchEvent(new Event("consentUpdated"));
    });
  });
  it("keeps marketing denied when saving a new preference fails", async () => {
    localStorage.setItem("estories_cookie_consent", "all");
    render(
      <>
        <CookieConsent />
        <CookiePreferencesButton />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(getConsent()).toBe("essential");
    expect(screen.getByRole("status")).toHaveTextContent(/could not save/);
    // Restore normal persistence, clearing the page-lifetime denial for other tests.
    vi.restoreAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
  });
});
