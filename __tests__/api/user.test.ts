import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(), resolve: vi.fn(), rpc: vi.fn(), deleteAuth: vi.fn(),
  list: vi.fn(), remove: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  validateAuthOrReject: mocks.validate,
  resolveUserId: mocks.resolve,
  isAuthError: (value: unknown) => value instanceof Response,
}));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: mocks.rpc,
    storage: { from: mocks.from },
    auth: { admin: { deleteUser: mocks.deleteAuth } },
  }),
}));
import { DELETE } from "@/app/api/user/route";
const request = () => new NextRequest("https://estories.app/api/user", { method: "DELETE" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validate.mockResolvedValue("auth-id");
  mocks.resolve.mockResolvedValue("profile-id");
  mocks.from.mockReturnValue({ list: mocks.list, remove: mocks.remove });
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.deleteAuth.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DELETE /api/user", () => {
  it("rejects unauthenticated requests before accessing storage or database", async () => {
    mocks.validate.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await DELETE(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses the linked domain ID for data and the auth ID for identity removal", async () => {
    expect((await DELETE(request())).status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith("profile-id", expect.any(Object));
    expect(mocks.rpc).toHaveBeenCalledWith("delete_user_account_data", { p_user_id: "profile-id" });
    expect(mocks.deleteAuth).toHaveBeenCalledWith("auth-id");
    expect(mocks.deleteAuth.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.rpc.mock.invocationCallOrder[0]);
  });
  it("enumerates pages before removing objects in batches", async () => {
    mocks.list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => ({ name: `${index}.mp3` })), error: null });
    mocks.list.mockResolvedValueOnce({ data: [{ name: "last.mp3" }], error: null });
    expect((await DELETE(request())).status).toBe(200);
    expect(mocks.list).toHaveBeenNthCalledWith(2, "profile-id", expect.objectContaining({ offset: 100 }));
    expect(mocks.remove.mock.calls[0][0]).toHaveLength(100);
    expect(mocks.remove.mock.calls[1][0]).toEqual(["profile-id/last.mp3"]);
  });
  it("does not delete database or auth identity when storage enumeration fails", async () => {
    mocks.list.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await DELETE(request())).status).toBe(500);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deleteAuth).not.toHaveBeenCalled();
  });
  it("does not delete database or auth identity when media removal fails", async () => {
    mocks.list.mockResolvedValueOnce({ data: [{ name: "audio.mp3" }], error: null });
    mocks.remove.mockResolvedValue({ error: { message: "offline" } });
    expect((await DELETE(request())).status).toBe(500);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deleteAuth).not.toHaveBeenCalled();
  });
  it("does not remove sign-in or report success when the database RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "database unavailable" } });
    const response = await DELETE(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to delete account data" });
    expect(mocks.deleteAuth).not.toHaveBeenCalled();
  });
  it("accepts missing wallet-only auth identities and clears the wallet cookie", async () => {
    mocks.deleteAuth.mockResolvedValue({ error: { status: 404 } });
    const response = await DELETE(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("estory_wallet_token=;");
  });
  it("reports partial completion if auth identity removal fails", async () => {
    mocks.deleteAuth.mockResolvedValue({ error: { status: 503 } });
    const response = await DELETE(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("sign-in removal is still processing");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
