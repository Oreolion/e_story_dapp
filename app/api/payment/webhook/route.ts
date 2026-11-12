import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient, createPaymentCallbackClient } from "@/app/utils/supabase/supabaseAdmin";
import { applyVerifiedReceipt, PaymentUnavailable } from "@/lib/payments/receipts";
import { rejectPausedRequest } from "@/lib/runtime/releaseResponse";
import { retainingPaymentCallbacks } from "@/lib/runtime/dataApiFence";
import { retainPaymentCallback } from "@/lib/payments/callbacks";
export const runtime = "nodejs";
export const maxDuration = 15;

async function boundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error("BODY_TIMEOUT")); }, 2000);
    });
    await Promise.race([(async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 128 * 1024) throw new Error("BODY_TOO_LARGE");
        chunks.push(value);
      }
    })(), timeout]);
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  const paused = rejectPausedRequest(request);
  if (paused) return paused;
  if (process.env.PAYMENT_CALLBACK_MODE !== undefined && process.env.PAYMENT_CALLBACK_MODE !== "retain") {
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  if (process.env.PAYMENT_CALLBACK_MODE === "retain" && !retainingPaymentCallbacks()) {
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  const key = process.env.BLOCKRADAR_WEBHOOK_SECRET || process.env.BLOCKRADAR_API_KEY;
  if (!key) return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  const signature = request.headers.get("x-blockradar-signature") ?? "";
  if (!/^[0-9a-fA-F]{128}$/.test(signature)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let raw: string;
  try { raw = await boundedBody(request); }
  catch (error) { return NextResponse.json({ error: "Invalid webhook body" }, { status: error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400 }); }
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const supplied = Buffer.from(signature, "hex");
  const matches = (text: string) => timingSafeEqual(supplied, createHmac("sha512", key).update(text).digest());
  if (!matches(JSON.stringify(body)) && !matches(raw)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (body?.event !== "deposit.success") return NextResponse.json({ received: true });
  try {
    if (retainingPaymentCallbacks()) {
      return NextResponse.json(await retainPaymentCallback(createPaymentCallbackClient(), body.data), { headers: { "Cache-Control": "no-store" } });
    }
    const result = await applyVerifiedReceipt(createSupabaseAdminClient(), body.data);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    // Never acknowledge a failed entitlement write as completed. No email/model
    // or detached side effect occurs inside this financial transition.
    return NextResponse.json({ error: error instanceof PaymentUnavailable ? "Payment processing unavailable; retry required" : "Invalid deposit receipt" }, { status: error instanceof PaymentUnavailable ? 503 : 400 });
  }
}
