import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { applyVerifiedReceipt, paymentConfiguration } from "@/lib/payments/receipts";
export async function POST(request: NextRequest) {
  const actor = await validateAuthOrReject(request);
  if (isAuthError(actor)) return actor;
  const owner = await resolveUserId(actor);
  try {
    paymentConfiguration();
    const admin = createSupabaseAdminClient();
    let { data: payment, error } = await admin.from("payments").select("id,blockradar_address_id,activated_expires_at,status,deferred,provider_receipt_id,amount_received").eq("user_id", owner).in("status", ["pending","expired"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!error && !payment) ({ data: payment, error } = await admin.from("payments").select("id,blockradar_address_id,activated_expires_at,status,deferred,provider_receipt_id,amount_received").eq("user_id", owner).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (error) return NextResponse.json({ error: "Payment lookup unavailable" }, { status: 503 });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (payment.deferred && payment.provider_receipt_id) {
      const { data: credit, error: creditError } = await admin.rpc("activate_paid_payment", { p_payment_id: payment.id, p_amount: payment.amount_received, p_receipt_id: payment.provider_receipt_id });
      if (creditError || !credit) return NextResponse.json({ error: "Credit recovery unavailable" }, { status: 503 });
      return NextResponse.json({ verified: !credit.deferred, credit_pending: credit.deferred === true, expires_at: credit.expiresAt, message: credit.deferred ? "Payment received. It will apply after your current plan ends." : "Your paid credit has been applied." });
    }
    if (payment.activated_expires_at) return NextResponse.json({ verified: true, expires_at: payment.activated_expires_at, message: "This payment was already processed; it does not grant a new subscription period." });
    if (payment.status === "completed") return NextResponse.json({ error: "Historical payment requires reconciliation", code: "RECONCILIATION_REQUIRED" }, { status: 409 });
    const key = process.env.BLOCKRADAR_API_KEY, wallet = process.env.BLOCKRADAR_WALLET_ID;
    if (!key || !wallet || !payment.blockradar_address_id) return NextResponse.json({ error: "Payment provider unavailable" }, { status: 503 });
    const response = await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(wallet)}/addresses/${encodeURIComponent(payment.blockradar_address_id)}/transactions`, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Payment provider unavailable" }, { status: 502 });
    const payload = await response.json();
    const transactions = Array.isArray(payload.data) ? payload.data : payload.data?.transactions;
    if (!Array.isArray(transactions)) return NextResponse.json({ error: "Invalid provider response" }, { status: 502 });
    for (const transaction of transactions.slice(0, 100)) {
      if (transaction?.confirmed !== true || transaction?.status !== "SUCCESS" || transaction?.type !== "DEPOSIT") continue;
      const result = await applyVerifiedReceipt(admin, transaction, owner);
      if (result.status === "deferred") return NextResponse.json({ verified: false, credit_pending: true, available_after: result.expiresAt, message: "Payment received. This plan will apply after your current plan ends." });
      if (result.status === "activated") return NextResponse.json({ verified: true, expires_at: result.expiresAt, plan: result.plan });
    }
    return NextResponse.json({ verified: false, message: "No confirmed qualifying deposit found yet" });
  } catch { return NextResponse.json({ error: "Payment verification unavailable" }, { status: 503 }); }
}
