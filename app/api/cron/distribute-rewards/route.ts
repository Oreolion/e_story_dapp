import { NextRequest, NextResponse } from "next/server";

// Force dynamic to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // DISABLED: Like-based reward distribution removed.
  // Monetization is via tips and paywalls only.
  // This route is preserved for future token distribution programs.
  // Cron schedule also removed from vercel.json.
  return NextResponse.json(
    { error: "This endpoint is disabled. Token rewards are distributed via tips and paywalls only." },
    { status: 410 }
  );
}
