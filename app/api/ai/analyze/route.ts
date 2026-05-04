import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { analysisLogger } from "@/app/utils/analysisLogger";
import { performanceMonitor, OperationTimer } from "@/app/utils/performanceMonitor";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

// ============================================================================
// Configuration Constants
// ============================================================================

const MAX_CONTENT_LENGTH = 10000;
const MIN_CONTENT_LENGTH = 50;
const MAX_RETRIES = 3;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
const FREE_MONTHLY_ANALYSIS_LIMIT = 10;

// Valid values for validation
const VALID_EMOTIONAL_TONES = [
  'reflective', 'joyful', 'anxious', 'hopeful', 'melancholic',
  'grateful', 'frustrated', 'peaceful', 'excited', 'uncertain', 'neutral'
] as const;

const VALID_LIFE_DOMAINS = [
  'work', 'relationships', 'health', 'identity', 'growth',
  'creativity', 'spirituality', 'family', 'adventure', 'learning', 'general'
] as const;

const ANALYSIS_PROMPT = `You are a cognitive analysis engine for a storytelling platform. Users write about anything — personal journals, history, geopolitics, culture, creative non-fiction, and more. Analyze the following story and extract structured metadata.

Story:
"""
{STORY_TEXT}
"""

Extract and return ONLY valid JSON (no markdown, no code blocks, no explanation). Use this exact structure:

{
  "themes": ["theme1", "theme2", "theme3"],
  "emotional_tone": "string",
  "life_domain": "string",
  "intensity_score": 0.0,
  "significance_score": 0.0,
  "people_mentioned": ["name1", "name2"],
  "places_mentioned": ["place1", "place2"],
  "time_references": ["reference1", "reference2"],
  "brief_insight": "A single sentence insight about this story's meaning or significance.",
  "actionable_advice": "A practical, encouraging suggestion based on the themes and content of this story."
}

Guidelines:
- themes: 1-5 key themes from the story (e.g., "growth", "loss", "discovery", "connection", "geopolitics", "culture", "history")
- emotional_tone: MUST be one of: reflective, joyful, anxious, hopeful, melancholic, grateful, frustrated, peaceful, excited, uncertain, neutral
- life_domain: MUST be one of: work, relationships, health, identity, growth, creativity, spirituality, family, adventure, learning, general
- intensity_score: 0.0-1.0, how emotionally charged is this story?
- significance_score: 0.0-1.0, how important is this event to the person's life story or the topic explored?
- people_mentioned: Extract proper names of people mentioned (empty array if none)
- places_mentioned: Extract specific locations mentioned (empty array if none)
- time_references: Extract time references like "last summer", "when I was 12", "yesterday" (empty array if none)
- brief_insight: A compassionate, insightful one-sentence observation about the story's meaning
- actionable_advice: A specific, practical suggestion the author could act on based on what they wrote. For personal stories, this could be a self-improvement tip or reflection prompt. For historical/geopolitical/cultural stories, this could be a suggestion to explore a related topic, research a source, or consider an alternative perspective. Keep it encouraging, not prescriptive. 1-2 sentences max.

Return ONLY the JSON object, nothing else.`;

// ============================================================================
// Rate Limiting (In-Memory)
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(identifier, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// ============================================================================
// Concurrent Request Tracking (In-Memory)
// ============================================================================

const inProgressAnalysis = new Set<string>();

function isAnalysisInProgress(storyId: string): boolean {
  return inProgressAnalysis.has(storyId);
}

function startAnalysis(storyId: string): void {
  inProgressAnalysis.add(storyId);
}

function endAnalysis(storyId: string): void {
  inProgressAnalysis.delete(storyId);
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

interface GeminiResult {
  text: string;
  attempt: number;
}

async function callGeminiWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  prompt: string,
  storyId: string
): Promise<GeminiResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      analysisLogger.info(storyId, `gemini_attempt_${attempt}`);

      const geminiTimer = new OperationTimer("gemini_call");
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const duration = geminiTimer.stop(true);

      analysisLogger.timed(storyId, "gemini_success", duration, { attempt });

      return { text, attempt };

    } catch (error) {
      lastError = error as Error;
      const isRateLimit = lastError.message?.includes("429") ||
                          lastError.message?.toLowerCase().includes("rate limit");
      const isTimeout = lastError.message?.toLowerCase().includes("timeout");

      analysisLogger.warn(storyId, `gemini_attempt_${attempt}_failed`, {
        error: lastError.message,
        isRateLimit,
        isTimeout,
        willRetry: attempt < MAX_RETRIES,
      });

      performanceMonitor.record("gemini_call", 0, false);

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        analysisLogger.info(storyId, `retry_backoff`, { delayMs: delay });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Gemini API failed after all retries");
}

