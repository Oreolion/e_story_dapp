import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const httpUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  });

const journalSaveSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(50000),
  mood: z.string().trim().min(1).max(50).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  hasAudio: z.boolean().optional(),
  audioUrl: httpUrlSchema.nullable().optional(),
  isPublic: z.boolean().optional(),
  storyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  parentStoryId: z.string().uuid().nullable().optional(),
});

type JournalSaveInput = z.infer<typeof journalSaveSchema>;

function deriveIdempotentStoryId(userId: string, idempotencyKey: string): string {
  const hash = createHash("sha256")
    .update(`journal-save:${userId}:${idempotencyKey}`)
    .digest("hex");

  // PostgreSQL UUID accepts canonical hex UUIDs. Set RFC 4122 version/variant
  // bits so generated IDs also remain valid for stricter downstream tooling.
  const versioned = `${hash.slice(0, 12)}5${hash.slice(13, 16)}`;
  const variantNibble = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const variant = `${variantNibble}${hash.slice(17, 32)}`;
  const uuidHex = `${versioned}${variant}`;

  return `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20, 32)}`;
}

function normalizeRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const value = body as Record<string, unknown>;

  // Accept the current camelCase contract and the legacy snake_case mobile
  // fields while callers migrate. Unknown properties are discarded by Zod.
  return {
    title: value.title,
    content: value.content,
    mood: value.mood,
    tags: value.tags,
    hasAudio: value.hasAudio ?? value.has_audio,
    audioUrl: value.audioUrl ?? value.audio_url,
    isPublic: value.isPublic ?? value.is_public,
    storyDate: value.storyDate ?? value.story_date,
    parentStoryId: value.parentStoryId ?? value.parent_story_id,
  };
}

function storyMatchesRequest(
  story: Record<string, unknown>,
  expected: Record<string, unknown>
): boolean {
  const existingTags = Array.isArray(story.tags) ? story.tags : [];
  const expectedTags = Array.isArray(expected.tags) ? expected.tags : [];

  return (
    story.author_id === expected.author_id &&
    story.title === expected.title &&
    story.content === expected.content &&
    story.mood === expected.mood &&
    JSON.stringify(existingTags) === JSON.stringify(expectedTags) &&
    Boolean(story.has_audio) === Boolean(expected.has_audio) &&
    (story.audio_url ?? null) === (expected.audio_url ?? null) &&
    Boolean(story.is_public) === Boolean(expected.is_public) &&
    (story.story_date ?? null) === (expected.story_date ?? null) &&
    (story.parent_story_id ?? null) === (expected.parent_story_id ?? null)
  );
}

function successResponse(story: unknown, replayed = false) {
  return NextResponse.json({
    success: true,
    data: story,
    replayed,
    message: replayed
      ? 'Journal entry was already saved.'
      : 'Journal entry saved successfully!',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = await resolveUserId(authResult);

    const rawBody = await request.json();
    const parsed = journalSaveSchema.safeParse(normalizeRequestBody(rawBody));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid journal entry' },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
    if (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return NextResponse.json(
        { error: 'Invalid Idempotency-Key header' },
        { status: 400 }
      );
    }

    const input: JournalSaveInput = parsed.data;
    const title = input.title ?? "Journal Entry";
    const content = input.content;
    const mood = input.mood ?? "neutral";
    const tags = input.tags ?? [];
    const hasAudio = input.hasAudio ?? false;
    const audioUrl = input.audioUrl ?? null;
    const isPublic = input.isPublic ?? false;
    const storyDate = input.storyDate ?? null;
    const parentStoryId = input.parentStoryId ?? null;

    const admin = createSupabaseAdminClient();

    // Get user's wallet address for the story
    const { data: user, error: userError } = await admin
      .from("users")
      .select("wallet_address, subscription_plan, subscription_expires_at")
      .eq("id", authenticatedUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (parentStoryId) {
      const subscriptionPlan = user.subscription_plan ?? "free";
      const subscriptionExpiresAt = user.subscription_expires_at;
      const hasActivePaidPlan =
        subscriptionPlan !== "free" &&
        subscriptionExpiresAt &&
        new Date(subscriptionExpiresAt) > new Date();

      if (!hasActivePaidPlan) {
        return NextResponse.json(
          {
            error: "Story continuations require a Storyteller or Creator plan.",
            code: "PLAN_REQUIRED",
            required_plan: "storyteller",
          },
          { status: 403 }
        );
      }
    }

    const storyId = idempotencyKey
      ? deriveIdempotentStoryId(authenticatedUserId, idempotencyKey)
      : null;

    const insertData: Record<string, unknown> = {
      ...(storyId ? { id: storyId } : {}),
      author_id: authenticatedUserId,
      author_wallet: user.wallet_address,
      title,
      content,
      mood,
      tags,
      has_audio: hasAudio,
      audio_url: audioUrl,
      is_public: isPublic,
      story_date: storyDate,
      parent_story_id: parentStoryId,
      likes: 0,
      comments_count: 0,
      shares: 0,
    };

    // Insert story into database
    const { data: story, error: insertError } = await admin
      .from("stories")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      if (storyId && insertError.code === "23505") {
        const { data: existingStory, error: existingError } = await admin
          .from("stories")
          .select("*")
          .eq("id", storyId)
          .eq("author_id", authenticatedUserId)
          .maybeSingle();

        if (
          !existingError &&
          existingStory &&
          storyMatchesRequest(
            existingStory as Record<string, unknown>,
            insertData
          )
        ) {
          return successResponse(existingStory, true);
        }

        return NextResponse.json(
          { error: 'Idempotency key was already used for a different request' },
          { status: 409 }
        );
      }

      console.error('[JOURNAL/SAVE] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save journal entry' },
        { status: 500 }
      );
    }

    // Trigger AI analysis in the background (fire and forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const authHeader = request.headers.get("Authorization");
      fetch(`${appUrl}/api/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          storyId: story.id,
          storyText: content,
        }),
      }).catch(err => console.error("[JOURNAL/SAVE] Analysis trigger failed:", err));
    } catch {
      // Non-critical: analysis can be retried later
    }

    // Trigger CRE verification in the background (fire and forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const authHeader = request.headers.get("Authorization");
      if (authHeader) {
        fetch(`${appUrl}/api/cre/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ storyId: story.id }),
        }).catch(err => console.error("[JOURNAL/SAVE] CRE trigger failed:", err));
      }
    } catch {
      // Non-critical: verification can be triggered manually later
    }

    return successResponse(story);

  } catch (error) {
    console.error('Error saving journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    );
  }
}
