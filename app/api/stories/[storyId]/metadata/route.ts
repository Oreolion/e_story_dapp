import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/utils/supabase/supabaseServer";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    if (!storyId) {
      return NextResponse.json(
        { error: "Story ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Fetch metadata for the story
    const { data, error } = await supabase
      .from("story_metadata")
      .select("*")
      .eq("story_id", storyId)
      .maybeSingle();

    if (error) {
      // Handle "table doesn't exist" error gracefully (code 42P01)
      // This allows the app to work before the migration is run
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("story_metadata table does not exist yet. Run the migration in Supabase Dashboard.");
        return NextResponse.json({
          metadata: null,
          warning: "story_metadata table not yet created",
        });
      }

      console.error("Error fetching metadata:", error);
      return NextResponse.json(
        { error: "Failed to fetch metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      metadata: data, // Will be null if no metadata exists
    });

  } catch (error: unknown) {
    console.error("[METADATA] Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    if (!storyId) {
      return NextResponse.json(
        { error: "Story ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { is_canonical } = body;

    // Validate is_canonical is a boolean
    if (typeof is_canonical !== "boolean") {
      return NextResponse.json(
        { error: "is_canonical must be a boolean" },
        { status: 400 }
      );
    }

    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const supabase = createSupabaseAdminClient();

    // Get the user's wallet_address for ownership check
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, wallet_address")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify the user owns this story
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, author_id, author_wallet")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      console.error("Error fetching story:", storyError);
      return NextResponse.json(
        { error: "Failed to verify story ownership" },
        { status: 500 }
      );
    }

    if (!story) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    // Check if user owns the story (by author_id or author_wallet)
    const isOwner =
      story.author_id === userData.id ||
      story.author_wallet?.toLowerCase() === userData.wallet_address?.toLowerCase();

    if (!isOwner) {
      return NextResponse.json(
        { error: "You can only modify your own stories" },
        { status: 403 }
      );
    }

    // Check if metadata exists
    const { data: existingMetadata, error: metaCheckError } = await supabase
      .from("story_metadata")
      .select("id")
      .eq("story_id", storyId)
      .maybeSingle();

    if (metaCheckError && metaCheckError.code !== "42P01") {
      console.error("Error checking metadata:", metaCheckError);
      return NextResponse.json(
        { error: "Failed to check metadata" },
        { status: 500 }
      );
    }

    let updatedMetadata;

    if (existingMetadata) {
      // Update existing metadata
      const { data, error: updateError } = await supabase
        .from("story_metadata")
        .update({
          is_canonical,
          updated_at: new Date().toISOString(),
        })
        .eq("story_id", storyId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating metadata:", updateError);
        return NextResponse.json(
          { error: "Failed to update metadata" },
          { status: 500 }
        );
      }

      updatedMetadata = data;
    } else {
      // Create new metadata record with minimal data
      const { data, error: insertError } = await supabase
        .from("story_metadata")
        .insert({
          story_id: storyId,
          is_canonical,
          themes: [],
          emotional_tone: "neutral",
          life_domain: "general",
          intensity_score: 0,
          significance_score: 0,
          ai_readable: true,
          people_mentioned: [],
          places_mentioned: [],
          time_references: [],
          analysis_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting metadata:", insertError);
        return NextResponse.json(
          { error: "Failed to create metadata" },
          { status: 500 }
        );
      }

      updatedMetadata = data;
    }

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });

  } catch (error: unknown) {
    console.error("[METADATA] Update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
