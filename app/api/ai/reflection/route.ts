import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

// ============================================================================
// Configuration Constants
// ============================================================================

const REFLECTION_COOLDOWN_DAYS = 7; // 1 reflection per week
const MAX_STORIES_TO_ANALYZE = 20; // Limit stories for context window
const CANONICAL_WEIGHT_MULTIPLIER = 2.0; // Canonical stories count 2x

// Valid values for validation
const VALID_EMOTIONAL_TONES = [
  'reflective', 'joyful', 'anxious', 'hopeful', 'melancholic',
  'grateful', 'frustrated', 'peaceful', 'excited', 'uncertain', 'neutral'
] as const;

const VALID_LIFE_DOMAINS = [
  'work', 'relationships', 'health', 'identity', 'growth',
  'creativity', 'spirituality', 'family', 'adventure', 'learning', 'general'
] as const;

const REFLECTION_PROMPT = `You are a compassionate life coach analyzing a week of personal journal entries.
Write a thoughtful, empathetic reflection that helps the user understand patterns in their life.

Journal Entries from the Past Week:
"""
{STORIES_TEXT}
"""

Write a 2-3 paragraph reflection that:
1. Identifies dominant themes and emotional patterns across the entries
2. Notes any significant life moments or recurring concerns
3. Offers gentle, supportive insights about what you observe
4. Encourages continued journaling and self-reflection

Return ONLY valid JSON (no markdown, no code blocks) in this exact structure:
{
  "reflection_text": "Your 2-3 paragraph reflection here. Use complete sentences and a warm, supportive tone.",
  "themes_identified": ["theme1", "theme2", "theme3"],
  "dominant_tone": "one of: reflective, joyful, anxious, hopeful, melancholic, grateful, frustrated, peaceful, excited, uncertain, neutral",
  "dominant_domain": "one of: work, relationships, health, identity, growth, creativity, spirituality, family, adventure, learning, general"
}

Guidelines:
- Be warm and encouraging, not clinical
- Focus on patterns, not individual events
- Offer perspective without being prescriptive
- If entries are sparse or brief, acknowledge this gently
- Maximum 500 words for reflection_text`;

const EMPTY_WEEK_PROMPT = `You are a compassionate life coach. The user has not recorded any journal entries this week.
Write an encouraging message to motivate them to start journaling.

Return ONLY valid JSON:
{
  "reflection_text": "A warm, encouraging 1-2 paragraph message about the value of journaling and self-reflection. Don't be preachy.",
  "themes_identified": [],
  "dominant_tone": "hopeful",
  "dominant_domain": "growth"
}`;

// ============================================================================
// Helper Functions
// ============================================================================

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Week starts on Sunday (day 0)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function cleanGeminiResponse(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}

function parseAndValidateReflection(
  responseText: string
): { reflection_text: string; themes_identified: string[]; dominant_tone: string; dominant_domain: string } | null {
  let textToParse = cleanGeminiResponse(responseText);

  const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    textToParse = jsonMatch[0];
  }

  try {
    const data = JSON.parse(textToParse);
    return {
      reflection_text: typeof data.reflection_text === 'string' ? data.reflection_text.slice(0, 2000) : '',
      themes_identified: Array.isArray(data.themes_identified)
        ? data.themes_identified.slice(0, 5).map((t: unknown) => String(t).toLowerCase())
        : [],
      dominant_tone: VALID_EMOTIONAL_TONES.includes(data.dominant_tone as typeof VALID_EMOTIONAL_TONES[number])
        ? data.dominant_tone
        : 'neutral',
      dominant_domain: VALID_LIFE_DOMAINS.includes(data.dominant_domain as typeof VALID_LIFE_DOMAINS[number])
        ? data.dominant_domain
        : 'general',
    };
  } catch {
    // Try fixing common JSON issues
    try {
      const fixedText = textToParse
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const data = JSON.parse(fixedText);
      return {
        reflection_text: typeof data.reflection_text === 'string' ? data.reflection_text.slice(0, 2000) : '',
        themes_identified: Array.isArray(data.themes_identified)
          ? data.themes_identified.slice(0, 5).map((t: unknown) => String(t).toLowerCase())
          : [],
        dominant_tone: VALID_EMOTIONAL_TONES.includes(data.dominant_tone as typeof VALID_EMOTIONAL_TONES[number])
          ? data.dominant_tone
          : 'neutral',
        dominant_domain: VALID_LIFE_DOMAINS.includes(data.dominant_domain as typeof VALID_LIFE_DOMAINS[number])
          ? data.dominant_domain
          : 'general',
      };
    } catch {
      console.error("Failed to parse reflection JSON:", responseText.slice(0, 200));
      return null;
    }
  }
}

