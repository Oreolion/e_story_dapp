import { runEditing } from "@/lib/ai/tasks";
import { createTextGenerator, inferenceErrorStatus } from "@/lib/ai/provider";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { admitTextInference } from "@/lib/ai/admission";
import { hasTextProvider } from "@/lib/ai/providerPolicy";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { aiGenerationHold } from "@/lib/ai/availability";

const MAX_TEXT_LENGTH = 50000;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const hold = aiGenerationHold();
    if (hold) return NextResponse.json(hold, { status: 503, headers: { "Cache-Control": "no-store" } });

    if (!hasTextProvider()) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { text, task = "enhancement" } = body ?? {};
    if (!["enhancement", "tracker"].includes(task)) return NextResponse.json({ error: "Unsupported editing task" }, { status: 400 });

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const quota = await admitTextInference(createSupabaseAdminClient(), userId, task);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.unavailable
            ? "Usage controls are temporarily unavailable. Please try again later."
            : "Daily enhancement limit reached. Please try again after the quota resets.",
        },
        {
          status: quota.unavailable ? 503 : 429,
          headers: { "Retry-After": String(quota.retryAfter) },
        }
      );
    }

    const enhancedText = await runEditing(text, task, createTextGenerator(25_000, undefined, task, {
      reserveFallback: async () => (await admitTextInference(createSupabaseAdminClient(), userId, task)).allowed,
    }));

    return NextResponse.json({ text: enhancedText });

  } catch (error: unknown) {
    console.error("Enhancement failed");
    return NextResponse.json(
      { error: "Failed to enhance text" },
      { status: inferenceErrorStatus(error) }
    );
  }
}
