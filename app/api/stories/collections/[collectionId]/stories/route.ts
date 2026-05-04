import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

/**
 * POST /api/stories/collections/[collectionId]/stories — Add stories to a collection
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const { collectionId } = await params;

    const admin = createSupabaseAdminClient();

    // Verify collection ownership
    const { data: collection } = await admin
      .from("story_collections")
      .select("author_id, story_count")
      .eq("id", collectionId)
      .single();

    if (!collection || collection.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { story_ids } = await req.json();

    if (!Array.isArray(story_ids) || story_ids.length === 0) {
      return NextResponse.json({ error: "story_ids array is required" }, { status: 400 });
    }

    // Verify user owns these stories
    const { data: ownedStories } = await admin
      .from("stories")
      .select("id")
      .eq("author_id", userId)
      .in("id", story_ids);

    const ownedIds = new Set((ownedStories || []).map((s) => s.id));
    const validIds = story_ids.filter((id: string) => ownedIds.has(id));

    if (validIds.length === 0) {
      return NextResponse.json({ error: "No valid stories to add" }, { status: 400 });
    }

    // Get current max position
    const { data: maxPosRow } = await admin
      .from("collection_stories")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextPos = (maxPosRow?.position ?? -1) + 1;

    // Insert (upsert to handle duplicates gracefully)
    const rows = validIds.map((storyId: string) => ({
      collection_id: collectionId,
      story_id: storyId,
      position: nextPos++,
    }));

    const { error: insertError } = await admin
      .from("collection_stories")
      .upsert(rows, { onConflict: "collection_id,story_id", ignoreDuplicates: true });

    if (insertError) {
      console.error("[API /collections/[id]/stories POST] insert error:", insertError);
      return NextResponse.json({ error: "Failed to add stories" }, { status: 500 });
    }

    // Update story_count
    const { count } = await admin
      .from("collection_stories")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", collectionId);

    await admin
      .from("story_collections")
      .update({ story_count: count || 0, updated_at: new Date().toISOString() })
      .eq("id", collectionId);

    return NextResponse.json({ success: true, added: validIds.length, story_count: count });
  } catch (err) {
    console.error("[API /collections/[id]/stories POST] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/stories/collections/[collectionId]/stories — Remove a story from a collection
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const { collectionId } = await params;

    const admin = createSupabaseAdminClient();

    // Verify collection ownership
    const { data: collection } = await admin
      .from("story_collections")
      .select("author_id")
      .eq("id", collectionId)
      .single();

    if (!collection || collection.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { story_id } = await req.json();

    if (!story_id) {
      return NextResponse.json({ error: "story_id is required" }, { status: 400 });
    }

    const { error } = await admin
      .from("collection_stories")
      .delete()
      .eq("collection_id", collectionId)
      .eq("story_id", story_id);

    if (error) {
      console.error("[API /collections/[id]/stories DELETE] error:", error);
      return NextResponse.json({ error: "Failed to remove story" }, { status: 500 });
    }

    // Update story_count
    const { count } = await admin
      .from("collection_stories")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", collectionId);

    await admin
      .from("story_collections")
      .update({ story_count: count || 0, updated_at: new Date().toISOString() })
      .eq("id", collectionId);

    return NextResponse.json({ success: true, story_count: count });
  } catch (err) {
    console.error("[API /collections/[id]/stories DELETE] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
