import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cleanupExpiredNonces, storeNonce, NONCE_EXPIRY_MS } from "@/lib/nonce";

/**
 * GET /api/auth/nonce?address=0x...
 * Generate a server-side nonce for wallet signature verification.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.toLowerCase();

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    // Cleanup old nonces
    await cleanupExpiredNonces();

    const nonce = randomUUID();
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS).toISOString();

    // Store nonce for validation
    await storeNonce(address, nonce);

    const message = `Welcome to EStories

Sign this message to log in securely.

Site: eStories
Address: ${address}

No transaction · No gas fees · Completely free

Nonce: ${nonce}
Timestamp: ${timestamp}
Expires: ${expiresAt}`;

    return NextResponse.json({ message, nonce });
  } catch (error: unknown) {
    console.error("[NONCE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
