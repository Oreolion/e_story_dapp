import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authDestination,
  clearDestination,
  pendingDestination,
  rememberDestination,
  safeDestination,
} from "@/lib/auth/navigation";
afterEach(() => {
  clearDestination();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
describe("post-authentication navigation", () => {
  const state = {
    loading: false,
    authenticated: true,
    onboarding: false,
    pathname: "/",
    intent: null,
  };
  it("defaults returning users to Home but keeps deep links", () => {
    expect(authDestination(state)).toBe("/home");
    expect(authDestination({ ...state, pathname: "/library" })).toBeNull();
    expect(authDestination({ ...state, pathname: "/welcome" })).toBeNull();
  });
  it("waits for auth and profile setup before resuming an explicit task", () => {
    expect(authDestination({ ...state, loading: true })).toBeNull();
    expect(authDestination({ ...state, authenticated: false })).toBeNull();
    expect(
      authDestination({ ...state, onboarding: true, intent: "/record" }),
    ).toBe("/onboarding");
    expect(
      authDestination({ ...state, pathname: "/onboarding", intent: "/record" }),
    ).toBeNull();
    expect(
      authDestination({ ...state, intent: "/record?parentId=synthetic-story" }),
    ).toBe("/record?parentId=synthetic-story");
  });
  it.each([
    "//evil.invalid",
    "https://evil.invalid/record",
    "/\\evil.invalid",
    "/record/../admin",
    "/%2f%2fevil.invalid",
    "/api/user",
    "/record?token=secret",
    "/home#bad",
    "/record?mode=interview?next=evil",
  ])("rejects unsafe destinations: %s", (value) =>
    expect(safeDestination(value)).toBeNull(),
  );
  it("expires hints and tolerates blocked storage", () => {
    rememberDestination("/record");
    expect(pendingDestination()).toBe("/record");
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60000);
    expect(pendingDestination()).toBeNull();
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error();
    });
    rememberDestination("/library");
    sessionStorage.clear();
    expect(pendingDestination()).toBe("/library");
    clearDestination();
    expect(pendingDestination()).toBeNull();
  });
});
