import { runReflection } from "@/lib/ai/tasks";
import { createTextGenerator, inferenceErrorStatus } from "@/lib/ai/provider";
import { admitTextInference } from "@/lib/ai/admission";
import { hasTextProvider } from "@/lib/ai/providerPolicy";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { aiGenerationHold } from "@/lib/ai/availability";

// ============================================================================
// Configuration Constants
// ============================================================================

const REFLECTION_COOLDOWN_DAYS = 7; // 1 reflection per week
const MAX_STORIES_TO_ANALYZE = 20; // Limit stories for context window
const CANONICAL_WEIGHT_MULTIPLIER = 2.0; // Canonical stories count 2x

// Helper Functions
// ============================================================================

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  // Week starts on Sunday (day 0)
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - dayOfWeek);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = await resolveUserId(authResult);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || authenticatedUserId;
    const limit = Number(searchParams.get("limit") || "5");
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return NextResponse.json({ error: "Invalid limit" }, { status: 400 });

    // Users can only fetch their own reflections
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: "You can only access your own reflections" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Subscription check — weekly reflections require storyteller+ plan
    const { data: userRow } = await supabase
      .from("users")
      .select("wallet_address, subscription_plan, subscription_expires_at")
      .eq("id", authenticatedUserId)
      .single();

    const subPlan = userRow?.subscription_plan ?? "free";
    const subExpires = userRow?.subscription_expires_at;
    const isPaid = subPlan !== "free" && subExpires && new Date(subExpires) > new Date();
    const hold = aiGenerationHold();

    if (hold && !isPaid) return NextResponse.json({ reflections: [], canGenerate: false, generation: hold }, { headers: { "Cache-Control": "no-store" } });

    if (!isPaid) {
      return NextResponse.json(
        {
          error: "Weekly reflections require a Storyteller or Creator plan.",
          code: "PLAN_REQUIRED",
          required_plan: "storyteller",
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("weekly_reflections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Handle case where table doesn't exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({
          reflections: [],
          canGenerate: !hold,
          generation: hold,
          message: "Reflections table not yet created"
        });
      }
      throw error;
    }

    // Check if user can generate a new reflection (1 per week)
    const { weekStart } = getWeekBounds();
    const hasReflectionThisWeek = data?.some(
      r => new Date(r.created_at) >= weekStart
    );

    return NextResponse.json({
      reflections: data || [],
      canGenerate: !hold && !hasReflectionThisWeek,
      generation: hold,
      currentWeekStart: weekStart.toISOString()
    });

  } catch (error: unknown) {
    console.error("Error fetching reflections:", error);
    return NextResponse.json(
      { error: "Failed to fetch reflections" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Generate new reflection
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = await resolveUserId(authResult);

    const hold = aiGenerationHold();
    if (hold) return NextResponse.json(hold, { status: 503, headers: { "Cache-Control": "no-store" } });

    // Subscription check — weekly reflections require storyteller+ plan
    const adminClient = createSupabaseAdminClient();
    const { data: postUserRow } = await adminClient
      .from("users")
      .select("wallet_address, subscription_plan, subscription_expires_at")
      .eq("id", authenticatedUserId)
      .single();

    const postSubPlan = postUserRow?.subscription_plan ?? "free";
    const postSubExpires = postUserRow?.subscription_expires_at;
    const postIsPaid = postSubPlan !== "free" && postSubExpires && new Date(postSubExpires) > new Date();

    if (!postIsPaid) {
      return NextResponse.json(
        {
          error: "Weekly reflections require a Storyteller or Creator plan.",
          code: "PLAN_REQUIRED",
          required_plan: "storyteller",
        },
        { status: 403 }
      );
    }

    // Check API key configuration
    if (!hasTextProvider()) {
      return NextResponse.json(
        { error: "Server configuration error: API Key missing" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json();
    const userWallet = postUserRow?.wallet_address ?? "";
    if (body.userWallet && postUserRow?.wallet_address && body.userWallet.toLowerCase() !== postUserRow.wallet_address.toLowerCase()) return NextResponse.json({ error: "Wallet mismatch" }, { status: 403 });
    const userId = authenticatedUserId;

    const supabase = adminClient; // reuse client from subscription check
    const { weekStart, weekEnd } = getWeekBounds();

    // Rate limit check: 1 reflection per week
    const { data: existingReflections, error: checkError } = await supabase
      .from("weekly_reflections")
      .select("id, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString())
      .limit(1);

    // Handle table not existing gracefully
    if (checkError && checkError.code !== "42P01" && !checkError.message?.includes("does not exist")) {
      throw checkError;
    }

    if (existingReflections && existingReflections.length > 0) {
      const nextAvailable = new Date(weekStart);
      nextAvailable.setUTCDate(nextAvailable.getUTCDate() + REFLECTION_COOLDOWN_DAYS);

      return NextResponse.json(
        {
          error: "You can only generate one reflection per week",
          nextAvailable: nextAvailable.toISOString(),
          existingReflection: existingReflections[0]
        },
        { status: 429 }
      );
    }

    // Fetch stories from the past 7 days with metadata
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const { data: stories, error: storiesError } = await supabase
      .from("stories")
      .select(`
        id, title, content, created_at, mood,
        story_metadata (themes, emotional_tone, life_domain, is_canonical, significance_score, ai_readable)
      `)
      .eq("author_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString()).lte("created_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_STORIES_TO_ANALYZE);

    if (storiesError) {
      console.error("Error fetching stories:", storiesError);
      // Continue with empty stories if metadata table doesn't exist
      if (storiesError.code !== "42P01" && !storiesError.message?.includes("does not exist")) {
        throw storiesError;
      }
    }

    // Build only the consented, owner-scoped source context.
    const sources = (stories ?? []).filter(story => {
      const metadata = Array.isArray(story.story_metadata) ? story.story_metadata[0] : story.story_metadata;
      return metadata?.ai_readable !== false;
    }).map(story => {
      const metadata = Array.isArray(story.story_metadata) ? story.story_metadata[0] : story.story_metadata;
      return { id: story.id, title: story.title, content: story.content, created_at: story.created_at, mood: story.mood, isCanonical: metadata?.is_canonical === true };
    });
    const quota = await admitTextInference(supabase, userId, "reflection");
    if (!quota.allowed) return NextResponse.json({ error: "Reflection usage limit reached" }, { status: quota.unavailable ? 503 : 429, headers: { "Retry-After": String(quota.retryAfter) } });
    const parsedReflection = await runReflection(sources, createTextGenerator(25_000, undefined, "reflection", {
      reserveFallback: async () => (await admitTextInference(supabase, userId, "reflection")).allowed,
    }));
    const storyIds = sources.map(story => story.id);
    const canonicalWeight = sources.filter(story => story.isCanonical).length * CANONICAL_WEIGHT_MULTIPLIER;

    // Save to database
    const reflectionData = {
      user_id: userId,
      user_wallet: userWallet,
      reflection_text: parsedReflection.reflection_text,
      stories_analyzed: storyIds,
      themes_identified: parsedReflection.themes_identified,
      dominant_tone: parsedReflection.dominant_tone,
      dominant_domain: parsedReflection.dominant_domain,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      canonical_weight: canonicalWeight,
    };

    const { data: savedReflection, error: saveError } = await supabase
      .from("weekly_reflections")
      .insert([reflectionData])
      .select()
      .single();

    if (saveError || !savedReflection) return NextResponse.json({ error: "Reflection generated but could not be saved" }, { status: 503 });


    return NextResponse.json({ success: true, reflection: savedReflection, storiesAnalyzed: storyIds.length, canonicalWeight });
  } catch (error) {
    console.error("Reflection generation failed");
    return NextResponse.json({ error: "Failed to generate reflection" }, { status: inferenceErrorStatus(error) });
  }
}
