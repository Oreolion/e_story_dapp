import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), resolve: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: mocks.validate, resolveUserId: mocks.resolve, isAuthError: (value: unknown) => value instanceof Response }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from }) }));
import { GET, PUT } from "@/app/api/user/profile/route";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const preferences = { email_notifications: false, public_profile: true, ai_enhancement: false, re_engagement_emails: false };
const request = (body: unknown, expectedOwner = owner) => new NextRequest("https://estories.app/api/user/profile", {
  method: "PUT", headers: { "Content-Type": "application/json", "x-profile-owner-id": expectedOwner }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.validate.mockResolvedValue("verified-auth-subject");
  mocks.resolve.mockResolvedValue(owner);
  const query = { update: mocks.update, eq: mocks.eq, select: mocks.select, single: mocks.single };
  for (const method of [mocks.from, mocks.update, mocks.eq, mocks.select]) method.mockReturnValue(query);
  mocks.single.mockResolvedValue({ data: { id: owner }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("owner-scoped profile edits after browser write revocation", () => {
  it("rejects an unauthenticated mutation before database access", async () => {
    mocks.validate.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await PUT(request({ name: "Writer" }))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("persists profile form fields through the canonical owner", async () => {
    const updates = { name: " Writer ", username: "new_writer", bio: "My story", location: "Lagos", website: "https://example.com", email: "writer@example.com" };
    expect((await PUT(request(updates))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ ...updates, name: "Writer" });
    expect(mocks.eq).toHaveBeenCalledWith("id", owner);
  });
  it("persists all four notification preferences without browser table privileges", async () => {
    expect((await PUT(request({ notification_preferences: preferences }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ notification_preferences: preferences });
    expect(mocks.eq).toHaveBeenCalledWith("id", owner);
  });
  it("rejects a stale account edit instead of writing it to the newly signed-in account", async () => {
    expect((await PUT(request({ name: "Writer" }, other))).status).toBe(409);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects stale-account reads before looking up profile data", async () => {
    expect((await GET(new NextRequest("https://estories.app/api/user/profile", { headers: { "x-profile-owner-id": other } }))).status).toBe(409);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns settings and original creation time through the canonical owner endpoint", async () => {
    mocks.single.mockResolvedValue({ data: { id: owner, location: "Lagos", website: "https://example.com", created_at: "2026-01-01", notification_preferences: preferences }, error: null });
    const response = await GET(new NextRequest("https://estories.app/api/user/profile", { headers: { "x-profile-owner-id": owner } }));
    expect(response.status).toBe(200);
    expect((await response.json()).user).toMatchObject({ id: owner, location: "Lagos", created_at: "2026-01-01", notification_preferences: preferences });
    expect(mocks.eq).toHaveBeenCalledWith("id", owner);
  });
  it.each([
    { name: "Writer", id: other }, { name: "Writer", wallet_address: "0x" + "a".repeat(40) },
    { name: "Writer", google_id: "untrusted" }, { name: "Writer", subscription_plan: "creator" },
    { username: "bad name" }, { email: "not-an-email" }, { website: "javascript:alert(1)" },
    { website: "https://user:password@example.com" }, { bio: "x".repeat(501) },
    { notification_preferences: { ...preferences, ai_enhancement: "true" } },
    { notification_preferences: { email_notifications: false } }, null, [], {},
  ])("rejects invalid or authority-bearing updates before writing: %j", async body => {
    expect((await PUT(request(body))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects another owner's avatar", async () => {
    expect((await PUT(request({ avatar: `https://mock.supabase.co/storage/v1/object/public/avatars/${other}/avatar.png` }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("accepts the current owner's uploaded avatar", async () => {
    const avatar = `https://mock.supabase.co/storage/v1/object/public/avatars/${owner}/avatar.png`;
    expect((await PUT(request({ avatar }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ avatar });
  });
  it("bounds actual JSON bytes even when Content-Length is false", async () => {
    const oversized = request({ bio: "x".repeat(40_000) });
    oversized.headers.set("Content-Length", "1");
    expect((await PUT(oversized)).status).toBe(413);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("can explicitly clear optional contact fields and the avatar", async () => {
    expect((await PUT(request({ location: "", website: "", email: "", avatar: "" }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ location: "", website: "", email: "", avatar: "" });
  });
  it("reports a username conflict without claiming success", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect((await PUT(request({ username: "existing_writer" }))).status).toBe(409);
  });
  it("reports unavailable persistence without exposing database details", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    const response = await PUT(request({ name: "Writer" }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
  it("the profile UI does not depend on browser users-table writes revoked by migration 023", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "app/profile/ProfilePageClient.tsx"), "utf8");
    expect(/\.from\("users"\)\s*\.update\(/.test(source)).toBe(false);
    const provider = fs.readFileSync(path.resolve(process.cwd(), "components/AuthProvider.tsx"), "utf8");
    expect(/\.from\("users"\)/.test(provider)).toBe(false);
  });
});
