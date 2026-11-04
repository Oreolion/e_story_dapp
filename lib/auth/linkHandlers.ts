import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { authenticateSupabasePrincipal, resolvePrincipalId } from "@/lib/auth";
import { verifyWalletToken } from "@/lib/jwt";
import { completionContract, linkBody, linkingFailure, linkingOrigin, linkingQuota } from "./linkRequest";
import { finishLink, googleSubject, issueLinkChallenge, LinkError, readLinkChallenge, verifyLinkSignature } from "./linking";

const initiation = z.object({ direction: z.enum(["wallet_to_google", "google_to_wallet"]), walletAddress: z.string().regex(/^0x[0-9a-f]{40}$/i) }).strict();
async function walletProof(request: NextRequest) {
  const cookie = request.cookies.get("estory_wallet_token")?.value;
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return cookie ? verifyWalletToken(cookie) : bearer ? verifyWalletToken(bearer) : null;
}
export async function initiateLink(request: NextRequest) {
  try {
    const origin = linkingOrigin(request);
    const body = initiation.safeParse(await linkBody(request));
    if (!body.success) return NextResponse.json({ error: "Restart linking from your account page", code: "link_restart_required" }, { status: 400 });
    const admin = createSupabaseAdminClient();
    let ownerId: string;
    let subject: string;
    if (body.data.direction === "wallet_to_google") {
      const wallet = await walletProof(request);
      if (!wallet) return NextResponse.json({ error: "Wallet sign-in required" }, { status: 401 });
      if (wallet.wallet !== body.data.walletAddress.toLowerCase()) throw new LinkError("link_forbidden", 403);
      ownerId = subject = wallet.userId;
      const { data, error } = await admin.from("users").select("wallet_address").eq("id", ownerId).maybeSingle();
      if (error) throw new LinkError("link_unavailable", 503);
      if (data?.wallet_address?.toLowerCase() !== wallet.wallet) throw new LinkError("link_forbidden", 403);
    } else {
      const principal = await authenticateSupabasePrincipal(request);
      if (!principal || !googleSubject(principal.user)) return NextResponse.json({ error: "Google sign-in required" }, { status: 401 });
      ownerId = await resolvePrincipalId(principal);
      subject = principal.subject;
    }
    const limited = await linkingQuota(admin, ownerId);
    if (limited) return limited;
    return NextResponse.json({ success: true, ...await issueLinkChallenge(admin, { ownerId, subject, direction: body.data.direction, wallet: body.data.walletAddress, origin }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return linkingFailure(error); }
}
async function complete(request: NextRequest, direction: "wallet_to_google" | "google_to_wallet") {
  try {
    const principal = await authenticateSupabasePrincipal(request);
    if (!principal || !googleSubject(principal.user)) return NextResponse.json({ error: "Verified Google sign-in required" }, { status: 401 });
    const origin = linkingOrigin(request);
    const body = completionContract.safeParse(await linkBody(request));
    if (!body.success) throw new LinkError("link_restart_required", 401);
    const admin = createSupabaseAdminClient();
    const challenge = await readLinkChallenge(admin, body.data.challengeId, origin, direction);
    if (direction === "wallet_to_google") {
      const wallet = await walletProof(request);
      if (!wallet || wallet.userId !== challenge.owner_id || wallet.wallet !== challenge.wallet_address) throw new LinkError("link_forbidden", 403);
    } else if (principal.subject !== challenge.initiator_subject) throw new LinkError("link_forbidden", 403);
    const limited = await linkingQuota(admin, challenge.owner_id);
    if (limited) return limited;
    await verifyLinkSignature(challenge, body.data.signature);
    const user = await finishLink(admin, challenge.challenge_hash, principal.user, origin);
    return NextResponse.json({ success: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return linkingFailure(error); }
}
export const linkGoogle = (request: NextRequest) => complete(request, "wallet_to_google");
export const linkWallet = (request: NextRequest) => complete(request, "google_to_wallet");

/** Only the verified principal can create or select the OAuth profile. */
export async function sessionProfile(request: NextRequest) {
  try {
    linkingOrigin(request);
    const principal = await authenticateSupabasePrincipal(request);
    const subject = principal && googleSubject(principal.user);
    if (!principal || !subject) return NextResponse.json({ error: "Verified Google sign-in required" }, { status: 401 });
    const ownerId = await resolvePrincipalId(principal);
    const admin = createSupabaseAdminClient();
    const { data: existing, error } = await admin.from("users").select("*").eq("id", ownerId).maybeSingle();
    if (error) throw new LinkError("link_unavailable", 503);
    if (existing) return NextResponse.json({ success: true, user: existing }, { headers: { "Cache-Control": "no-store" } });
    const { data: legacy, error: legacyError } = await admin.from("users").select("id").eq("google_id", subject).maybeSingle();
    if (legacyError) throw new LinkError("link_unavailable", 503);
    if (legacy) return NextResponse.json({ error: "Verify your wallet and Google account to recover this link. Sign in with your wallet, then choose Verify Google link in Profile.", code: "identity_reverification_required" }, { status: 409 });
    const display = principal.user.user_metadata;
    const { data: created, error: createError } = await admin.from("users").upsert({ id: principal.subject, name: typeof display?.full_name === "string" ? display.full_name.slice(0, 100) : null, email: principal.user.email ?? null, avatar: typeof display?.avatar_url === "string" && /^https:\/\//.test(display.avatar_url) ? display.avatar_url.slice(0, 2000) : null, wallet_address: null, google_id: subject, auth_provider: "google", is_onboarded: false }, { onConflict: "id", ignoreDuplicates: true }).select().maybeSingle();
    if (createError) throw new LinkError("link_unavailable", 503);
    if (created) return NextResponse.json({ success: true, user: created }, { headers: { "Cache-Control": "no-store" } });
    const { data: raced, error: raceError } = await admin.from("users").select("*").eq("id", principal.subject).maybeSingle();
    if (raceError || !raced) throw new LinkError("link_unavailable", 503);
    return NextResponse.json({ success: true, user: raced }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return linkingFailure(error); }
}
