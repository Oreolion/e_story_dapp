import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

/**
 * DELETE /api/user
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * On-chain data (NFTs, transactions, verified metrics) persists on the blockchain.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    const admin = createSupabaseAdminClient();

    // Delete in dependency order to avoid FK violations
    // 1. Notifications (references users)
    const { error: notifErr } = await admin
      .from("notifications")
      .delete()
      .eq("user_id", userId);
    if (notifErr) console.error("[USER_DELETE] notifications:", notifErr);

    // 2. Story-related data: comments, likes first, then stories
    // Get user's stories to delete related data
    const { data: userStories } = await admin
      .from("stories")
      .select("id")
      .eq("author_id", userId);

    if (userStories && userStories.length > 0) {
      const storyIds = userStories.map((s: { id: string }) => s.id);

      // Delete comments on user's stories
      const { error: commentsErr } = await admin
        .from("comments")
        .delete()
        .in("story_id", storyIds);
      if (commentsErr) console.error("[USER_DELETE] comments:", commentsErr);
    }

    // Delete user's own comments on other stories
    const { error: userCommentsErr } = await admin
      .from("comments")
      .delete()
      .eq("user_id", userId);
    if (userCommentsErr)
      console.error("[USER_DELETE] user comments:", userCommentsErr);

    // 3. Collections and collection_stories
    const { data: collections } = await admin
      .from("collections")
      .select("id")
      .eq("user_id", userId);

    if (collections && collections.length > 0) {
      const collectionIds = collections.map((c: { id: string }) => c.id);
      const { error: csErr } = await admin
        .from("collection_stories")
        .delete()
        .in("collection_id", collectionIds);
      if (csErr) console.error("[USER_DELETE] collection_stories:", csErr);
    }

    const { error: collectionsErr } = await admin
      .from("collections")
      .delete()
      .eq("user_id", userId);
    if (collectionsErr)
      console.error("[USER_DELETE] collections:", collectionsErr);

    // 4. Stories
    const { error: storiesErr } = await admin
      .from("stories")
      .delete()
      .eq("author_id", userId);
    if (storiesErr) console.error("[USER_DELETE] stories:", storiesErr);

    // 5. Weekly reflections
    const { error: reflectionsErr } = await admin
      .from("weekly_reflections")
      .delete()
      .eq("user_id", userId);
    if (reflectionsErr)
      console.error("[USER_DELETE] weekly_reflections:", reflectionsErr);

    // 6. Habits
    const { error: habitsErr } = await admin
      .from("habits")
      .delete()
      .eq("user_id", userId);
    if (habitsErr) console.error("[USER_DELETE] habits:", habitsErr);

    // 7. Follows (both directions)
    const { error: followingErr } = await admin
      .from("follows")
      .delete()
      .eq("follower_id", userId);
    if (followingErr) console.error("[USER_DELETE] following:", followingErr);

    const { error: followersErr } = await admin
      .from("follows")
      .delete()
      .eq("following_id", userId);
    if (followersErr) console.error("[USER_DELETE] followers:", followersErr);

    // 8. Finally, delete the user record
    const { error: userErr } = await admin
      .from("users")
      .delete()
      .eq("id", userId);

    if (userErr) {
      console.error("[USER_DELETE] user record:", userErr);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted. On-chain data persists on the blockchain.",
    });
  } catch (err) {
    console.error("[USER_DELETE] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
