import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { safeCompare } from "@/lib/crypto";

const CRE_CALLBACK_SECRET = process.env.CRE_CALLBACK_SECRET || "";

/** Clamp a number between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * POST /api/cre/callback
 *
 * Receives full metrics from CRE DON nodes via ConfidentialHTTPClient.
 * NOT user-authenticated — uses X-CRE-Callback-Secret header.
 *
 * Each DON node calls this independently, so the endpoint must be
 * idempotent (upsert on story_id) and return identical JSON for consensus.
 *
 * Stores full metrics in Supabase (visible only to the story author
 * via /api/cre/check with author-based filtering).
 */
export async function POST(req: NextRequest) {
  try {
    // Validate callback secret
    const secret = req.headers.get("X-CRE-Callback-Secret") || "";

    if (!CRE_CALLBACK_SECRET) {
      console.warn("[CRE/CALLBACK] CRE_CALLBACK_SECRET is not configured — rejecting callback");
      return NextResponse.json({ success: true });
    }

    if (!safeCompare(secret, CRE_CALLBACK_SECRET)) {
      console.error("[CRE/CALLBACK] Invalid callback secret");
      return NextResponse.json({ success: true });
    }

    const body = await req.json();

    const {
      storyId,
      metricsHash,
      txHash,
      significanceScore,
      emotionalDepth,
      qualityScore,
      wordCount,
      themes,
      qualityTier,
      meetsQualityThreshold,
    } = body;

    if (!storyId) {
      console.error("[CRE/CALLBACK] Missing storyId in payload");
      return NextResponse.json({ success: true });
    }

    // Defense-in-depth: clamp and validate metric values from DON
    const safeSignificance = clamp(Math.round(Number(significanceScore) || 0), 0, 100);
    const safeDepth = clamp(Math.round(Number(emotionalDepth) || 1), 1, 5);
    const safeQuality = clamp(Math.round(Number(qualityScore) || 0), 0, 100);
    const safeWordCount = Math.max(0, Math.round(Number(wordCount) || 0));
    const safeTier = clamp(Math.round(Number(qualityTier) || 1), 1, 5);
    const safeThemes = Array.isArray(themes)
      ? themes.filter((t: unknown): t is string => typeof t === "string").slice(0, 10)
      : [];

    const admin = createSupabaseAdminClient();

    // Upsert full metrics — idempotent for multiple DON node calls
    const { error: upsertError } = await admin
      .from("verified_metrics")
      .upsert(
        {
          story_id: storyId,
          significance_score: safeSignificance,
          emotional_depth: safeDepth,
          quality_score: safeQuality,
          word_count: safeWordCount,
          verified_themes: safeThemes,
          metrics_hash: typeof metricsHash === "string" ? metricsHash : null,
          quality_tier: safeTier,
          meets_quality_threshold: !!meetsQualityThreshold,
          on_chain_tx_hash: typeof txHash === "string" ? txHash : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "story_id" }
      );

    if (upsertError) {
      console.error("[CRE/CALLBACK] Supabase upsert error:", upsertError);
      // Still return success for DON consensus
    }

    // Update verification log to completed
    const { error: logError } = await admin
      .from("verification_logs")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("story_id", storyId)
      .eq("status", "pending");

    if (logError) {
      console.error("[CRE/CALLBACK] Verification log update error:", logError);
    }

    // Always return identical response for DON consensus
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CRE/CALLBACK] Error:", error);
    // Return success even on errors to avoid DON consensus failure
    return NextResponse.json({ success: true });
  }
}
