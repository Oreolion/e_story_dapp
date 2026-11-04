// app/api/stories/route.ts
import { parseJournalInput } from "@/lib/stories/contracts";
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
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    const { data: profile, error: profileError } = await admin.from("users").select("id, name, username, avatar, wallet_address, badges, followers_count").eq("id", userId).single();
    if (profileError || !profile) return NextResponse.json({ error: "Unable to load author" }, { status: 503 });

    const { data, error } = await admin
      .from("stories")
      .select("id, title, content, author_id, author_wallet, has_audio, audio_url, mood, tags, is_public, story_date, created_at, parent_story_id, likes, comments_count, shares, paywall_amount, revision, story_metadata(*)")
      .eq("author_id", userId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      console.error("[API /stories GET] fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
    }

    const stories = (data ?? []).map(row => ({
      ...row, author: { id: profile.id, name: profile.name, username: profile.username, avatar: profile.avatar, wallet_address: profile.wallet_address, badges: profile.badges ?? [], followers: profile.followers_count ?? 0, isFollowing: false },
      hasAudio: row.has_audio, comments: row.comments_count, paywallAmount: row.paywall_amount, timestamp: row.created_at, isLiked: false,
      story_metadata: (() => { const meta = Array.isArray(row.story_metadata) ? row.story_metadata[0] ?? null : row.story_metadata; return meta?.source_revision === 0 || meta?.source_revision != null && meta.source_revision !== row.revision ? null : meta; })(),
    }));
    return NextResponse.json({ stories, nextOffset: stories.length === limit ? offset + limit : null });
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

    const rawBody = await req.json();
    let body;
    try { body = { ...rawBody, ...parseJournalInput(rawBody) }; } catch { return NextResponse.json({ error: "Invalid story fields" }, { status: 400 }); }

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
      author_wallet: userRow.wallet_address?.toLowerCase() ?? null,
      title,
      content,
      has_audio: !!has_audio,
      audio_url: audio_url ?? null,
      likes: 0,
      comments_count: 0,
      shares: 0,
      tags: tags ?? [],
      mood: mood ?? "neutral",
      ipfs_hash: is_public === true ? ipfs_hash ?? null : null,
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
      const { data: parent, error: parentError } = await admin.from("stories").select("author_id").eq("id", parent_story_id).maybeSingle();
      if (parentError) return NextResponse.json({ error: "Unable to verify parent" }, { status: 503 });
      if (!parent || parent.author_id !== resolvedUserId) return NextResponse.json({ error: "Parent story not found" }, { status: 404 });
      insertData.parent_story_id = parent_story_id;
    }

    const { data: inserted, error: insertError } = await admin
      .from("stories")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      if (insertError.message === "Story write quota exceeded") return NextResponse.json({ error: "Daily story write limit reached" }, { status: 429 });
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