// ============================================================================
// Content Processing
// ============================================================================

function truncateContent(text: string, storyId: string): { text: string; wasTruncated: boolean } {
  if (text.length <= MAX_CONTENT_LENGTH) {
    return { text, wasTruncated: false };
  }

  analysisLogger.warn(storyId, "content_truncated", {
    originalLength: text.length,
    truncatedTo: MAX_CONTENT_LENGTH,
  });

  // Truncate at word boundary if possible
  let truncated = text.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > MAX_CONTENT_LENGTH - 100) {
    truncated = truncated.slice(0, lastSpace);
  }

  return { text: truncated + " [truncated]", wasTruncated: true };
}

function cleanGeminiResponse(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}

function parseAndValidateMetadata(
  analysisText: string,
  storyId: string
): Record<string, unknown> | null {
  // Try to extract JSON from various formats
  let textToParse = cleanGeminiResponse(analysisText);

  // Try to find JSON object in the response
  const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    textToParse = jsonMatch[0];
  }

  try {
    const metadata = JSON.parse(textToParse);
    analysisLogger.info(storyId, "json_parse_success");
    return metadata;
  } catch {
    // Try to fix common JSON issues
    try {
      // Fix trailing commas
      const fixedText = textToParse
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const metadata = JSON.parse(fixedText);
      analysisLogger.info(storyId, "json_parse_success_after_fix");
      return metadata;
    } catch {
      const previewText = analysisText.slice(0, 200);
      analysisLogger.error(storyId, "json_parse_failed", previewText, {
        responseLength: analysisText.length,
      });
      return null;
    }
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    themes: Array.isArray(metadata.themes)
      ? metadata.themes.slice(0, 5).map((t: unknown) => String(t).toLowerCase())
      : [],
    emotional_tone: VALID_EMOTIONAL_TONES.includes(metadata.emotional_tone as typeof VALID_EMOTIONAL_TONES[number])
      ? metadata.emotional_tone
      : 'neutral',
    life_domain: VALID_LIFE_DOMAINS.includes(metadata.life_domain as typeof VALID_LIFE_DOMAINS[number])
      ? metadata.life_domain
      : 'general',
    intensity_score: typeof metadata.intensity_score === 'number'
      ? Math.max(0, Math.min(1, metadata.intensity_score))
      : 0.5,
    significance_score: typeof metadata.significance_score === 'number'
      ? Math.max(0, Math.min(1, metadata.significance_score))
      : 0.5,
    people_mentioned: Array.isArray(metadata.people_mentioned)
      ? metadata.people_mentioned.map((p: unknown) => String(p))
      : [],
    places_mentioned: Array.isArray(metadata.places_mentioned)
      ? metadata.places_mentioned.map((p: unknown) => String(p))
      : [],
    time_references: Array.isArray(metadata.time_references)
      ? metadata.time_references.map((t: unknown) => String(t))
      : [],
    brief_insight: typeof metadata.brief_insight === 'string'
      ? metadata.brief_insight.slice(0, 500)
      : null,
    actionable_advice: typeof metadata.actionable_advice === 'string'
      ? metadata.actionable_advice.slice(0, 500)
      : null,
  };
}

