import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { storyId } = await request.json();

    // Validate input
    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    // Check if already liked (atomic toggle)
    const { data: existingLike, error: checkErr } = await admin
      .from("likes")
      .select("id")
      .eq("user_id", authenticatedUserId)
      .eq("story_id", storyId)
      .maybeSingle();

    if (checkErr) {
      console.error("[LIKE] Check error:", checkErr);
      return NextResponse.json({ error: "Failed to process like" }, { status: 500 });
    }

    let isLiked: boolean;
    let totalLikes: number;

    // Atomic counter helper — falls back to read-then-write if RPC not yet deployed
    async function adjustLikes(op: "inc" | "dec"): Promise<number> {
      const fn = op === "inc" ? "increment_story_likes" : "decrement_story_likes";
      const { data: rpcData, error: rpcErr } = await admin.rpc(fn, { p_story_id: storyId });
      if (!rpcErr && typeof rpcData === "number") return rpcData;

      // Fallback (pre-migration 018): racy but preserves prior behavior
      const { data: story } = await admin
        .from("stories")
        .select("likes")
        .eq("id", storyId)
        .single();
      const current = story?.likes || 0;
      const next = op === "inc" ? current + 1 : Math.max(0, current - 1);
      await admin.from("stories").update({ likes: next }).eq("id", storyId);
      return next;
    }

    if (existingLike) {
      // Unlike: delete the like record
      const { error: deleteErr } = await admin
        .from("likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteErr) {
        console.error("[LIKE] Delete error:", deleteErr);
        return NextResponse.json({ error: "Failed to unlike" }, { status: 500 });
      }

      totalLikes = await adjustLikes("dec");
      isLiked = false;
    } else {
      // Like: insert new like record (upsert for safety)
      const { error: insertErr } = await admin
        .from("likes")
        .upsert(
          { user_id: authenticatedUserId, story_id: storyId },
          { onConflict: "user_id, story_id" }
        );

      if (insertErr) {
        console.error("[LIKE] Insert error:", insertErr);
        return NextResponse.json({ error: "Failed to like" }, { status: 500 });
      }

      totalLikes = await adjustLikes("inc");
      isLiked = true;

      // Create like notification for story author
      const { data: storyAuthor } = await admin
        .from("stories")
        .select("author_id")
        .eq("id", storyId)
        .single();

      if (storyAuthor && storyAuthor.author_id !== authenticatedUserId) {
        const { data: liker } = await admin
          .from("users")
          .select("name, username")
          .eq("id", authenticatedUserId)
          .single();

        await admin.from("notifications").insert({
          user_id: storyAuthor.author_id,
          type: "like",
          title: "New Like",
          message: `${liker?.name || liker?.username || "Someone"} liked your story`,
          related_user_id: authenticatedUserId,
          story_id: storyId,
          link: `/story/${storyId}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        storyId,
        isLiked,
        totalLikes,
        timestamp: new Date().toISOString()
      },
      message: isLiked ? 'Story liked!' : 'Story unliked.'
    });

  } catch (error) {
    console.error('Error processing like:', error);
    Sentry.captureException(error, { tags: { route: "social/like" } });
    return NextResponse.json(
      { error: 'Failed to process like' },
      { status: 500 }
    );
  }
}
