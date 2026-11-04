import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { workerAuthorized } from "@/lib/internalWorkerAuth";
import { dispatchPaymentNotice } from "@/lib/payments/notices";
import { runtimeConfiguration } from "@/lib/runtime/config";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WORKER_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Worker unavailable" }, { status: 503 });
  if (!workerAuthorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!runtimeConfiguration().paymentWorkerEnabled) return NextResponse.json({ status: "disabled" });
    return NextResponse.json(await dispatchPaymentNotice(createSupabaseAdminClient()));
  }
  catch { return NextResponse.json({ error: "Notification dispatch unavailable" }, { status: 503 }); }
}