// ============================================================================
// Main POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  const fullAnalysisTimer = new OperationTimer("full_analysis");
  let storyId = "unknown";

  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    // Check API key configuration
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      analysisLogger.error(storyId, "config_error", "API Key missing");
      return NextResponse.json(
        { error: "Server configuration error: API Key missing" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json();
    storyId = body.storyId || "unknown";
    let storyText = body.storyText;
    const storyType: string | undefined = body.storyType;

    // Input validation
    if (!body.storyId || !storyText) {
      analysisLogger.warn(storyId, "validation_failed", {
        hasStoryId: !!body.storyId,
        hasStoryText: !!storyText,
      });
      return NextResponse.json(
        { error: "Missing required fields: storyId and storyText" },
        { status: 400 }
      );
    }

    // Verify caller owns this story
    const ownershipSupabase = createSupabaseAdminClient();
    const { data: storyOwner } = await ownershipSupabase
      .from("stories")
      .select("author_id")
      .eq("id", body.storyId)
      .single();

    if (storyOwner && storyOwner.author_id !== authenticatedUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Subscription-based analysis limit ──────────────────────────────
    const { data: userRow } = await ownershipSupabase
      .from("users")
      .select("subscription_plan, subscription_expires_at")
      .eq("id", authenticatedUserId)
      .single();

    const subPlan = userRow?.subscription_plan ?? "free";
    const subExpires = userRow?.subscription_expires_at;
    const isPaid = subPlan !== "free" && subExpires && new Date(subExpires) > new Date();

    if (!isPaid) {
      // Count total analyses this calendar month across ALL user's stories
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: userStories } = await ownershipSupabase
        .from("stories")
        .select("id")
        .eq("author_id", authenticatedUserId);

      if (userStories && userStories.length > 0) {
        const storyIds = userStories.map((s: { id: string }) => s.id);
        const { count: monthlyCount } = await ownershipSupabase
          .from("story_metadata")
          .select("story_id", { count: "exact", head: true })
          .in("story_id", storyIds)
          .gte("updated_at", monthStart);

        if ((monthlyCount ?? 0) >= FREE_MONTHLY_ANALYSIS_LIMIT) {
          return NextResponse.json(
            {
              error: "Free plan limit reached (10 analyses/month). Upgrade to Storyteller for unlimited analyses.",
              code: "PLAN_LIMIT_REACHED",
              usage: { used: monthlyCount, limit: FREE_MONTHLY_ANALYSIS_LIMIT },
            },
            { status: 403 }
          );
        }
      }
    }

    // Minimum content length check
    if (storyText.length < MIN_CONTENT_LENGTH) {
      analysisLogger.warn(storyId, "content_too_short", {
        length: storyText.length,
        minimum: MIN_CONTENT_LENGTH,
      });
      return NextResponse.json(
        { error: `Story text must be at least ${MIN_CONTENT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitId = body.storyId; // Could also use IP or user ID
    const rateCheck = checkRateLimit(rateLimitId);
    if (!rateCheck.allowed) {
      analysisLogger.warn(storyId, "rate_limited", { retryAfter: rateCheck.retryAfter });
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfter) },
        }
      );
    }

    // Check for concurrent analysis
    if (isAnalysisInProgress(storyId)) {
      analysisLogger.warn(storyId, "analysis_already_in_progress");
      return NextResponse.json(
        { error: "Analysis already in progress for this story" },
        { status: 409 }
      );
    }

    // Mark analysis as in-progress
    startAnalysis(storyId);

    try {
      // Truncate long content
      const { text: processedText, wasTruncated } = truncateContent(storyText, storyId);
      storyText = processedText;

      // Log analysis start
      analysisLogger.info(storyId, "analysis_started", {
        textLength: storyText.length,
        wasTruncated,
      });

      // Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Build story-type-specific prompt context
      const storyTypeContext: Record<string, string> = {
        personal_journal: "This is a personal journal entry. Focus on emotional depth, personal growth, self-awareness, and reflective patterns. Prioritize life_domain accuracy and emotional_tone nuance.",
        historical_narrative: "This is a historical narrative. Focus on historical significance, cultural context, factual references, and the narrative's contribution to preserving collective memory. Weight significance_score toward historical importance.",
        geopolitical_analysis: "This is a geopolitical analysis. Focus on analytical rigor, multiple perspectives, power dynamics, and systemic implications. Favor themes like 'geopolitics', 'power', 'policy'. Use life_domain 'general' or 'learning' unless another clearly fits.",
        cultural_tale: "This is a cultural tale or tradition being preserved. Focus on cultural preservation, oral tradition markers, community values, and intergenerational knowledge transfer. Weight significance_score toward cultural importance.",
        creative_nonfiction: "This is creative non-fiction. Focus on literary craft, narrative structure, voice, imagery, and the author's storytelling technique. Note both the content themes and the artistic choices.",
      };

      const typeContext = storyType && storyTypeContext[storyType]
        ? `\n\nContext: ${storyTypeContext[storyType]}\n`
        : "";

      // Generate analysis with retry logic
      const prompt = ANALYSIS_PROMPT.replace("{STORY_TEXT}", storyText) + typeContext;
      const { text: analysisText, attempt } = await callGeminiWithRetry(model, prompt, storyId);

      // Parse and validate the response
      const parsedMetadata = parseAndValidateMetadata(analysisText, storyId);
      if (!parsedMetadata) {
        fullAnalysisTimer.stop(false);
        return NextResponse.json(
          { error: "AI returned invalid JSON format" },
          { status: 500 }
        );
      }

      // Sanitize metadata with defaults
      const sanitizedMetadata = sanitizeMetadata(parsedMetadata);

      // Save to database
      const supabase = createSupabaseAdminClient();
      const dbTimer = new OperationTimer("db_upsert");

      const { data, error: insertError } = await supabase
        .from("story_metadata")
        .upsert({
          story_id: storyId,
          ...sanitizedMetadata,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'story_id'
        })
        .select()
        .single();

      if (insertError) {
        dbTimer.stop(false);

        if (insertError.code === "42P01" || insertError.message?.includes("does not exist")) {
          analysisLogger.error(storyId, "db_table_missing", "story_metadata table does not exist");
          fullAnalysisTimer.stop(false);
          return NextResponse.json(
            {
              error: "Database table 'story_metadata' not found. Please run the migration.",
              migration_required: true
            },
            { status: 500 }
          );
        }

        analysisLogger.error(storyId, "db_upsert_failed", insertError.message, {
          code: insertError.code,
        });
        fullAnalysisTimer.stop(false);
        return NextResponse.json(
          { error: "Failed to save metadata to database" },
          { status: 500 }
        );
      }

      const dbDuration = dbTimer.stop(true);
      analysisLogger.timed(storyId, "db_upsert_success", dbDuration);

      // Log successful completion
      const totalDuration = fullAnalysisTimer.stop(true);
      analysisLogger.timed(storyId, "analysis_completed", totalDuration, {
        themes: (sanitizedMetadata.themes as string[]).length,
        emotionalTone: sanitizedMetadata.emotional_tone,
        lifeDomain: sanitizedMetadata.life_domain,
        retryAttempts: attempt,
        wasTruncated,
      });

      // Strip actionable_advice for free users — paid feature only
      const responseMetadata = isPaid ? data : { ...data, actionable_advice: null };

      return NextResponse.json({
        success: true,
        metadata: responseMetadata,
        insight: sanitizedMetadata.brief_insight,
        plan: isPaid ? subPlan : "free",
      });

    } finally {
      // Always clean up in-progress tracking
      endAnalysis(storyId);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze story";
    analysisLogger.error(storyId, "analysis_failed", errorMessage, {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    fullAnalysisTimer.stop(false);
    return NextResponse.json(
      { error: "Failed to analyze story" },
      { status: 500 }
    );
  }
}
