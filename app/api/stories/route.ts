// app/api/stories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

/**
 * GET /api/stories — Fetch authenticated user's own stories (bypasses RLS)
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    // Resolve JWT user ID → users table ID (wallet users may differ)
    const userId = await resolveUserId(authResult);

    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("stories")
      .select("*")
      .eq("author_id", userId)
      .order("story_date", { ascending: false });

    if (error) {
      console.error("[API /stories GET] fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
    }

    return NextResponse.json({ stories: data || [] });
  } catch (err: unknown) {
    console.error("[API /stories GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const body = await req.json();

    const {
      author_id,
      author_wallet,
      title,
      content,
      has_audio,
      audio_url,
      tags,
      mood,
      ipfs_hash,
      is_public,
      created_at,
      story_date,
      parent_story_id,
      story_type,
    } = body ?? {};

    // Basic validation (author_wallet is optional for Google-only users)
    if (!author_id || !title || !content) {
      return NextResponse.json(
        { error: "Missing required fields (author_id, title, content)." },
        { status: 400 }
      );
    }

    // Resolve JWT user ID → users table ID (wallet users may differ)
    const resolvedUserId = await resolveUserId(authenticatedUserId);

    // Verify author_id matches authenticated user (use resolved ID)
    if (resolvedUserId !== author_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // Extra safety: verify that this user exists + check subscription
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("id, wallet_address, subscription_plan, subscription_expires_at")
      .eq("id", author_id)
      .single();

    if (userErr || !userRow) {
      console.error("[API /stories] user lookup error:", userErr);
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Verify wallet matches if both sides have one (skip for Google-only users)
    if (author_wallet && userRow.wallet_address) {
      if (userRow.wallet_address.toLowerCase() !== author_wallet.toLowerCase()) {
        console.warn("[API /stories] wallet mismatch for user", author_id);
        return NextResponse.json({ error: "Wallet mismatch" }, { status: 401 });
      }
    }

    const insertData: Record<string, unknown> = {
      author_id,
      author_wallet: author_wallet?.toLowerCase() ?? userRow.wallet_address ?? null,
      title,
      content,
      has_audio: !!has_audio,
      audio_url: audio_url ?? null,
      likes: 0,
      comments_count: 0,
      shares: 0,
      tags: tags ?? [],
      mood: mood ?? "neutral",
      ipfs_hash: ipfs_hash ?? null,
      is_public: typeof is_public === "boolean" ? is_public : false,
    };

    // Optional date fields
    if (created_at) insertData.created_at = created_at;
    if (story_date) insertData.story_date = story_date;
    if (story_type) insertData.story_type = story_type;

    // Story continuations require Storyteller+ plan
    if (parent_story_id) {
      const subPlan = userRow.subscription_plan ?? "free";
      const subExpires = userRow.subscription_expires_at;
      const isPaid = subPlan !== "free" && subExpires && new Date(subExpires) > new Date();
      if (!isPaid) {
        return NextResponse.json(
          {
            error: "Story continuations require a Storyteller or Creator plan.",
            code: "PLAN_REQUIRED",
            required_plan: "storyteller",
          },
          { status: 403 }
        );
      }
      insertData.parent_story_id = parent_story_id;
    }

    const { data: inserted, error: insertError } = await admin
      .from("stories")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("[API /stories] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save story" },
        { status: 500 }
      );
    }

    return NextResponse.json({ story: inserted }, { status: 200 });
  } catch (err: unknown) {
    console.error("[API /stories] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
