import { NextResponse } from "next/server";
import { releaseMode } from "@/lib/runtime/release";

export const dynamic = "force-dynamic";

// Traffic admission only. This is not a database/provider readiness claim.
export async function GET() {
  const mode = releaseMode();
  return NextResponse.json({ acceptingTraffic: mode === "active", releaseMode: mode }, {
    status: mode === "active" ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
