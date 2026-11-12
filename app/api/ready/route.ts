import { NextResponse } from "next/server";
import { releaseMode } from "@/lib/runtime/release";
import { cohortMode } from "@/lib/runtime/cohort";

export const dynamic = "force-dynamic";

// Traffic admission only. This is not a database/provider readiness claim.
export async function GET() {
  const mode = releaseMode();
  const frontdoor = cohortMode();
  const acceptingTraffic = mode === "active" && frontdoor === "open";
  return NextResponse.json({ acceptingTraffic, releaseMode: mode, frontdoorMode: frontdoor }, {
    status: acceptingTraffic ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
