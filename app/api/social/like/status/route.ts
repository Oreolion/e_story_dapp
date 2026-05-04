import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

/**
 * GET /api/social/like/status?story_ids=uuid1,uuid2,...
 * Check like status for one or more stories by ID.
 * Returns: { liked: { [storyId]: boolean } }
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { searchParams } = new URL(req.url);
    const storyIdsParam = searchParams.get("story_ids");

    if (!storyIdsParam) {
      return NextResponse.json({ liked: {} });
    }

    const storyIds = storyIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
    if (storyIds.length === 0) {
      return NextResponse.json({ liked: {} });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("likes")
      .select("story_id")
      .eq("user_id", authenticatedUserId)
      .in("story_id", storyIds);

    if (error) {
      console.error("[API /social/like/status GET] error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const likedSet = new Set(data?.map((r) => r.story_id) || []);
    const liked: Record<string, boolean> = {};
    for (const id of storyIds) {
      liked[id] = likedSet.has(id);
    }

    return NextResponse.json({ liked });
  } catch (err: unknown) {
    console.error("[API /social/like/status GET] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
