import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import {
  verifyUnsubscribeToken,
  UnsubscribeTokenPayload,
} from "@/lib/unsubscribeToken";

/**
 * Shared handler. Applies the unsubscribe based on payload shape:
 * - userId-based: flips `notification_preferences` flags
 * - email-based (waitlist): deletes the waitlist row
 */
async function applyUnsubscribe(payload: UnsubscribeTokenPayload) {
  const admin = createSupabaseAdminClient();

  if (payload.email && payload.category === "waitlist") {
    await admin.from("waitlist").delete().eq("email", payload.email);
    return;
  }

  if (!payload.userId) return;

  const { data: user } = await admin
    .from("users")
    .select("notification_preferences")
    .eq("id", payload.userId)
    .single();

  const prefs =
    (user?.notification_preferences as Record<string, unknown> | null) || {};
  const updated: Record<string, unknown> = { ...prefs };

  if (payload.category === "all") {
    updated.email_notifications = false;
    updated.re_engagement_emails = false;
    updated.marketing_emails = false;
  } else if (payload.category === "re_engagement") {
    updated.re_engagement_emails = false;
  } else if (payload.category === "marketing") {
    updated.marketing_emails = false;
  }

  await admin
    .from("users")
    .update({ notification_preferences: updated })
    .eq("id", payload.userId);
}

/**
 * GET /api/unsubscribe?token=<signed>
 * Public endpoint (no auth): clicking the unsubscribe link in an email
 * flips notification_preferences to stop further emails of the given
 * category. "all" disables all transactional/marketing email. "waitlist"
 * deletes the email from the waitlist table.
 *
 * Redirects to /unsubscribe for user feedback.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const origin = req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/unsubscribe?status=invalid`);
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return NextResponse.redirect(`${origin}/unsubscribe?status=invalid`);
  }

  try {
    await applyUnsubscribe(payload);
    return NextResponse.redirect(
      `${origin}/unsubscribe?status=ok&category=${payload.category}`
    );
  } catch (err) {
    console.error("[API /unsubscribe] error:", err);
    return NextResponse.redirect(`${origin}/unsubscribe?status=error`);
  }
}

/**
 * POST /api/unsubscribe
 * Supports RFC 8058 "List-Unsubscribe=One-Click" header from Gmail/Apple Mail.
 * Same behavior as GET but responds with 200 (no redirect).
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const payload = verifyUnsubscribeToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  try {
    await applyUnsubscribe(payload);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /unsubscribe POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
