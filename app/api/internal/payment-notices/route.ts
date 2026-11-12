import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { workerAuthorized } from "@/lib/internalWorkerAuth";
import { dispatchPaymentNotice } from "@/lib/payments/notices";
import { runtimeConfiguration } from "@/lib/runtime/config";
import { rejectPausedRequest } from "@/lib/runtime/releaseResponse";
import { replayPaymentCallback } from "@/lib/payments/callbacks";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const paused = rejectPausedRequest(request);
  if (paused) return paused;
  const secret = process.env.PAYMENT_WORKER_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Worker unavailable" }, { status: 503 });
  if (!workerAuthorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!runtimeConfiguration().paymentWorkerEnabled) return NextResponse.json({ status: "disabled" });
    const admin = createSupabaseAdminClient();
    if (process.env.PAYMENT_CALLBACK_REPLAY_ENABLED === "true") {
      if (process.env.PAYMENT_CALLBACK_MODE !== "retain") throw new Error("Callback replay is unavailable");
      const receipt = await replayPaymentCallback(admin);
      const notice = await dispatchPaymentNotice(admin);
      return NextResponse.json({ ...notice, receiptStatus: receipt.status });
    }
    return NextResponse.json(await dispatchPaymentNotice(admin));
  }
  catch { return NextResponse.json({ error: "Notification dispatch unavailable" }, { status: 503 }); }
}
