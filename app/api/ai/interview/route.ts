import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { interviewRequest } from "@/lib/story/interview";
import { runInterviewQuestion } from "@/lib/ai/interview";
import { aiGenerationHold } from "@/lib/ai/availability";
import { admitTextInference } from "@/lib/ai/admission";
import { createTextGenerator, inferenceErrorStatus } from "@/lib/ai/provider";

const reply = (body: unknown, status = 200, headers = {}) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
class BodyTooLarge extends Error {}
async function readInput(req: NextRequest): Promise<unknown> {
  const limit = 64 * 1024;
  if (Number(req.headers.get("content-length")) > limit)
    throw new BodyTooLarge();
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) throw new BodyTooLarge();
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAuthOrReject(req);
    if (isAuthError(auth)) return auth;
    const owner = await resolveUserId(auth);
    // A stale browser account must never submit another person's interview.
    if (req.headers.get("x-profile-owner-id") !== owner)
      return reply(
        { error: "Your account changed. Reload before continuing." },
        409,
      );
    const hold = aiGenerationHold();
    if (hold) return reply(hold, 503);
    if (
      !req.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return reply({ error: "JSON required" }, 415);
    let raw: unknown;
    try {
      raw = await readInput(req);
    } catch (error) {
      return reply(
        { error: "Invalid interview input" },
        error instanceof BodyTooLarge ? 413 : 400,
      );
    }
    const input = interviewRequest.safeParse(raw);
    if (!input.success)
      return reply(
        {
          error:
            "Use up to five completed answers, each at most 1,500 characters.",
        },
        400,
      );
    // Interview questions share the existing text-assistance budget. No new RPC
    // task or migration: a fallback call must also reserve this same pool.
    const reserve = () =>
      admitTextInference(createSupabaseAdminClient(), owner, "enhancement");
    const admission = await reserve();
    if (!admission.allowed)
      return reply(
        {
          error: admission.unavailable
            ? "AI usage controls are unavailable. Your answers are still here."
            : "AI assistance limit reached. You can continue writing.",
        },
        admission.unavailable ? 503 : 429,
        { "Retry-After": String(admission.retryAfter) },
      );
    const result = await runInterviewQuestion(
      input.data,
      createTextGenerator(25_000, undefined, "interview", {
        reserveFallback: async () => (await reserve()).allowed,
      }),
    );
    return reply(result);
  } catch (error) {
    // Never log the request, provider output or exception containing story data.
    console.error("Interview question unavailable");
    return reply(
      {
        error:
          "Could not prepare the next question. Your answers have been kept.",
      },
      inferenceErrorStatus(error),
    );
  }
}
