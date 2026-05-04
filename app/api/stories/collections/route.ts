import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

/**
 * GET /api/stories/collections — List authenticated user's collections
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("story_collections")
      .select("*")
      .eq("author_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[API /collections GET] fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
    }

    return NextResponse.json({ collections: data || [] });
  } catch (err) {
    console.error("[API /collections GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/stories/collections — Create a new collection
 * Requires Storyteller+ plan.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const admin = createSupabaseAdminClient();

    // Subscription check — collections require storyteller+ plan
    const { data: userRow } = await admin
      .from("users")
      .select("subscription_plan, subscription_expires_at")
      .eq("id", userId)
      .single();

    const subPlan = userRow?.subscription_plan ?? "free";
    const subExpires = userRow?.subscription_expires_at;
    const isPaid = subPlan !== "free" && subExpires && new Date(subExpires) > new Date();

    if (!isPaid) {
      return NextResponse.json(
        {
          error: "Story collections require a Storyteller or Creator plan.",
          code: "PLAN_REQUIRED",
          required_plan: "storyteller",
        },
        { status: 403 }
      );
    }

    const { title, description, is_public } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (title.length > 200) {
      return NextResponse.json({ error: "Title must be under 200 characters" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("story_collections")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        author_id: userId,
        is_public: typeof is_public === "boolean" ? is_public : false,
        story_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("[API /collections POST] insert error:", error);
      return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
    }

    return NextResponse.json({ collection: data }, { status: 201 });
  } catch (err) {
    console.error("[API /collections POST] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
