import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import WaitlistEmail from "@/components/emails/WaitlistEmail";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { buildEmailUnsubscribeUrl } from "@/lib/unsubscribeToken";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/** Basic email format validation. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/waitlist
 *
 * Public endpoint — no auth required (pre-signup users).
 * Rate-limited by middleware (10/min per IP).
 *
 * 1. Validate email format
 * 2. Upsert into Supabase `waitlist` table (idempotent)
 * 3. Send confirmation email via Resend (best-effort)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = body?.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const email = rawEmail.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();

    // Upsert so repeat submissions don't create duplicates.
    // On conflict (same email), we update the `updated_at` timestamp
    // but leave `created_at` and `source` unchanged.
    const { error: dbError } = await admin.from("waitlist").upsert(
      {
        email,
        source: "web_homepage",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (dbError) {
      console.error("[WAITLIST] Supabase error:", dbError);
      return NextResponse.json(
        { error: "Could not save your email. Please try again." },
        { status: 500 },
      );
    }

    // Send confirmation email (best-effort — don't fail the request)
    try {
      if (process.env.RESEND_API_KEY) {
        const unsubscribeUrl = buildEmailUnsubscribeUrl(email, "waitlist");
        const { error: emailError } = await getResend().emails.send({
          from: "EStories <noreply@estories.app>",
          to: [email],
          subject: "You're on the EStories waitlist!",
          react: WaitlistEmail({ email, unsubscribeUrl }),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (emailError) {
          console.error("[WAITLIST] Resend error:", emailError);
        }
      }
    } catch (sendErr) {
      console.error("[WAITLIST] Resend send error:", sendErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[WAITLIST] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
