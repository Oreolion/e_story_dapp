import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuth } from "@/lib/auth";
import { isValidUuid } from "@/lib/validation";

/** Extract the storage path from a Supabase public URL (e.g. ".../story-audio/userId/123.webm" → "userId/123.webm") */
function extractStoragePath(publicUrl: string): string | null {
  const marker = "/story-audio/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

/**
 * GET /api/stories/[storyId] — Fetch a single story with author info
 * Public stories are readable by anyone. Private stories require the author's auth.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    if (!storyId || !isValidUuid(storyId)) {
      return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch story
    const { data: story, error } = await admin
      .from("stories")
      .select(
        `id, numeric_id, title, content, teaser, created_at, story_date, is_public,
         likes, shares, comments_count, has_audio, audio_url, mood, tags,
         paywall_amount, story_type, author_id, author_wallet, view_count,
         parent_story_id`
      )
      .eq("id", storyId)
      .maybeSingle();

    if (error) {
      console.error("[API /stories/[storyId]] fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch story" }, { status: 500 });
    }

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Authenticate viewer (optional — public stories are readable by anyone)
    const viewerId = await validateAuth(req);

    // Private stories: only the author can view them
    if (!story.is_public) {
      if (!viewerId || viewerId !== story.author_id) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }
    }

    // Voice privacy: only the author can access audio
    const isAuthor = viewerId === story.author_id;
    if (!isAuthor) {
      story.audio_url = null;
    } else if (story.audio_url) {
      // Generate a signed URL for the author — public URLs fail on private buckets
      const storagePath = extractStoragePath(story.audio_url);
      if (storagePath) {
        const { data: signedData, error: signedError } = await admin.storage
          .from("story-audio")
          .createSignedUrl(storagePath, 3600); // 1 hour expiry
        if (!signedError && signedData?.signedUrl) {
          story.audio_url = signedData.signedUrl;
        } else {
          // Signed URL failed — don't send a broken URL to the client
          console.error("[API /stories/[storyId]] signed URL failed:", signedError?.message);
          story.audio_url = null;
        }
      } else {
        // Can't extract storage path — URL format is unexpected
        story.audio_url = null;
      }
    }

    // Increment view count (fire-and-forget, non-blocking)
    if (story.is_public && !isAuthor) {
      void admin
        .from("stories")
        .update({ view_count: (story.view_count || 0) + 1 })
        .eq("id", storyId);
    }

    // Fetch author by author_id (works for both wallet and OAuth users)
    let author = null;
    if (story.author_id) {
      const { data: authorRow } = await admin
        .from("users")
        .select("id, name, username, avatar, wallet_address, followers_count, badges")
        .eq("id", story.author_id)
        .single();
      author = authorRow;
    }

    // Fetch parent story title if this is a continuation
    let parentStory = null;
    if (story.parent_story_id) {
      const { data: parent } = await admin
        .from("stories")
        .select("id, title")
        .eq("id", story.parent_story_id)
        .maybeSingle();
      if (parent) parentStory = parent;
    }

    // Fetch comments
    const { data: comments } = await admin
      .from("comments")
      .select(
        `id, content, created_at, author_id,
         author:users!comments_author_id_fkey (name, avatar, wallet_address)`
      )
      .eq("story_id", storyId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      story: { ...story, author, parentStory },
      comments: comments || [],
    });
  } catch (err: unknown) {
    console.error("[API /stories/[storyId]] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
