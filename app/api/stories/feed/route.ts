// app/api/stories/feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { resolveUserId, validateAuth } from "@/lib/auth";

/**
 * GET /api/stories/feed — Fetch public stories feed with author info (bypasses RLS)
 * No auth required — this is public content.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createSupabaseAdminClient();
    const authenticatedUserId = await validateAuth(req);
    const viewerId = authenticatedUserId
      ? await resolveUserId(authenticatedUserId)
      : null;

    const blockedUserIds = new Set<string>();
    if (viewerId) {
      const { data: blockRows, error: blockError } = await admin
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

      if (blockError) {
        console.error("[API /stories/feed] block filter failed:", blockError);
        return NextResponse.json({ stories: [] });
      }

      for (const row of blockRows ?? []) {
        blockedUserIds.add(
          row.blocker_id === viewerId ? row.blocked_id : row.blocker_id
        );
      }
    }

    // Fetch public stories ordered by newest first
    const { data: stories, error } = await admin
      .from("stories")
      .select(
        `
        id, numeric_id, title, content, created_at, likes, comments_count, shares,
        has_audio, audio_url, mood, tags, paywall_amount, teaser, is_public,
        author_id, author_wallet, story_date, view_count
      `
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      // Log server-side but return empty feed rather than 500.
      // A temporarily unavailable feed shows as empty rather than crashing pages.
      console.error("[API /stories/feed] fetch error:", error);
      return NextResponse.json({ stories: [] });
    }

    const visibleStories = (stories ?? []).filter(
      (story) => !blockedUserIds.has(story.author_id)
    );

    if (visibleStories.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    // Collect unique author IDs and fetch author profiles in one query
    const authorIds = [...new Set(visibleStories.map((s) => s.author_id).filter(Boolean))];

    const { data: authors, error: authorsErr } = await admin
      .from("users")
      .select("id, name, username, avatar, wallet_address, followers_count, badges")
      .in("id", authorIds);

    if (authorsErr) {
      console.error("[API /stories/feed] authors fetch error:", authorsErr);
    }

    // Build author lookup map
    const authorMap = new Map(
      (authors || []).map((a) => [a.id, a])
    );

    // Attach author to each story; strip audio_url for voice privacy
    // (public feed never exposes voice recordings — creators access audio from their own archive)
    const storiesWithAuthors = visibleStories.map((s) => ({
      ...s,
      audio_url: null,
      author: authorMap.get(s.author_id) || null,
    }));

    return NextResponse.json({ stories: storiesWithAuthors });
  } catch (err: unknown) {
    console.error("[API /stories/feed] unexpected error:", err);
    return NextResponse.json({ stories: [] });
  }
}
