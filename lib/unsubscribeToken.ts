import crypto from "crypto";

/**
 * HMAC-signed, long-lived tokens embedded in transactional email footers.
 * When the user clicks the unsubscribe link, /api/unsubscribe verifies the
 * token and flips their `notification_preferences.email_notifications` to false.
 *
 * Unlike the linking token (10-min expiry, wallet-scoped), unsubscribe tokens
 * do NOT expire — an email delivered today must still work if the user
 * unsubscribes a year later.
 */

function getSecret(): string {
  const s =
    process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error(
      "No UNSUBSCRIBE_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY configured"
    );
  }
  return s;
}

export interface UnsubscribeTokenPayload {
  /** Either userId (registered users) OR email (waitlist-only) is set. */
  userId?: string;
  email?: string;
  /** Category: "all" = kill-switch; "waitlist" = pre-signup list */
  category: "all" | "re_engagement" | "marketing" | "waitlist";
}

function sign(payloadB64: string): string {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(payloadB64);
  return hmac.digest("base64url");
}

export function createUnsubscribeToken(
  userId: string,
  category: UnsubscribeTokenPayload["category"] = "all"
): string {
  const payload: UnsubscribeTokenPayload = { userId, category };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function createEmailUnsubscribeToken(
  email: string,
  category: UnsubscribeTokenPayload["category"] = "waitlist"
): string {
  const payload: UnsubscribeTokenPayload = { email, category };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyUnsubscribeToken(
  token: string
): UnsubscribeTokenPayload | null {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const expectedSig = sign(payloadB64);
    const sigBuf = Buffer.from(signature, "base64url");
    const expBuf = Buffer.from(expectedSig, "base64url");
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }

    const payload: UnsubscribeTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
    if (!payload.userId && !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(
  userId: string,
  category: UnsubscribeTokenPayload["category"] = "all"
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://estories.app";
  const token = createUnsubscribeToken(userId, category);
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildEmailUnsubscribeUrl(
  email: string,
  category: UnsubscribeTokenPayload["category"] = "waitlist"
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://estories.app";
  const token = createEmailUnsubscribeToken(email, category);
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
