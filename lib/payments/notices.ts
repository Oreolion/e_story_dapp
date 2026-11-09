import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { render } from "@react-email/render";
import SubscriptionEmail from "@/components/emails/SubscriptionEmail";
import { z } from "zod";
import { assertEmailRecipient } from "@/lib/runtime/config";
import { assertReleaseActive } from "@/lib/runtime/release";
type Admin = ReturnType<typeof createSupabaseAdminClient>;
const noticeContract = z.object({ payment_id: z.string().uuid(), user_id: z.string().uuid(), plan: z.enum(["storyteller","creator"]), expires_at: z.string(), lease_token: z.string().uuid(), email_payload: z.unknown().optional() });
const emailContract = z.object({ from: z.string(), to: z.array(z.string().email()).length(1), subject: z.string(), html: z.string().max(100000) }).strict();
export async function dispatchPaymentNotice(admin: Admin) {
  assertReleaseActive();
  const { error: creditError } = await admin.rpc("activate_due_payment_credit");
  if (creditError) throw new Error("Deferred payment recovery unavailable");
  const { data, error } = await admin.rpc("claim_payment_notice");
  if (error) throw new Error("Notification claim unavailable");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: "idle" };
  const notice = noticeContract.parse(row);
  try {
    const { data: user, error: userError } = await admin.from("users").select("email,name,username").eq("id", notice.user_id).single();
    if (userError || !user) throw new Error("Notification owner unavailable");
    const { error: notificationError } = await admin.from("notifications").upsert({
      id: notice.payment_id, user_id: notice.user_id, type: "subscription", title: `${notice.plan} plan activated`,
      message: `Your subscription was activated until ${notice.expires_at}.`, link: "/pricing", read: false,
      metadata: { plan: notice.plan, expires_at: notice.expires_at },
    }, { onConflict: "id", ignoreDuplicates: true });
    if (notificationError) throw new Error("Notification persistence unavailable");
    if (user.email || notice.email_payload) {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("Email is not configured");
      const html = notice.email_payload ? "" : await render(SubscriptionEmail({ username: user.name || user.username || "Storyteller", plan: notice.plan, expiresAt: notice.expires_at }));
      const payload = emailContract.parse(notice.email_payload ?? { from: "EStories <support@estories.app>", to: [user.email], subject: `Your ${notice.plan} subscription is active`, html });
      for (const recipient of payload.to) assertEmailRecipient(recipient);
      const { data: frozen, error: freezeError } = await admin.rpc("prepare_payment_notice_email", { p_payment_id: notice.payment_id, p_lease_token: notice.lease_token, p_payload: payload });
      if (freezeError || !frozen) throw new Error("Email preparation unavailable");
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `payment-activation/${notice.payment_id}` }, body: JSON.stringify(emailContract.parse(frozen)), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Email delivery unavailable");
    }
    const { data: committed, error: completionError } = await admin.rpc("finish_payment_notice", { p_payment_id: notice.payment_id, p_lease_token: notice.lease_token, p_success: true });
    if (completionError) throw new Error("Notification completion unavailable");
    return { status: committed === true ? "sent" : "superseded" };
  } catch {
    const { error: failureError } = await admin.rpc("finish_payment_notice", { p_payment_id: notice.payment_id, p_lease_token: notice.lease_token, p_success: false });
    if (failureError) throw new Error("Notification recovery unavailable");
    return { status: "retry_or_failed" };
  }
}
