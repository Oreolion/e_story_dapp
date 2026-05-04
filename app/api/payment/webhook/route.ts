import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { isPaymentSufficient } from "@/lib/blockradar";
import { activateSubscription } from "@/lib/subscription";
import { createHmac, timingSafeEqual } from "crypto";

// Ensure Node.js runtime (crypto module required for HMAC verification)
export const runtime = "nodejs";

/**
 * POST /api/payment/webhook
 *
 * Receives webhook events from Blockradar when deposits are confirmed.
 * Activates user subscriptions when payment is sufficient.
 *
 * Blockradar signs webhooks with HMAC-SHA512 using your API key.
 * The signature is sent in the `x-blockradar-signature` header.
 *
 * Verification follows Blockradar's documented approach:
 *   hash = createHmac('sha512', apiKey).update(JSON.stringify(body)).digest('hex')
 * See: https://docs.blockradar.co/en/essentials/webhooks
 */
export async function POST(req: NextRequest) {
  try {
    // ── STEP 0: Read and parse body ─────────────────────────────────
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[PAYMENT_WEBHOOK] Invalid JSON body");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // ── STEP 1: Verify webhook signature (HMAC-SHA512) ──────────────
    // Blockradar signs JSON.stringify(body) with your API key.
    // Support a dedicated BLOCKRADAR_WEBHOOK_SECRET, falling back to
    // BLOCKRADAR_API_KEY (Blockradar docs call it "your wallet's API key").
    const signingKey =
      process.env.BLOCKRADAR_WEBHOOK_SECRET || process.env.BLOCKRADAR_API_KEY;

    if (!signingKey) {
      console.error("[PAYMENT_WEBHOOK] No webhook signing key configured (set BLOCKRADAR_WEBHOOK_SECRET or BLOCKRADAR_API_KEY)");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const signature = (req.headers.get("x-blockradar-signature") || "").trim();

    if (!signature) {
      console.warn("[PAYMENT_WEBHOOK] Missing x-blockradar-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Compute HMAC using JSON.stringify(body) — matches Blockradar's docs.
    // Also try raw body as fallback in case Blockradar signs the raw bytes.
    const canonicalBody = JSON.stringify(body);
    const expectedFromCanonical = createHmac("sha512", signingKey)
      .update(canonicalBody)
      .digest("hex");
    const expectedFromRaw = createHmac("sha512", signingKey)
      .update(rawBody)
      .digest("hex");

    // Check if either approach matches
    const matchesCanonical = signature === expectedFromCanonical;
    const matchesRaw = signature === expectedFromRaw;

    if (!matchesCanonical && !matchesRaw) {
      // Timing-safe comparison for the canonical approach (primary)
      try {
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expectedFromCanonical, "hex");
        if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
          // Matches via timing-safe (shouldn't reach here if string compare passed, but safety net)
        } else {
          console.warn("[PAYMENT_WEBHOOK] HMAC signature mismatch — check that BLOCKRADAR_API_KEY matches the key in your Blockradar dashboard");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      } catch {
        console.warn("[PAYMENT_WEBHOOK] HMAC verification error — signature may have invalid format");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { event, data } = body as { event: string; data: Record<string, unknown> };

    console.log(`[PAYMENT_WEBHOOK] Verified event: ${event}`);

    if (event !== "deposit.success") {
      // Acknowledge non-deposit events
      return NextResponse.json({ received: true });
    }

    // Extract payment details from Blockradar payload
    const recipientAddress = data.recipientAddress as string | undefined;
    const amountPaid = data.amountPaid as string | undefined;

    if (!recipientAddress || !amountPaid) {
      console.error("[PAYMENT_WEBHOOK] Missing recipientAddress or amountPaid in payload");
      return NextResponse.json({ received: true, status: "invalid_payload" });
    }

    const admin = createSupabaseAdminClient();

    // ── STEP 2: Find and atomically claim the pending payment ────────
    const { data: pendingPayment } = await admin
      .from("payments")
      .select("user_id, plan, amount_expected")
      .eq("payment_address", recipientAddress)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pendingPayment) {
      console.warn("[PAYMENT_WEBHOOK] No pending payment for address:", recipientAddress);
      return NextResponse.json({ received: true, status: "already_processed" });
    }

    const { user_id: userId, plan } = pendingPayment;

    // ── STEP 3: Verify payment amount matches plan price ─────────────
    if (!isPaymentSufficient(amountPaid, plan)) {
      console.warn(
        `[PAYMENT_WEBHOOK] Insufficient payment: ${amountPaid} for plan ${plan}`
      );

      await admin
        .from("payments")
        .update({
          status: "underpaid",
          amount_received: parseFloat(amountPaid),
          updated_at: new Date().toISOString(),
        })
        .eq("payment_address", recipientAddress)
        .eq("status", "pending");

      return NextResponse.json({ received: true, status: "underpaid" });
    }

    // ── STEP 4: Mark payment as completed FIRST (replay guard) ───────
    const { data: completedPayment } = await admin
      .from("payments")
      .update({
        status: "completed",
        amount_received: parseFloat(amountPaid),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("payment_address", recipientAddress)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!completedPayment) {
      console.warn("[PAYMENT_WEBHOOK] Payment already processed (concurrent webhook):", recipientAddress);
      return NextResponse.json({ received: true, status: "already_processed" });
    }

    // ── STEP 5: Activate subscription + notify + email ─────────────
    try {
      const { expiresAt } = await activateSubscription(admin, userId, plan);
      console.log(`[PAYMENT_WEBHOOK] Subscription activated: user=${userId} plan=${plan} expires=${expiresAt}`);

      return NextResponse.json({
        received: true,
        status: "activated",
        plan,
        expires_at: expiresAt,
      });
    } catch (activateErr) {
      console.error("[PAYMENT_WEBHOOK] Activation failed:", activateErr);
      return NextResponse.json(
        { error: "Failed to activate subscription" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[PAYMENT_WEBHOOK] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
