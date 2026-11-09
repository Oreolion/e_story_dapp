import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { applyVerifiedReceipt, PaymentUnavailable } from "@/lib/payments/receipts";
import { rejectPausedRequest } from "@/lib/runtime/releaseResponse";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const paused = rejectPausedRequest(request);
  if (paused) return paused;
  const key = process.env.BLOCKRADAR_WEBHOOK_SECRET || process.env.BLOCKRADAR_API_KEY;
  if (!key) return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  const signature = request.headers.get("x-blockradar-signature") ?? "";
  if (!/^[0-9a-fA-F]{128}$/.test(signature)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 128 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const supplied = Buffer.from(signature, "hex");
  const matches = (text: string) => timingSafeEqual(supplied, createHmac("sha512", key).update(text).digest());
  if (!matches(JSON.stringify(body)) && !matches(raw)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (body?.event !== "deposit.success") return NextResponse.json({ received: true });
  try {
    const result = await applyVerifiedReceipt(createSupabaseAdminClient(), body.data);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    // Never acknowledge a failed entitlement write as completed. No email/model
    // or detached side effect occurs inside this financial transition.
    return NextResponse.json({ error: error instanceof PaymentUnavailable ? "Payment processing unavailable; retry required" : "Invalid deposit receipt" }, { status: error instanceof PaymentUnavailable ? 503 : 400 });
  }
}
