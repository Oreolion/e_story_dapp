import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import WelcomeEmail from "@/components/emails/WelcomeEmail";
import WaitlistEmail from "@/components/emails/WaitlistEmail";
import SubscriptionEmail from "@/components/emails/SubscriptionEmail";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const EMAIL_RATE_LIMIT = 5; // per hour per user

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    // Rate limit: 5 emails per hour per authenticated user
    const { allowed, remaining } = checkRateLimit(
      `email:send:${userId}`,
      EMAIL_RATE_LIMIT,
      60 * 60_000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Email rate limit exceeded. Max ${EMAIL_RATE_LIMIT} per hour.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, username, type, plan, expiresAt } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    let emailComponent;
    let subject = "";

    // Switch logic to handle different email types
    switch (type) {
      case "welcome":
        emailComponent = WelcomeEmail({ username: username || "Storyteller" });
        subject = "Welcome to EStories";
        break;
      case "waitlist":
        emailComponent = WaitlistEmail({ email });
        subject = "You're on the EStories waitlist!";
        break;
      case "subscription":
        emailComponent = SubscriptionEmail({
          username: username || "Storyteller",
          plan: plan || "storyteller",
          expiresAt: expiresAt || "30 days",
        });
        subject = `Your ${(plan || "storyteller").charAt(0).toUpperCase() + (plan || "storyteller").slice(1)} subscription is active!`;
        break;
      default:
        return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
    }

    const data = await getResend().emails.send({
      from: "EStories <noreply@estories.app>",
      to: [email],
      subject: subject,
      react: emailComponent,
    });

    if (data.error) {
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.data?.id });

  } catch (error: unknown) {
    console.error("[EMAIL] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
