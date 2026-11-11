import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { aiGenerationHold } from "@/lib/ai/availability";
const input = z.object({ storyId: z.string().uuid(), retry: z.boolean().optional() });

// Compatibility entry point: schedules canonical persisted content, never the
// caller-supplied storyText. Saving already enqueues atomically via migration 020.
export async function POST(request: NextRequest) {
  const actor = await validateAuthOrReject(request);
  if (isAuthError(actor)) return actor;
  const owner = await resolveUserId(actor);
  const hold = aiGenerationHold();
  if (hold) return NextResponse.json(hold, { status: 503, headers: { "Cache-Control": "no-store" } });
  let body: z.infer<typeof input>;
  let legacyInline = false;
  try {
    const raw = await request.json();
    body = input.parse(raw);
    // Deployed inline clients include storyText and treat every 2xx as completed.
    // This marker changes response compatibility only; text is never executed.
    legacyInline = Object.prototype.hasOwnProperty.call(raw, "storyText");
  }
  catch { return NextResponse.json({ error: "A valid storyId is required" }, { status: 400 }); }
  const admin = createSupabaseAdminClient();
  const { data: story, error } = await admin.from("stories").select("author_id,content,revision").eq("id", body.storyId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to verify ownership" }, { status: 503 });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (story.author_id !== owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (story.content.trim().length < 50) return NextResponse.json({ error: "Story text must be at least 50 characters" }, { status: 400 });
  if (story.content.length > 50_000) return NextResponse.json({ error: "Story text exceeds the analysis limit of 50,000 characters" }, { status: 400 });
  if (body.retry) {
    const { data: retried, error: retryError } = await admin.rpc("retry_ai_job", { p_owner_id: owner, p_story_id: body.storyId });
    if (retryError) return NextResponse.json({ error: "Analysis recovery unavailable" }, { status: 503 });
    if (retried !== true) return NextResponse.json({ error: "This analysis cannot be retried", code: "RETRY_UNAVAILABLE" }, { status: 409 });
  }
  const { data: job, error: enqueueError } = await admin.rpc("ensure_ai_job", { p_owner_id: owner, p_story_id: body.storyId });
  if (enqueueError || !job) return NextResponse.json({ error: "Analysis scheduling unavailable" }, { status: 503 });
  const value = Array.isArray(job) ? job[0] : job;
  const headers = { "Cache-Control": "no-store" };
  if (!value) return NextResponse.json({ error: "Analysis scheduling unavailable" }, { status: 503, headers });
  if (value.status === "succeeded") {
    const { data: metadata, error: metadataError } = await admin.from("story_metadata").select("*").eq("story_id", body.storyId).eq("source_revision", story.revision).maybeSingle();
    if (metadataError || !metadata) return NextResponse.json({ error: "Analysis result unavailable" }, { status: 503, headers });
    return NextResponse.json({ success: true, status: value.status, jobId: value.id, metadata }, { headers });
  }
  if (!["queued", "running", "retry_wait"].includes(value.status)) {
    return NextResponse.json({ error: "Analysis is unavailable. Refresh this page to see recovery options.", code: "ANALYSIS_UNAVAILABLE", status: value.status }, { status: 409, headers });
  }
  if (legacyInline) {
    return NextResponse.json({ error: "Analysis is queued. Refresh this page shortly to see your insights.", code: "ANALYSIS_PENDING", status: value.status, jobId: value.id }, { status: 409, headers: { ...headers, "Retry-After": "5" } });
  }
  return NextResponse.json({ success: true, status: value.status, jobId: value.id }, { status: 202, headers });
}
export async function GET(request: NextRequest) {
  const actor = await validateAuthOrReject(request);
  if (isAuthError(actor)) return actor;
  const owner = await resolveUserId(actor);
  const parsed = input.safeParse({ storyId: request.nextUrl.searchParams.get("storyId") });
  if (!parsed.success) return NextResponse.json({ error: "A valid storyId is required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: story, error } = await admin.from("stories").select("author_id,revision").eq("id", parsed.data.storyId).maybeSingle();
  if (error) return NextResponse.json({ error: "Status unavailable" }, { status: 503 });
  if (!story || story.author_id !== owner) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  const { data: job, error: jobError } = await admin.from("ai_jobs").select("status,error_code,updated_at").eq("story_id", parsed.data.storyId).eq("source_revision", story.revision).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (jobError) return NextResponse.json({ error: "Status unavailable" }, { status: 503 });
  const hold = aiGenerationHold();
  if (hold && job?.status !== "succeeded") return NextResponse.json({ analysis: { status: "disabled", error_code: hold.code } }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ analysis: job ?? { status: "skipped" } }, { headers: { "Cache-Control": "no-store" } });
}
