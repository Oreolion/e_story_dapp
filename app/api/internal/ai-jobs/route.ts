import { NextRequest, NextResponse } from "next/server";
import { workerAuthorized } from "@/lib/internalWorkerAuth";
import { runtimeConfiguration } from "@/lib/runtime/config";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { processAnalysisJob } from "@/lib/ai/jobs";
export const runtime = "nodejs";
export const maxDuration = 60;
// Scheduler registration and secret provisioning are separate deployment steps.
export async function POST(request: NextRequest) {
  const configured = process.env.AI_WORKER_SECRET;
  if (!configured || configured.length < 32) return NextResponse.json({ error: "Worker unavailable" }, { status: 503 });
  if (!workerAuthorized(request, configured)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!runtimeConfiguration().aiWorkerEnabled) return NextResponse.json({ status: "disabled" });
    return NextResponse.json(await processAnalysisJob(createSupabaseAdminClient()));
  }
  catch { return NextResponse.json({ error: "Job processing unavailable" }, { status: 503 }); }
}
