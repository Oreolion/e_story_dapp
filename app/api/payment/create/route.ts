import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { createPaymentAddress, PLAN_PRICES } from "@/lib/blockradar";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { paymentConfiguration } from "@/lib/payments/receipts";

/**
 * POST /api/payment/create
 *
 * Creates a Blockradar payment address for the authenticated user.
 * The user sends USDC/USDT to this address to activate their subscription.
 *
 * Body: { plan: "storyteller" | "creator" }
 * Returns: { address, amount, currency, plan }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    try { paymentConfiguration(); } catch { return NextResponse.json({ error: "Payment acceptance unavailable" }, { status: 503 }); }

    const body = await req.json();
    const { plan } = body;

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: "Invalid plan. Choose 'storyteller' or 'creator'." },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription
    const admin = createSupabaseAdminClient();
    const { data: user, error: userErr } = await admin
      .from("users")
      .select("subscription_plan, subscription_expires_at")
      .eq("id", userId)
      .single();

    if (userErr) {
      console.error("[PAYMENT_CREATE] User lookup error:", userErr.message);
      return NextResponse.json(
        { error: "Failed to verify subscription status" },
        { status: 500 }
      );
    }
    if (user?.subscription_plan === "creator" && plan === "storyteller" && Date.parse(user.subscription_expires_at ?? "") > Date.now()) {
      return NextResponse.json({ error: "A lower plan can be purchased after your current Creator period ends." }, { status: 409 });
    }

    if (
      user?.subscription_plan === plan &&
      user?.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date()
    ) {
      return NextResponse.json(
        { error: "You already have an active subscription for this plan." },
        { status: 409 }
      );
    }

    // Check for existing pending payment for this plan (regardless of expiry).
    // The user may have already sent USDC to this address — never discard it.
    const { data: existingPending } = await admin
      .from("payments")
      .select("payment_address, amount_expected, currency, expires_at")
      .eq("user_id", userId)
      .eq("plan", plan)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json({
        success: true,
        address: existingPending.payment_address,
        amount: existingPending.amount_expected,
        currency: existingPending.currency,
        plan,
        network: "Base",
        note: "Send exactly the amount shown in USDC to this address. Your subscription will activate automatically.",
      });
    }

    // Create Blockradar payment address
    let paymentAddress;
    try {
      paymentAddress = await createPaymentAddress(userId, plan);
    } catch (addrErr) {
      console.error("[PAYMENT_CREATE] Blockradar address creation failed:", addrErr);
      return NextResponse.json(
        { error: "Payment service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // Expire pending payments for OTHER plans only (user switched plans).
    // Never expire a pending payment for the same plan — they may have sent funds.
    await admin
      .from("payments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending")
      .neq("plan", plan);

    // Payment address expires in 1 hour (soft hint — address remains valid)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store pending payment in database
    const { error: insertErr } = await admin.from("payments").insert({
      user_id: userId,
      plan,
      blockradar_address_id: paymentAddress.id,
      payment_address: paymentAddress.address,
      amount_expected: PLAN_PRICES[plan],
      currency: "USDC",
      status: "pending",
      expires_at: expiresAt.toISOString(),
    });

    if (insertErr) {
      console.error("[PAYMENT_CREATE] DB insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address: paymentAddress.address,
      amount: PLAN_PRICES[plan],
      currency: "USDC",
      plan,
      network: "Base",
      note: "Send exactly the amount shown in USDC to this address. Your subscription will activate automatically.",
    });
  } catch (err) {
    console.error("[PAYMENT_CREATE] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
