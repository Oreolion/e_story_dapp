import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { consumeApiQuota } from "@/lib/apiQuota";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

const MAX_TEXT_LENGTH = 50000;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { text } = await req.json();

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

    const quota = await consumeApiQuota(createSupabaseAdminClient(), userId, {
      action: "ai_enhance_day",
      maxRequests: 30,
      windowSeconds: 24 * 60 * 60,
    });
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert storytelling editor. Please enhance the following journal entry.
      - Fix grammar and spelling errors.
      - Improve the flow and vocabulary while keeping the original personal tone.
      - Do not change the underlying meaning or add fictional events.
      - Return ONLY the enhanced text. Do not include quotes around the result.

      Original Text:
      "${text}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const enhancedText = response.text();

    return NextResponse.json({ text: enhancedText });

  } catch (error: unknown) {
    console.error("Enhancement error:", error);
    return NextResponse.json(
      { error: "Failed to enhance text" },
      { status: 500 }
    );
  }
}
