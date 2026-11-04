/**
 * Nonce store backed by Supabase `auth_nonces` table.
 *
 * Replaces the previous in-memory Map() which failed on multi-instance
 * serverless deployments (Vercel) — nonce generated on instance A could
 * not be verified on instance B.
 */
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getAdmin() {
  return createSupabaseAdminClient();
}

export async function cleanupExpiredNonces() {
  const cutoff = new Date(Date.now() - NONCE_EXPIRY_MS).toISOString();
  try {
    await getAdmin()
      .from("auth_nonces")
      .delete()
      .lt("created_at", cutoff);
  } catch (err) {
    console.error("[NONCE] cleanup error:", err);
  }
}

export async function storeNonce(address: string, nonce: string) {
  const admin = getAdmin();
  const normalizedAddress = address.toLowerCase();

  // Upsert: one nonce per address, new request replaces old
  const { error } = await admin
    .from("auth_nonces")
    .upsert(
      {
        address: normalizedAddress,
        nonce,
        created_at: new Date().toISOString(),
      },
      { onConflict: "address" }
    );

  if (error) {
    console.error("[NONCE] store error:", error);
    throw new Error("Failed to store nonce");
  }
}

export async function verifyNonce(
  address: string,
  message: string
): Promise<{ valid: boolean; error?: string }> {
  const admin = getAdmin();
  const normalizedAddress = address.toLowerCase();

  const nonces = [...message.matchAll(/^Nonce: ([0-9a-f-]{36})\r?$/gim)];
  if (nonces.length !== 1) return { valid: false, error: "Invalid nonce in signed message." };
  const { data, error } = await admin.rpc("consume_wallet_nonce", { p_address: normalizedAddress, p_nonce: nonces[0][1] });
  if (error) return { valid: false, error: "Nonce verification unavailable. Please try again." };
  return data === true ? { valid: true } : { valid: false, error: "Nonce expired or already used. Please request a new one." };
}

export { NONCE_EXPIRY_MS };
