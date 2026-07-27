import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const {
  mockFrom,
  mockInsert,
  mockMaybeSingle,
  mockUserSingle,
  MOCK_AUTH_ID,
  MOCK_USER_ID,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockUserSingle: vi.fn(),
  MOCK_AUTH_ID: "auth-user-123",
  MOCK_USER_ID: "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/lib/auth", () => ({
  validateAuthOrReject: vi.fn().mockResolvedValue(MOCK_AUTH_ID),
  isAuthError: vi.fn().mockReturnValue(false),
  resolveUserId: vi.fn().mockResolvedValue(MOCK_USER_ID),
}));

vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { POST } from "@/app/api/journal/save/route";

type InsertResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
};

let insertResult: InsertResult;

function createRequest(
  body: Record<string, unknown>,
  idempotencyKey?: string
): NextRequest {
  const headers = new Headers({ Authorization: "Bearer test-token" });
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  return {
    headers,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function setupSupabase() {
  mockUserSingle.mockResolvedValue({
    data: {
      wallet_address: "0x1234",
      subscription_plan: "storyteller",
      subscription_expires_at: "2099-12-31T00:00:00.000Z",
    },
    error: null,
  });

  mockInsert.mockImplementation((data: Record<string, unknown>) => ({
    select: () => ({
      single: async () => ({
        ...insertResult,
        data: insertResult.data ?? (insertResult.error ? null : data),
      }),
    }),
  }));

  const duplicateAuthorEq = vi.fn().mockReturnValue({
    maybeSingle: mockMaybeSingle,
  });
  const duplicateIdEq = vi.fn().mockReturnValue({
    eq: duplicateAuthorEq,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({
            single: mockUserSingle,
          }),
        }),
      };
    }

    if (table === "stories") {
      return {
        insert: mockInsert,
        select: () => ({
          eq: duplicateIdEq,
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("POST /api/journal/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertResult = { data: null, error: null };
    setupSupabase();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("rejects invalid journal content before querying the database", async () => {
    const response = await POST(createRequest({ content: "   " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid journal entry",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects malformed idempotency keys", async () => {
    const response = await POST(
      createRequest({ content: "A valid story" }, "too-short")
    );

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects non-HTTP audio URLs", async () => {
    const response = await POST(
      createRequest({
        content: "A story with an unsafe audio URL",
        hasAudio: true,
        audioUrl: "javascript:alert(1)",
      })
    );

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps the mobile contract and inserts a deterministic story id", async () => {
    const requestBody = {
      title: "Morning walk",
      content: "I noticed the first signs of spring.",
      mood: "hopeful",
      tags: ["nature", "reflection"],
      hasAudio: true,
      audioUrl: "https://example.com/audio/story.m4a",
      isPublic: true,
      storyDate: "2026-07-27",
      parentStoryId: "22222222-2222-4222-8222-222222222222",
    };

    const response = await POST(
      createRequest(requestBody, "story-save-1234567890")
    );

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      author_id: MOCK_USER_ID,
      author_wallet: "0x1234",
      title: requestBody.title,
      content: requestBody.content,
      mood: requestBody.mood,
      tags: requestBody.tags,
      has_audio: true,
      audio_url: requestBody.audioUrl,
      is_public: true,
      story_date: requestBody.storyDate,
      parent_story_id: requestBody.parentStoryId,
    });
    expect(inserted.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      replayed: false,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns the original story when an identical request is replayed", async () => {
    insertResult = {
      data: null,
      error: { code: "23505", message: "duplicate key" },
    };
    mockMaybeSingle.mockImplementation(async () => ({
      data: { ...mockInsert.mock.calls[0][0] },
      error: null,
    }));

    const response = await POST(
      createRequest(
        {
          title: "Offline entry",
          content: "Saved while the train was underground.",
          mood: "calm",
        },
        "offline-save-123456789"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      replayed: true,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with a different payload", async () => {
    insertResult = {
      data: null,
      error: { code: "23505", message: "duplicate key" },
    };
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        author_id: MOCK_USER_ID,
        title: "Different title",
        content: "Different content",
        mood: "neutral",
        tags: [],
        has_audio: false,
        audio_url: null,
        is_public: false,
        story_date: null,
        parent_story_id: null,
      },
      error: null,
    });

    const response = await POST(
      createRequest(
        { title: "New title", content: "New content" },
        "reused-save-1234567890"
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Idempotency key was already used for a different request",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enforces the paid plan requirement for continuations", async () => {
    mockUserSingle.mockResolvedValue({
      data: {
        wallet_address: "0x1234",
        subscription_plan: "free",
        subscription_expires_at: null,
      },
      error: null,
    });

    const response = await POST(
      createRequest({
        content: "The next chapter",
        parentStoryId: "22222222-2222-4222-8222-222222222222",
      })
    );

    expect(response.status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
