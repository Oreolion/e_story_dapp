import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * POST /api/cre/trigger
 * Triggers CRE story verification workflow.
 *
 * When CRE_WORKFLOW_URL is set: triggers the deployed CRE workflow (production).
 * When CRE_WORKFLOW_URL is NOT set: runs Gemini analysis directly and writes
 * metrics to Supabase (fallback for demo/dev when CRE isn't deployed yet).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { storyId } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Story ID is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch story with content and author wallet
    const { data: story, error: storyError } = await admin
      .from("stories")
      .select("id, title, content, author_id, author_wallet")
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.author_id !== authenticatedUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!story.content || story.content.trim().length === 0) {
      return NextResponse.json({ error: "Story has no content to verify" }, { status: 400 });
    }

    if (!story.author_wallet) {
      return NextResponse.json({ error: "Author wallet address required for verification" }, { status: 400 });
    }

    // Check if already verified
    const { data: existing } = await admin
      .from("verified_metrics")
      .select("id")
      .eq("story_id", storyId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Story already verified" }, { status: 409 });
    }

    // Check if verification is already pending
    const { data: pendingLog } = await admin
      .from("verification_logs")
      .select("id")
      .eq("story_id", storyId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingLog) {
      return NextResponse.json({ error: "Verification already in progress" }, { status: 409 });
    }

    // Create verification log
    const workflowRunId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { error: logError } = await admin
      .from("verification_logs")
      .insert({
        story_id: storyId,
        workflow_run_id: workflowRunId,
        status: "pending",
      });

    if (logError) {
      console.error("[CRE/TRIGGER] Log insert error:", logError);
      return NextResponse.json({ error: "Failed to start verification" }, { status: 500 });
    }

    // Route: CRE workflow (production) or direct Gemini fallback (demo/dev)
    const creWorkflowUrl = process.env.CRE_WORKFLOW_URL;
    if (creWorkflowUrl) {
      // Production path: trigger deployed CRE workflow
      fetch(creWorkflowUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CRE_API_KEY || ""}`,
        },
        body: JSON.stringify({
          storyId: story.id,
          title: story.title || "Untitled",
          content: story.content,
          authorWallet: story.author_wallet,
        }),
      }).catch(err => console.error("[CRE/TRIGGER] Workflow trigger failed:", err));
    } else {
      // Fallback: direct Gemini analysis (same AI, no on-chain attestation)
      console.log("[CRE/TRIGGER] No CRE_WORKFLOW_URL — using direct Gemini fallback");
      runDirectGeminiFallback(admin, story.id, story.title || "Untitled", story.content).catch(
        err => console.error("[CRE/TRIGGER] Direct fallback failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      workflowRunId,
      message: "Verification started",
    });
  } catch (error) {
    console.error("[CRE/TRIGGER] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// Direct Gemini Fallback (used when CRE_WORKFLOW_URL is not set)
// ============================================================================

const VERIFICATION_PROMPT = `You are a content quality analyst. Analyze the provided story and return a JSON object with exactly these fields:

- significanceScore: number 0-100 (how meaningful/impactful to the author's personal growth)
- emotionalDepth: number 1-5 (1=surface, 2=mild, 3=moderate, 4=deep, 5=profound)
- qualityScore: number 0-100 (writing quality: coherence, structure, vocabulary, narrative flow)
- wordCount: number (exact word count of the content)
- themes: string[] (2-5 main themes, lowercase, e.g. ["growth", "family", "resilience"])

STRICT RULES:
- Output MUST be valid JSON. No markdown, no backticks, no explanation.
- Return ONLY the JSON object.`;

interface DirectMetrics {
  significanceScore: number;
  emotionalDepth: number;
  qualityScore: number;
  wordCount: number;
  themes: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreToTier(score: number): number {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

/**
 * Runs the same Gemini analysis as the CRE workflow but directly,
 * then writes results to verified_metrics in Supabase.
 * No on-chain attestation — source marked as "direct".
 */
async function runDirectGeminiFallback(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  storyId: string,
  title: string,
  content: string
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("[CRE/DIRECT] GOOGLE_GENERATIVE_AI_API_KEY not set");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  });

  const prompt = `${VERIFICATION_PROMPT}\n\nTitle: "${title}"\n\nContent:\n"""\n${content}\n"""`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse response
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[CRE/DIRECT] No JSON found in Gemini response");
    return;
  }

  const raw = JSON.parse(jsonMatch[0]) as Partial<DirectMetrics>;

  const metrics: DirectMetrics = {
    significanceScore: clamp(Math.round(Number(raw.significanceScore) || 0), 0, 100),
    emotionalDepth: clamp(Math.round(Number(raw.emotionalDepth) || 1), 1, 5),
    qualityScore: clamp(Math.round(Number(raw.qualityScore) || 0), 0, 100),
    wordCount: Math.max(0, Math.round(Number(raw.wordCount) || 0)),
    themes: Array.isArray(raw.themes)
      ? raw.themes.filter((t): t is string => typeof t === "string").map(t => t.toLowerCase().trim()).slice(0, 5)
      : [],
  };

  const qualityTier = scoreToTier(metrics.qualityScore);

  console.log(
    `[CRE/DIRECT] Analysis complete: significance=${metrics.significanceScore}, quality=${metrics.qualityScore}, tier=${qualityTier}`
  );

  // Write to verified_metrics — same schema as CRE callback
  const { error: upsertError } = await admin
    .from("verified_metrics")
    .upsert(
      {
        story_id: storyId,
        significance_score: metrics.significanceScore,
        emotional_depth: metrics.emotionalDepth,
        quality_score: metrics.qualityScore,
        word_count: metrics.wordCount,
        verified_themes: metrics.themes,
        quality_tier: qualityTier,
        meets_quality_threshold: metrics.qualityScore >= 70,
        metrics_hash: null, // No CRE hash — direct analysis
        on_chain_tx_hash: null, // No on-chain write — direct analysis
        cre_attestation_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "story_id" }
    );

  if (upsertError) {
    console.error("[CRE/DIRECT] Supabase upsert error:", upsertError);
    return;
  }

  // Mark verification as completed
  await admin
    .from("verification_logs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("story_id", storyId)
    .eq("status", "pending");

  console.log(`[CRE/DIRECT] Metrics saved for story ${storyId}`);
}
