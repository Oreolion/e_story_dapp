import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

const MAX_COMMENT_LENGTH = 2000;

/**
 * POST /api/social/comment
 * Body: { story_id: string, content: string }
 * Inserts a comment via admin client (works for wallet users under custom JWT)
 * and creates a notification for the story author.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { story_id, content } = await req.json();

    if (!story_id || typeof story_id !== "string") {
      return NextResponse.json({ error: "story_id is required" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const trimmed = content.trim();
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    // Resolve author wallet for the author_wallet column (backward compat)
    const { data: author } = await admin
      .from("users")
      .select("wallet_address, name, username")
      .eq("id", authenticatedUserId)
      .single();

    const { data: inserted, error: insertErr } = await admin
      .from("comments")
      .insert({
        story_id,
        author_id: authenticatedUserId,
        author_wallet: author?.wallet_address?.toLowerCase() || null,
        content: trimmed,
      })
      .select(
        `id, content, created_at,
         author:users!comments_author_id_fkey (name, avatar, wallet_address, username)`
      )
      .single();

    if (insertErr || !inserted) {
      console.error("[API /social/comment] insert error:", insertErr);
      return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
    }

    // Best-effort notification for the story author — never block the comment.
    try {
      const { data: story } = await admin
        .from("stories")
        .select("author_id, title")
        .eq("id", story_id)
        .single();

      if (story && story.author_id && story.author_id !== authenticatedUserId) {
        const commenterName = author?.name || author?.username || "Someone";
        const commenterHandle = author?.username ? `@${author.username}` : null;
        const storyTitle = story.title ? `"${story.title}"` : "your story";
        const preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;

        const { error: notifErr } = await admin.from("notifications").insert({
          user_id: story.author_id,
          type: "comment",
          title: "New comment",
          message: commenterHandle
            ? `${commenterName} (${commenterHandle}) commented on ${storyTitle}: "${preview}"`
            : `${commenterName} commented on ${storyTitle}: "${preview}"`,
          related_user_id: authenticatedUserId,
          story_id,
          link: `/story/${story_id}`,
          read: false,
        });

        if (notifErr) {
          console.error("[API /social/comment] notification insert error:", notifErr);
          Sentry.captureException(notifErr, {
            tags: { area: "social.comment.notification" },
          });
        }
      }
    } catch (notifErr) {
      console.error("[API /social/comment] notification create failed:", notifErr);
    }

    return NextResponse.json({ success: true, data: inserted });
  } catch (err) {
    console.error("[API /social/comment POST] unexpected:", err);
    Sentry.captureException(err, { tags: { route: "social/comment" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
