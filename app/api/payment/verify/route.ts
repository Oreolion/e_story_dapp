import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { isPaymentSufficient } from "@/lib/blockradar";
import { activateSubscription } from "@/lib/subscription";

/**
 * POST /api/payment/verify
 *
 * Manually checks Blockradar for deposits on the user's pending payment address.
 * Used as a fallback when webhooks are delayed or misconfigured.
 *
 * The user clicks "Verify Payment" in the UI, which hits this endpoint.
 * We query Blockradar's API for deposits on the address, and if sufficient,
 * activate the subscription.
 */

function getApiKey(): string {
  const key = process.env.BLOCKRADAR_API_KEY;
  if (!key) throw new Error("BLOCKRADAR_API_KEY not configured");
  return key;
}

function getWalletId(): string {
  const id = process.env.BLOCKRADAR_WALLET_ID;
  if (!id) throw new Error("BLOCKRADAR_WALLET_ID not configured");
  return id;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = authResult;

    const admin = createSupabaseAdminClient();

    // Find the user's most recent verifiable payment (pending → expired → completed-but-not-activated)
    const { data: pending, error: pendErr } = await admin
      .from("payments")
      .select("id, payment_address, plan, amount_expected, blockradar_address_id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "expired", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendErr || !pending) {
      return NextResponse.json(
        { error: "No payment found" },
        { status: 404 }
      );
    }

    // If payment is already "completed", check if subscription is actually active.
    // If not, retry activation (covers the case where payment was marked completed
    // but activateSubscription failed silently).
    if (pending.status === "completed") {
      const { data: user } = await admin
        .from("users")
        .select("subscription_plan, subscription_expires_at")
        .eq("id", userId)
        .single();

      const isActive =
        user?.subscription_plan === pending.plan &&
        user?.subscription_expires_at &&
        new Date(user.subscription_expires_at) > new Date();

      if (isActive) {
        return NextResponse.json({ verified: true, message: "Payment already processed and subscription is active." });
      }

      // Subscription NOT active despite completed payment — retry activation
      console.warn(`[PAYMENT_VERIFY] Completed payment ${pending.id} but subscription not active — retrying activation`);
      const { expiresAt } = await activateSubscription(admin, userId, pending.plan);
      return NextResponse.json({
        verified: true,
        message: "Payment confirmed! Your subscription is now active.",
        plan: pending.plan,
        expires_at: expiresAt,
      });
    }

    // Payment is pending or expired — check Blockradar for deposits
    const res = await fetch(
      `https://api.blockradar.co/v1/wallets/${getWalletId()}/addresses/${pending.blockradar_address_id}/transactions`,
      {
        headers: { "x-api-key": getApiKey() },
      }
    );

    if (!res.ok) {
      console.error("[PAYMENT_VERIFY] Blockradar API error:", res.status);
      return NextResponse.json(
        { error: "Unable to check payment status" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const transactions = json.data || [];

    // Look for a sufficient deposit
    const deposit = transactions.find(
      (tx: { type: string; amount: string }) =>
        tx.type === "receive" &&
        isPaymentSufficient(tx.amount, pending.plan)
    );

    if (!deposit) {
      return NextResponse.json({
        verified: false,
        message: "No confirmed deposit found yet. Please wait a few minutes and try again.",
      });
    }

    // Deposit found — mark payment completed and activate subscription.
    await admin
      .from("payments")
      .update({
        status: "completed",
        amount_received: parseFloat(deposit.amount),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id)
      .in("status", ["pending", "expired"]);

    const { expiresAt } = await activateSubscription(admin, userId, pending.plan);

    return NextResponse.json({
      verified: true,
      message: "Payment confirmed! Your subscription is now active.",
      plan: pending.plan,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[PAYMENT_VERIFY] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
