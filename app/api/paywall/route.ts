import { NextResponse } from "next/server";

/**
 * Retired (410 Gone).
 *
 * This route previously called `writeContract` on the server using a
 * server-side private key. That pattern is a critical security footgun —
 * any authenticated user could trigger paywall payments from the server's
 * wallet. Paywalls are now signed client-side via wagmi/viem hooks.
 *
 * Kept as a 410 stub so any stale client code receives a clear signal
 * rather than a 404, and so the endpoint cannot be mistakenly reintroduced.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been retired. Paywall payments are signed client-side." },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
