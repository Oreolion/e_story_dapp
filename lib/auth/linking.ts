import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { verifyMessage, type Address, type Hex } from "viem";
import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
export type LinkDirection = "wallet_to_google" | "google_to_wallet";
export class LinkError extends Error {
  constructor(public code: "link_restart_required" | "link_conflict" | "link_forbidden" | "link_unavailable", public status: number) { super(code); }
}
export function googleSubject(user: User): string | null {
  // getUser() supplies this verified identity. Display metadata is never authority.
  const identity = user.identities?.find(value => value.provider === "google");
  return identity && typeof identity.id === "string" && identity.id.length > 0 && identity.id.length <= 255 ? identity.id : null;
}
export function linkHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new LinkError("link_restart_required", 401);
  return createHash("sha256").update(token).digest("hex");
}
export async function issueLinkChallenge(admin: Admin, input: { ownerId: string; subject: string; direction: LinkDirection; wallet: string; origin: string }) {
  const challengeId = randomBytes(32).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60_000).toISOString();
  const wallet = input.wallet.toLowerCase();
  const message = `${input.origin} requests an eStories account link.\n\nPurpose: ${input.direction}\nAccount: ${input.ownerId}\nWallet: ${wallet}\nNonce: ${randomUUID()}\nIssued: ${issuedAt.toISOString()}\nExpires: ${expiresAt}\n\nThis links account access. No transaction or gas fee.`;
  const { error } = await admin.from("auth_link_challenges").insert({ challenge_hash: linkHash(challengeId), owner_id: input.ownerId, initiator_subject: input.subject, direction: input.direction, wallet_address: wallet, origin: input.origin, message, created_at: issuedAt.toISOString(), expires_at: expiresAt });
  if (error) throw new LinkError("link_unavailable", 503);
  return { challengeId, message, expiresAt };
}
export async function readLinkChallenge(admin: Admin, token: string, origin: string, direction: LinkDirection) {
  const challengeHash = linkHash(token);
  const { data, error } = await admin.from("auth_link_challenges").select("*").eq("challenge_hash", challengeHash).maybeSingle();
  if (error) throw new LinkError("link_unavailable", 503);
  if (!data || data.consumed_at || Date.parse(data.expires_at) <= Date.now()) throw new LinkError("link_restart_required", 401);
  if (data.origin !== origin || data.direction !== direction) throw new LinkError("link_forbidden", 403);
  return data as { challenge_hash: string; owner_id: string; initiator_subject: string; wallet_address: string; message: string; expires_at: string };
}
export async function verifyLinkSignature(challenge: { wallet_address: string; message: string }, signature: unknown) {
  if (typeof signature !== "string" || !/^0x[0-9a-f]+$/i.test(signature) || signature.length > 2048) throw new LinkError("link_forbidden", 403);
  try {
    if (await verifyMessage({ address: challenge.wallet_address as Address, message: challenge.message, signature: signature as Hex })) return;
  } catch { /* Invalid proofs have the same public error. */ }
  throw new LinkError("link_forbidden", 403);
}
export async function finishLink(admin: Admin, challengeHash: string, authUser: User, origin: string) {
  const subject = googleSubject(authUser);
  if (!subject) throw new LinkError("link_forbidden", 403);
  const { data, error } = await admin.rpc("finalize_identity_link", { p_challenge_hash: challengeHash, p_auth_user_id: authUser.id, p_google_subject: subject, p_origin: origin });
  if (error) {
    if (error.code === "42501") throw new LinkError("link_forbidden", 403);
    if (error.code === "23505" || error.message?.includes("link_conflict")) throw new LinkError("link_conflict", 409);
    if (error.message?.includes("link_restart_required")) throw new LinkError("link_restart_required", 401);
    throw new LinkError("link_unavailable", 503);
  }
  const user = Array.isArray(data) ? data[0] : data;
  if (!user) throw new LinkError("link_unavailable", 503);
  return user;
}
