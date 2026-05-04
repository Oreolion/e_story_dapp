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

  // Fetch and delete atomically (select then delete to consume)
  const { data: entry, error: fetchErr } = await admin
    .from("auth_nonces")
    .select("nonce, created_at")
    .eq("address", normalizedAddress)
    .maybeSingle();

  if (fetchErr) {
    console.error("[NONCE] verify fetch error:", fetchErr);
    return { valid: false, error: "Nonce verification failed. Please try again." };
  }

  if (!entry) {
    return { valid: false, error: "No nonce found. Please request a new one." };
  }

  // Check expiry
  const createdAt = new Date(entry.created_at).getTime();
  if (Date.now() - createdAt > NONCE_EXPIRY_MS) {
    // Consume expired nonce
    await admin.from("auth_nonces").delete().eq("address", normalizedAddress);
    return { valid: false, error: "Nonce expired. Please request a new one." };
  }

  // Verify nonce is in the signed message
  if (!message.includes(`Nonce: ${entry.nonce}`)) {
    return { valid: false, error: "Invalid nonce in signed message." };
  }

  // Consume the nonce (one-time use)
  await admin.from("auth_nonces").delete().eq("address", normalizedAddress);

  return { valid: true };
}

export { NONCE_EXPIRY_MS };
