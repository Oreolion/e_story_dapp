import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ create: vi.fn(), exchange: vi.fn() }));
vi.mock("@/app/utils/supabase/supabaseServer", () => ({
  createSupabaseServerClient: mocks.create,
}));
import { GET } from "@/app/api/auth/callback/route";

const origin = "https://synthetic.invalid";
function request(next?: string, code: string | null = "synthetic-code") {
  const url = new URL("/api/auth/callback", origin);
  if (code !== null) url.searchParams.set("code", code);
  if (next !== undefined) url.searchParams.set("next", next);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchange },
  });
  mocks.exchange.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("Google OAuth callback boundary", () => {
  it("does not exchange a session when the authorization code is missing", async () => {
    const response = await GET(request("/record", null));
    expect(response.headers.get("location")).toBe(`${origin}/`);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("exchanges the code once and removes it from the destination", async () => {
    const response = await GET(request());
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.exchange).toHaveBeenCalledWith("synthetic-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${origin}/`);
  });

  it.each([
    "/record",
    "/profile",
    "/library",
    "/books",
    "/books/synthetic-book",
    "/social",
    "/tracker",
    "/record?mode=interview",
  ])("preserves an allowed same-origin destination: %s", async (next) => {
    const response = await GET(request(next));
    expect(response.headers.get("location")).toBe(`${origin}${next}`);
  });

  it.each([
    "https://external.invalid/record",
    "//external.invalid/record",
    "/\\external.invalid/record",
    "/record/../../admin",
    "/admin",
    "/recording",
    "/api/user/profile",
  ])("rejects an unapproved destination: %s", async (next) => {
    const response = await GET(request(next));
    expect(response.headers.get("location")).toBe(`${origin}/`);
  });

  it("fails closed when code exchange is rejected", async () => {
    mocks.exchange.mockResolvedValue({
      error: { message: "synthetic provider detail" },
    });
    const response = await GET(request("/record"));
    expect(response.headers.get("location")).toBe(
      `${origin}/?auth_error=exchange_failed`,
    );
  });

  it("returns a generic failure destination when the client cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValue(new Error("synthetic failure"));
    const response = await GET(request("/record"));
    expect(response.headers.get("location")).toBe(`${origin}/?auth_error=true`);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
