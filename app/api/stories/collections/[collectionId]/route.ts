import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

/**
 * GET /api/stories/collections/[collectionId] — Get collection with its stories
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const { collectionId } = await params;

    const admin = createSupabaseAdminClient();

    // Fetch collection
    const { data: collection, error: colError } = await admin
      .from("story_collections")
      .select("*")
      .eq("id", collectionId)
      .single();

    if (colError || !collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Only owner can view private collections
    if (!collection.is_public && collection.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch stories in this collection, ordered by position
    const { data: collectionStories, error: csError } = await admin
      .from("collection_stories")
      .select("story_id, position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: true });

    if (csError) {
      console.error("[API /collections/[id] GET] junction fetch error:", csError);
      return NextResponse.json({ error: "Failed to fetch collection stories" }, { status: 500 });
    }

    let stories: any[] = [];
    if (collectionStories && collectionStories.length > 0) {
      const storyIds = collectionStories.map((cs) => cs.story_id);
      const { data: storiesData } = await admin
        .from("stories")
        .select("*")
        .in("id", storyIds);

      // Reorder by position
      const storyMap = new Map((storiesData || []).map((s) => [s.id, s]));
      stories = collectionStories
        .map((cs) => storyMap.get(cs.story_id))
        .filter(Boolean);
    }

    return NextResponse.json({ collection, stories });
  } catch (err) {
    console.error("[API /collections/[id] GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/stories/collections/[collectionId] — Update collection metadata
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const { collectionId } = await params;

    const admin = createSupabaseAdminClient();

    // Verify ownership
    const { data: existing } = await admin
      .from("story_collections")
      .select("author_id")
      .eq("id", collectionId)
      .single();

    if (!existing || existing.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, is_public } = await req.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (typeof is_public === "boolean") updates.is_public = is_public;

    const { data, error } = await admin
      .from("story_collections")
      .update(updates)
      .eq("id", collectionId)
      .select()
      .single();

    if (error) {
      console.error("[API /collections/[id] PUT] update error:", error);
      return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
    }

    return NextResponse.json({ collection: data });
  } catch (err) {
    console.error("[API /collections/[id] PUT] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/stories/collections/[collectionId] — Delete a collection
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

    // Verify ownership
    const { data: existing } = await admin
      .from("story_collections")
      .select("author_id")
      .eq("id", collectionId)
      .single();

    if (!existing || existing.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin
      .from("story_collections")
      .delete()
      .eq("id", collectionId);

    if (error) {
      console.error("[API /collections/[id] DELETE] error:", error);
      return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /collections/[id] DELETE] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
