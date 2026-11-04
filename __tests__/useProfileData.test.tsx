import React, { type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ token: vi.fn(), from: vi.fn(), loading: false }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ getAccessToken: mocks.token, isLoading: mocks.loading }) }));
vi.mock("@/app/utils/supabase/supabaseClient", () => ({ supabaseClient: { from: mocks.from } }));
import { useProfileData } from "@/lib/queries/hooks";

const owner = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();
function ProfileTestProvider({ children }: PropsWithChildren) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loading = false;
  mocks.token.mockResolvedValue("synthetic-access-token");
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ user: { id: owner, name: "Writer" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("self profile transport", () => {
  it("loads through authenticated same-origin API with an owner precondition", async () => {
    const { result } = renderHook(() => useProfileData(owner), { wrapper: ProfileTestProvider });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: owner, name: "Writer" });
    expect(fetchMock).toHaveBeenCalledWith("/api/user/profile", expect.objectContaining({
      credentials: "same-origin", headers: expect.objectContaining({ Authorization: "Bearer synthetic-access-token", "x-profile-owner-id": owner }),
    }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not load while authentication is being resolved", () => {
    mocks.loading = true;
    renderHook(() => useProfileData(owner), { wrapper: ProfileTestProvider });
    expect(mocks.token).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not retry a stale-account rejection or expose a profile", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: "Account changed" }), { status: 409 }));
    const { result } = renderHook(() => useProfileData(owner), { wrapper: ProfileTestProvider });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });
  it("rejects a mismatched profile even if an older server ignores the owner header", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ user: { id: "another-profile" } }), { status: 200 }));
    const { result } = renderHook(() => useProfileData(owner), { wrapper: ProfileTestProvider });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
