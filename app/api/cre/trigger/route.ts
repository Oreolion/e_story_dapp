import { NextResponse } from "next/server";

// Testnet verification is parked. Deliberately no auth, storage, inference,
// chain reads or writes: old clients cannot restart the retired workflow.
export async function POST(_request: Request) {
  return NextResponse.json({
    verified: false, isAuthor: false,
    status: "coming_soon", code: "ONCHAIN_VERIFICATION_PARKED",
    message: "On-chain verification is coming soon. Testnet verification is parked.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
