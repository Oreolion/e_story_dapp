import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

/**
 * GET /api/payment/status
 *
 * Returns the authenticated user's subscription status.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);

    const admin = createSupabaseAdminClient();
    const { data: user, error } = await admin
      .from("users")
      .select("subscription_plan, subscription_expires_at")
      .eq("id", userId)
      .single();

    if (error) return NextResponse.json({ error: "Subscription status unavailable" }, { status: 503 });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const isActive =
      user.subscription_plan &&
      user.subscription_plan !== "free" &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date();

    // Check for any pending payment (regardless of expiry — user may have sent funds)
    const { data: pendingPayment } = await admin
      .from("payments")
      .select("payment_address, plan, amount_expected, currency, created_at, expires_at, deferred, amount_received")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      plan: isActive ? user.subscription_plan : "free",
      active: !!isActive,
      expires_at: isActive ? user.subscription_expires_at : null,
      pending_payment: pendingPayment
        ? {
            address: pendingPayment.payment_address,
            plan: pendingPayment.plan,
            amount: pendingPayment.amount_expected,
            currency: pendingPayment.currency,
            expires_at: pendingPayment.expires_at,
          }
        : null,
    });
  } catch (err) {
    console.error("[PAYMENT_STATUS] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
