import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const effects = vi.hoisted(() => ({ admin: vi.fn(), authenticate: vi.fn(), resolve: vi.fn(), transcriber: vi.fn() }));
vi.mock("@elevenlabs/elevenlabs-js", () => ({ ElevenLabsClient: effects.transcriber }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: effects.admin }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: effects.authenticate, resolveUserId: effects.resolve, isAuthError: (value: unknown) => value instanceof Response }));
import { POST as enhance } from "@/app/api/ai/enhance/route";
import { POST as analyze } from "@/app/api/ai/analyze/route";
import { POST as reflect, GET as reflections } from "@/app/api/ai/reflection/route";
import { POST as save } from "@/app/api/journal/save/route";
import { POST as transcribe } from "@/app/api/ai/transcribe/route";
import { GET as metadata } from "@/app/api/stories/[storyId]/metadata/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_RELEASE_MODE", "active");
  vi.stubEnv("AI_PROVIDER_MODE", "disabled");
  effects.authenticate.mockResolvedValue("synthetic-subject");
  effects.resolve.mockResolvedValue("11111111-1111-4111-8111-111111111111");
});

const request = () => new NextRequest("https://synthetic.invalid/api/ai/test", { method: "POST", body: JSON.stringify({ text: "Synthetic text", storyId: "22222222-2222-4222-8222-222222222222" }), headers: { "Content-Type": "application/json" } });

it.each([["editing", enhance], ["analysis", analyze], ["reflection", reflect], ["transcription", transcribe]] as const)("explains the %s hold before quota, content reads or inference", async (_name, handler) => {
  const response = await handler(request());
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ code: "AI_PROVIDER_SETUP_REQUIRED", error: expect.stringContaining("unavailable") });
  expect(effects.admin).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(effects.transcriber).not.toHaveBeenCalled();
});

it.each([enhance, analyze, reflect, transcribe])("keeps authentication ahead of the disabled-feature response", async handler => {
  effects.authenticate.mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await handler(request())).status).toBe(401);
  expect(effects.resolve).not.toHaveBeenCalled();
  expect(effects.admin).not.toHaveBeenCalled();
});

it("still saves a journal while reporting the hold instead of promising processing", async () => {
  const inserted = vi.fn();
  const story = { id: "22222222-2222-4222-8222-222222222222", revision: 1 };
  const owner = { select: () => owner, eq: () => owner, single: async () => ({ data: { wallet_address: null, subscription_plan: "free" }, error: null }) };
  const write = { insert: (value: unknown) => { inserted(value); return write; }, select: () => write, single: async () => ({ data: story, error: null }) };
  effects.admin.mockReturnValue({ from: (table: string) => table === "users" ? owner : write });
  const response = await save(new NextRequest("https://synthetic.invalid/api/journal/save", { method: "POST", body: JSON.stringify({ content: "A synthetic entry with enough text for analysis, kept private and saved while AI setup is pending.", is_public: false }), headers: { "Content-Type": "application/json" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, data: story, analysis: { status: "disabled", error_code: "AI_PROVIDER_SETUP_REQUIRED" } });
  expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }));
  expect(fetch).not.toHaveBeenCalled();
});

it.each([null, { source_revision: 1, brief_insight: "Existing synthetic insight" }])("preserves owned existing insights and never promises queued work during a hold", async insight => {
  const from = vi.fn((table: string) => {
    const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: table === "stories" ? { author_id: "11111111-1111-4111-8111-111111111111", revision: 1 } : insight, error: null }) };
    return builder;
  });
  effects.admin.mockReturnValue({ from });
  const response = await metadata(new NextRequest("https://synthetic.invalid/api/stories/synthetic/metadata"), { params: Promise.resolve({ storyId: "synthetic" }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ metadata: insight, analysis: insight ? { status: "succeeded" } : { status: "disabled", error_code: "AI_PROVIDER_SETUP_REQUIRED" } });
  expect(from.mock.calls.some(([table]) => table === "ai_jobs")).toBe(false);
});

it("does not reveal another owner's metadata while AI is disabled", async () => {
  const from = vi.fn(() => {
    const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: { author_id: "other-owner", revision: 1 }, error: null }) };
    return builder;
  });
  effects.admin.mockReturnValue({ from });
  const response = await metadata(new NextRequest("https://synthetic.invalid/api/stories/synthetic/metadata"), { params: Promise.resolve({ storyId: "synthetic" }) });
  expect(response.status).toBe(404);
  expect(from).toHaveBeenCalledTimes(1);
});

it("does not suggest a subscription purchase can resolve an operator hold", async () => {
  const from = vi.fn(() => {
    const builder = { select: () => builder, eq: () => builder, single: async () => ({ data: { subscription_plan: "free" }, error: null }) };
    return builder;
  });
  effects.admin.mockReturnValue({ from });
  const response = await reflections(new NextRequest("https://synthetic.invalid/api/ai/reflection"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ canGenerate: false, generation: { code: "AI_PROVIDER_SETUP_REQUIRED" } });
  expect(from).toHaveBeenCalledTimes(1);
});

it("keeps eligible historical reflections readable without enabling generation", async () => {
  const history = [{ id: "synthetic-reflection", reflection_text: "Existing synthetic reflection", created_at: "2025-01-01T00:00:00Z" }];
  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      single: async () => ({ data: { subscription_plan: "storyteller", subscription_expires_at: "2099-01-01T00:00:00Z" }, error: null }),
      limit: async () => ({ data: history, error: null }),
    };
    expect(["users", "weekly_reflections"]).toContain(table);
    return builder;
  });
  effects.admin.mockReturnValue({ from });
  const response = await reflections(new NextRequest("https://synthetic.invalid/api/ai/reflection"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ reflections: history, canGenerate: false, generation: { code: "AI_PROVIDER_SETUP_REQUIRED" } });
  expect(fetch).not.toHaveBeenCalled();
});
