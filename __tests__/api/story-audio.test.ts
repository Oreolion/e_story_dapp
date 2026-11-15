import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), resolve: vi.fn(), from: vi.fn(), sign: vi.fn(), insert: vi.fn(), story: {} as Record<string, unknown> }));
vi.mock("@/lib/auth", () => ({ validateAuth: mocks.auth, validateAuthOrReject: mocks.auth, resolveUserId: mocks.resolve, isAuthError: (value: unknown) => value instanceof Response }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.sign }) } }) }));
vi.mock("@/lib/ai/availability", () => ({ aiGenerationHold: () => ({ code: "AI_DISABLED" }) }));
import { GET } from "@/app/api/stories/[storyId]/route";
import { POST as saveStory } from "@/app/api/stories/route";
import { POST as saveJournal } from "@/app/api/journal/save/route";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const storyId = "33333333-3333-4333-8333-333333333333";
const base = "https://mock.supabase.co/storage/v1/object/public/story-audio/";
const ownUrl = `${base}${owner}/123.webm`;
const detail = () => GET(new NextRequest(`https://estories.app/api/stories/${storyId}`), { params: Promise.resolve({ storyId }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://mock.supabase.co");
  mocks.auth.mockResolvedValue("verified-auth-subject-different-from-domain-id");
  mocks.resolve.mockResolvedValue(owner);
  mocks.story = { id: storyId, author_id: owner, is_public: true, audio_url: ownUrl, has_audio: true };
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://mock.supabase.co/synthetic-signed-audio" }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), update: vi.fn(() => query),
      insert: mocks.insert.mockImplementation(() => query),
      maybeSingle: vi.fn(async () => ({ data: { ...mocks.story }, error: null })),
      single: vi.fn(async () => ({ data: table === "users" ? { id: owner, wallet_address: null } : { id: storyId }, error: null })),
      or: vi.fn(async () => ({ data: [], error: null })),
      order: vi.fn(async () => ({ data: [], error: null })),
    };
    return query;
  });
});

describe("audio signing with a service-role client", () => {
  it("signs the author's canonical upload using the resolved domain ID", async () => {
    const response = await detail();
    expect(response.status).toBe(200);
    expect(mocks.sign).toHaveBeenCalledExactlyOnceWith(`${owner}/123.webm`, 3600);
    expect((await response.json()).story.audio_url).toContain("synthetic-signed-audio");
  });

  const unsafeUrls = [
    `${base}${other}/123.webm`,
    `https://attacker.example/story-audio/${owner}/123.webm`,
    `https://attacker.example/?file=/story-audio/${owner}/123.webm`,
    `${base}${owner}/../${other}/123.webm`,
    `${base}${owner}/%2e%2e%2f${other}%2f123.webm`,
    `${base}${owner}/123.webm?download=1`,
    `${base}${owner}/123.webm#fragment`,
    `${base}${owner}/nested/123.webm`,
    ownUrl.replace("https://", "https://user:password@"),
  ];
  it.each(unsafeUrls)("does not sign an unsafe stored reference: %s", async audio_url => {
    mocks.story.audio_url = audio_url;
    const response = await detail();
    expect(response.status).toBe(200);
    expect((await response.json()).story.audio_url).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it.each([null, other])("never signs for an anonymous or different viewer: %s", async viewer => {
    mocks.auth.mockResolvedValue(viewer ? "other-auth-subject" : null);
    mocks.resolve.mockResolvedValue(viewer);
    const response = await detail();
    expect(response.status).toBe(200);
    expect((await response.json()).story.audio_url).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("does not reveal a private story to a different account", async () => {
    mocks.story.is_public = false;
    mocks.resolve.mockResolvedValue(other);
    expect((await detail()).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("does not fall back to a public URL when signing fails", async () => {
    mocks.sign.mockResolvedValue({ data: null, error: null });
    const response = await detail();
    expect((await response.json()).story.audio_url).toBeNull();
  });

  describe.each([["stories", saveStory], ["journal/save", saveJournal]] as const)("POST %s", (path, save) => {
    const request = (audio_url: string) => new NextRequest(`https://estories.app/api/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: owner, title: "Synthetic story", content: "Synthetic text", is_public: true, audio_url, has_audio: true }),
    });
    it.each(unsafeUrls)("rejects unsafe audio before any database access: %s", async url => {
      expect((await save(request(url))).status).toBe(400);
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
    });
    it("accepts an own upload", async () => {
      expect((await save(request(ownUrl))).status).toBe(200);
      expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ author_id: owner, audio_url: ownUrl }));
    });
  });
});
