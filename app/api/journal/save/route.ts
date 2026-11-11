import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { parseJournalInput } from "@/lib/stories/contracts";
import { aiGenerationHold } from "@/lib/ai/availability";

export async function POST(request: NextRequest) {
  try {
    const actor = await validateAuthOrReject(request);
    if (isAuthError(actor)) return actor;
    const ownerId = await resolveUserId(actor);
    let body: ReturnType<typeof parseJournalInput>;
    try { body = parseJournalInput(await request.json()); }
    catch { return NextResponse.json({ error: "Invalid journal fields or conflicting aliases" }, { status: 400 }); }
    const hold = aiGenerationHold();
    const admin = createSupabaseAdminClient();
    const { data: owner, error } = await admin.from("users").select("wallet_address, subscription_plan, subscription_expires_at").eq("id", ownerId).single();
    if (error || !owner) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (body.parent_story_id) {
      if (!owner.subscription_plan || owner.subscription_plan === "free" || Date.parse(owner.subscription_expires_at ?? "") <= Date.now() || !Number.isFinite(Date.parse(owner.subscription_expires_at ?? ""))) {
        return NextResponse.json({ error: "Story continuations require an active paid plan", code: "PLAN_REQUIRED" }, { status: 403 });
      }
      const { data: parent, error: parentError } = await admin.from("stories").select("author_id").eq("id", body.parent_story_id).maybeSingle();
      if (parentError) return NextResponse.json({ error: "Unable to verify parent ownership" }, { status: 503 });
      if (!parent || parent.author_id !== ownerId) return NextResponse.json({ error: "Parent story not found" }, { status: 404 });
    }
    // Migration 020 enqueues analysis in the same transaction as this insert.
    // No self-HTTP, detached promise, CRE call or auth credentials in a job.
    const { data: story, error: insertError } = await admin.from("stories").insert({
      author_id: ownerId, author_wallet: owner.wallet_address,
      title: body.title ?? `Journal Entry ${new Date().toISOString().slice(0, 10)}`,
      content: body.content, mood: body.mood, tags: body.tags,
      has_audio: !!body.audio_url, audio_url: body.audio_url ?? null,
      is_public: body.is_public, story_type: body.story_type,
      ...(body.story_date ? { story_date: body.story_date } : {}),
      ...(body.parent_story_id ? { parent_story_id: body.parent_story_id } : {}),
      likes: 0, comments_count: 0, shares: 0,
    }).select().single();
    if (insertError?.message === "Story write quota exceeded") return NextResponse.json({ error: "Daily story write limit reached" }, { status: 429 });
    if (insertError || !story) return NextResponse.json({ error: "Failed to save journal entry" }, { status: 500 });
    return NextResponse.json({ success: true, data: story, message: "Journal entry saved", analysis: hold ? { status: "disabled", error_code: hold.code } : { status: body.content.length < 50 ? "skipped" : typeof story.revision === "number" ? "queued" : "unavailable" } });
  } catch {
    console.error("Journal save failed");
    return NextResponse.json({ error: "Failed to save journal entry" }, { status: 500 });
  }
}