// ============================================================================
// GET Handler - Fetch existing reflections
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || authenticatedUserId;
    const limit = parseInt(searchParams.get("limit") || "5");

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
      .select("subscription_plan, subscription_expires_at")
      .eq("id", authenticatedUserId)
      .single();

    const subPlan = userRow?.subscription_plan ?? "free";
    const subExpires = userRow?.subscription_expires_at;
    const isPaid = subPlan !== "free" && subExpires && new Date(subExpires) > new Date();

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
          canGenerate: true,
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
      canGenerate: !hasReflectionThisWeek,
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
    const authenticatedUserId = authResult;

    // Subscription check — weekly reflections require storyteller+ plan
    const adminClient = createSupabaseAdminClient();
    const { data: postUserRow } = await adminClient
      .from("users")
      .select("subscription_plan, subscription_expires_at")
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
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: API Key missing" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { userWallet } = body;
    const userId = authenticatedUserId;

    if (!userWallet) {
      return NextResponse.json(
        { error: "Missing required field: userWallet" },
        { status: 400 }
      );
    }

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
      nextAvailable.setDate(nextAvailable.getDate() + REFLECTION_COOLDOWN_DAYS);

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
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: stories, error: storiesError } = await supabase
      .from("stories")
      .select(`
        id, title, content, created_at, mood,
        story_metadata (themes, emotional_tone, life_domain, is_canonical, significance_score)
      `)
      .eq("author_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_STORIES_TO_ANALYZE);

    if (storiesError) {
      console.error("Error fetching stories:", storiesError);
      // Continue with empty stories if metadata table doesn't exist
      if (storiesError.code !== "42P01" && !storiesError.message?.includes("does not exist")) {
        throw storiesError;
      }
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let prompt: string;
    const storyIds: string[] = [];
    let canonicalWeight = 0;

    if (!stories || stories.length === 0) {
      // No stories this week - generate encouraging message
      prompt = EMPTY_WEEK_PROMPT;
    } else {
      // Format stories for the prompt
      // Weight canonical stories higher by repeating their content
      const storiesText = stories.map((story) => {
        const metadata = story.story_metadata?.[0] || story.story_metadata;
        const isCanonical = metadata?.is_canonical === true;
        const storyDate = new Date(story.created_at).toLocaleDateString();

        if (isCanonical) {
          canonicalWeight += CANONICAL_WEIGHT_MULTIPLIER;
        }

        storyIds.push(story.id);

        // Format: include date, title, mood, and content
        let storyEntry = `[${storyDate}] ${story.title || "Untitled"}\nMood: ${story.mood || "not specified"}\n${story.content}`;

        // For canonical stories, add emphasis
        if (isCanonical) {
          storyEntry = `**KEY MOMENT**\n${storyEntry}`;
        }

        return storyEntry;
      }).join("\n\n---\n\n");

      prompt = REFLECTION_PROMPT.replace("{STORIES_TEXT}", storiesText);
    }

    // Generate reflection
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Parse and validate
    const parsedReflection = parseAndValidateReflection(responseText);
    if (!parsedReflection) {
      return NextResponse.json(
        { error: "AI returned invalid response format" },
        { status: 500 }
      );
    }

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

    if (saveError) {
      // If table doesn't exist, return the reflection without saving
      if (saveError.code === "42P01" || saveError.message?.includes("does not exist")) {
        return NextResponse.json({
          success: true,
          reflection: {
            ...reflectionData,
            id: "temp-" + Date.now(),
            created_at: new Date().toISOString(),
          },
          message: "Reflection generated but not saved - table not yet created. Please run migration.",
          migration_required: true
        });
      }
      throw saveError;
    }

    return NextResponse.json({
      success: true,
      reflection: savedReflection,
      storiesAnalyzed: storyIds.length,
      canonicalWeight
    });

  } catch (error: unknown) {
    console.error("Error generating reflection:", error);
    return NextResponse.json(
      { error: "Failed to generate reflection" },
      { status: 500 }
    );
  }
}
