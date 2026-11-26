import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  validateAuthOrReject: mocks.auth,
  isAuthError: (value: unknown) => value instanceof Response,
}));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock("@/components/emails/WelcomeEmail", () => ({ default: () => null }));
vi.mock("@/lib/unsubscribeToken", () => ({
  buildUnsubscribeUrl: () => "https://synthetic.invalid/unsubscribe",
}));
vi.mock("@/lib/runtime/config", () => ({ assertEmailRecipient: vi.fn() }));
import { POST } from "@/app/api/auth/onboarding/route";
const owner = "11111111-1111-4111-8111-111111111111";
const valid = {
  userId: owner,
  name: "Writer",
  username: "writer_1",
  email: "writer@example.com",
};
const request = (body: unknown) =>
  new NextRequest("https://synthetic.invalid/api/auth/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(owner);
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    neq: mocks.neq,
    maybeSingle: mocks.maybeSingle,
    update: mocks.update,
    single: mocks.single,
    insert: mocks.insert,
  };
  for (const method of [
    mocks.from,
    mocks.select,
    mocks.eq,
    mocks.neq,
    mocks.update,
  ])
    method.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.single.mockResolvedValue({
    data: { id: owner, ...valid, is_onboarded: true },
    error: null,
  });
  mocks.send.mockResolvedValue({
    data: { id: "synthetic-email" },
    error: null,
  });
  mocks.insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
describe("existing owner-scoped onboarding endpoint", () => {
  it("rejects unauthenticated requests before database or email access", async () => {
    mocks.auth.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await POST(request(valid))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects onboarding another account", async () => {
    expect(
      (await POST(request({ ...valid, userId: "another-account" }))).status,
    ).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("persists completion for the authenticated owner and returns the saved profile", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      name: "Writer",
      username: "writer_1",
      email: "writer@example.com",
      is_onboarded: true,
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", owner);
    expect((await response.json()).user).toMatchObject({
      id: owner,
      is_onboarded: true,
    });
  });
  it.each([{ username: "bad name" }, { name: "A" }, { email: "invalid" }])(
    "rejects invalid profile fields before writing: %j",
    async (change) => {
      expect((await POST(request({ ...valid, ...change }))).status).toBe(400);
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("reports a reserved username without marking onboarding complete", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "other-owner" },
      error: null,
    });
    expect((await POST(request(valid))).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("handles a concurrent username conflict without claiming a saved profile", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "username uniqueness conflict" },
    });
    const response = await POST(request(valid));
    expect(response.status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
    expect((await response.json()).success).not.toBe(true);
  });
  it("retains successful onboarding when the optional welcome email fails", async () => {
    mocks.send.mockRejectedValue(new Error("synthetic email outage"));
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect((await response.json()).user.is_onboarded).toBe(true);
  });
});
