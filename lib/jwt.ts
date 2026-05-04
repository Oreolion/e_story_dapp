import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Custom JWT for wallet-authenticated users.
 *
 * Google/OAuth users keep using Supabase session tokens.
 * Wallet users receive a custom JWT signed by the server after
 * their wallet signature is verified — no fake emails needed.
 */

interface WalletTokenPayload extends JWTPayload {
  /** users table ID */
  sub: string;
  /** lowercase wallet address */
  wallet: string;
  /** auth method discriminator */
  auth_method: "wallet";
}

function getSecret(): Uint8Array {
  const raw = process.env.WALLET_JWT_SECRET;
  if (!raw) {
    throw new Error(
      "WALLET_JWT_SECRET is not configured. " +
        "Do NOT fall back to SUPABASE_SERVICE_ROLE_KEY — " +
        "doing so would invalidate all wallet JWTs when the service key is rotated."
    );
  }
  return new TextEncoder().encode(raw);
}

const ISSUER = "estory";
const AUDIENCE = "estory-api";
const MAX_AGE = "7d";

/**
 * Create a signed JWT for a wallet user.
 * Called server-side after wallet signature verification.
 */
export async function signWalletToken(
  userId: string,
  walletAddress: string
): Promise<string> {
  return new SignJWT({
    wallet: walletAddress.toLowerCase(),
    auth_method: "wallet",
  } satisfies Omit<WalletTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MAX_AGE)
    .sign(getSecret());
}

/**
 * Verify and decode a wallet JWT.
 * Returns the userId + wallet, or null if invalid/expired.
 */
export async function verifyWalletToken(
  token: string
): Promise<{ userId: string; wallet: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const p = payload as WalletTokenPayload;
    if (!p.sub || !p.wallet || p.auth_method !== "wallet") return null;
    return { userId: p.sub, wallet: p.wallet };
  } catch {
    return null;
  }
}
