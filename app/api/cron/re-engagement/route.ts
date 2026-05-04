import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { Resend } from "resend";
import { safeCompare } from "@/lib/crypto";
import ReEngagementEmail from "@/components/emails/ReEngagementEmail";
import { buildUnsubscribeUrl } from "@/lib/unsubscribeToken";

export const dynamic = "force-dynamic";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * GET /api/cron/re-engagement
 * Runs daily via Vercel Cron. Sends re-engagement emails to inactive users.
 * Protected by CRON_SECRET header (timing-safe comparison).
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret with timing-safe comparison
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Find users who:
    // 1. Have been onboarded (is_onboarded = true)
    // 2. Have an email
    // 3. Haven't opted out of re-engagement emails
    const { data: users, error: usersError } = await admin
      .from("users")
      .select(
        "id, name, username, email, notification_preferences, created_at"
      )
      .eq("is_onboarded", true)
      .not("email", "is", null);

    if (usersError) {
      console.error("[CRON re-engagement] Users fetch error:", usersError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0, message: "No users to process" });
    }

    let sent = 0;
    let skipped = 0;
    const resend = getResend();
    const now = Date.now();

    // Tiered thresholds (in days). We send at most one email per 7-day window.
    const TIER_DAYS = [30, 14, 7];
    const MIN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

    for (const user of users) {
      const prefs =
        (user.notification_preferences as Record<string, unknown> | null) || {};

      // Skip if re-engagement emails or email_notifications are disabled
      if (prefs.re_engagement_emails === false) {
        skipped++;
        continue;
      }
      if (prefs.email_notifications === false) {
        skipped++;
        continue;
      }

      // Compute days since last story — fall back to account creation date for
      // users who never wrote, so brand-new users don't immediately qualify.
      const { data: lastStory } = await admin
        .from("stories")
        .select("created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const referenceDate = lastStory?.created_at
        ? new Date(lastStory.created_at).getTime()
        : user.created_at
        ? new Date(user.created_at).getTime()
        : now;
      const daysSince = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

      // Skip users who've been active in the last 7 days
      if (daysSince < 7) continue;

      // Throttle: never send two re-engagement emails within 7 days
      const lastSentAt =
        typeof prefs.last_re_engagement_sent_at === "string"
          ? new Date(prefs.last_re_engagement_sent_at).getTime()
          : 0;
      if (lastSentAt && now - lastSentAt < MIN_COOLDOWN_MS) {
        skipped++;
        continue;
      }

      // Pick the highest-tier threshold the user qualifies for
      const tier = TIER_DAYS.find((t) => daysSince >= t);
      if (!tier) continue;

      const subject =
        tier >= 30
          ? "Your stories are waiting for you"
          : tier >= 14
          ? "Two weeks without a story?"
          : "Time to capture today's story";

      try {
        const unsubscribeUrl = buildUnsubscribeUrl(user.id, "re_engagement");
        await resend.emails.send({
          from: "EStories <noreply@estories.app>",
          to: [user.email],
          subject,
          react: ReEngagementEmail({
            username: user.name || user.username || "Storyteller",
            daysSinceLastStory: daysSince,
            unsubscribeUrl,
          }),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        // Record the send timestamp so the same user isn't re-emailed next run.
        await admin
          .from("users")
          .update({
            notification_preferences: {
              ...prefs,
              last_re_engagement_sent_at: new Date().toISOString(),
              last_re_engagement_tier: tier,
            },
          })
          .eq("id", user.id);

        sent++;
      } catch (emailErr) {
        console.error(`[CRON re-engagement] Email to ${user.id} failed:`, emailErr);
      }
    }

    return NextResponse.json({
      sent,
      skipped,
      total: users.length,
      message: `Re-engagement emails sent: ${sent}, skipped: ${skipped}`,
    });
  } catch (err) {
    console.error("[CRON re-engagement] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
