import { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import SubscriptionEmail from "@/components/emails/SubscriptionEmail";
import { buildUnsubscribeUrl } from "@/lib/unsubscribeToken";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * Activate a user's subscription and send notification + email.
 *
 * Called from both the webhook route and the manual verify route.
 * Returns the expiry date if successful, or throws on failure.
 */
export async function activateSubscription(
  admin: SupabaseClient,
  userId: string,
  plan: string
): Promise<{ expiresAt: string }> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const expiresIso = expiresAt.toISOString();
  const expiresDisplay = expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

  // 1. Update user subscription
  const { error: userErr } = await admin
    .from("users")
    .update({
      subscription_plan: plan,
      subscription_expires_at: expiresIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (userErr) {
    console.error("[SUBSCRIPTION] Failed to update user:", userErr);
    throw new Error("Failed to activate subscription");
  }

  // 2. Create in-app notification (best-effort)
  try {
    await admin.from("notifications").insert({
      user_id: userId,
      type: "subscription",
      title: `${planName} Plan Activated`,
      message: `Your ${planName} subscription is now active! Valid until ${expiresDisplay}. Enjoy unlimited AI analyses and all premium features.`,
      link: "/pricing",
      read: false,
      metadata: { plan, expires_at: expiresIso },
      created_at: new Date().toISOString(),
    });
  } catch (notifErr) {
    console.error("[SUBSCRIPTION] Notification insert failed:", notifErr);
  }

  // 3. Send confirmation email (best-effort)
  try {
    const { data: user, error: userLookupErr } = await admin
      .from("users")
      .select("email, username, name")
      .eq("id", userId)
      .single();

    if (userLookupErr) {
      console.error("[SUBSCRIPTION] User lookup for email failed:", userLookupErr);
    } else if (user?.email) {
      const displayName = user.name || user.username || "Storyteller";
      const unsubscribeUrl = buildUnsubscribeUrl(userId, "all");
      await getResend().emails.send({
        from: "EStories <support@estories.app>",
        to: [user.email],
        subject: `Your ${planName} subscription is active!`,
        react: SubscriptionEmail({
          username: displayName,
          plan,
          expiresAt: expiresDisplay,
          unsubscribeUrl,
        }),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    }
  } catch (emailErr) {
    console.error("[SUBSCRIPTION] Email send failed:", emailErr);
  }

  console.log(
    `[SUBSCRIPTION] Activated: user=${userId} plan=${plan} expires=${expiresIso}`
  );

  return { expiresAt: expiresIso };
}
