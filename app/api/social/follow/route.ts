import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/social/follow?followed_ids=id1,id2,...
 * Check follow status for one or more users by ID.
 * Returns: { following: { [userId]: boolean } }
 *
 * Legacy support: ?follower_wallet=0x...&followed_wallets=0x...,0x...
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { searchParams } = new URL(req.url);

    // New ID-based flow
    const followedIdsParam = searchParams.get("followed_ids");
    if (followedIdsParam) {
      const followedIds = followedIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
      if (followedIds.length === 0) {
        return NextResponse.json({ following: {} });
      }

      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("follows")
        .select("following_id")
        .eq("follower_id", authenticatedUserId)
        .in("following_id", followedIds);

      if (error) {
        console.error("[API /social/follow GET] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      const followedSet = new Set(data?.map((r) => r.following_id) || []);
      const following: Record<string, boolean> = {};
      for (const id of followedIds) {
        following[id] = followedSet.has(id);
      }

      return NextResponse.json({ following });
    }

    // Legacy wallet-based flow (backward compat)
    const followerWallet = searchParams.get("follower_wallet")?.toLowerCase();
    const followedWalletsParam = searchParams.get("followed_wallets");

    if (!followerWallet || !followedWalletsParam) {
      return NextResponse.json(
        { error: "Missing followed_ids or follower_wallet/followed_wallets" },
        { status: 400 }
      );
    }

    const followedWallets = followedWalletsParam
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    if (followedWallets.length === 0) {
      return NextResponse.json({ following: {} });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("follows")
      .select("followed_wallet")
      .eq("follower_wallet", followerWallet)
      .in("followed_wallet", followedWallets);

    if (error) {
      console.error("[API /social/follow GET] error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const followedSet = new Set(data?.map((r) => r.followed_wallet) || []);
    const following: Record<string, boolean> = {};
    for (const wallet of followedWallets) {
      following[wallet] = followedSet.has(wallet);
    }

    return NextResponse.json({ following });
  } catch (err: unknown) {
    console.error("[API /social/follow GET] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/social/follow
 * Toggle follow/unfollow.
 * Body: { followed_id: string } (preferred)
 *   or: { follower_wallet: string, followed_wallet: string } (legacy)
 * Returns: { isFollowing: boolean, followers_count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const body = await req.json();
    const admin = createSupabaseAdminClient();

    // Resolve follower/followed user IDs and optional wallet addresses
    let followerId: string;
    let followedId: string;
    let followerWallet: string | null = null;
    let followedWallet: string | null = null;

    const bodyFollowedId: string | undefined = body.followed_id;

    if (!bodyFollowedId) {
      // Legacy wallet-based flow — resolve IDs from wallets
      const inputFollowerWallet = body.follower_wallet?.toLowerCase();
      const inputFollowedWallet = body.followed_wallet?.toLowerCase();

      if (!inputFollowerWallet || !inputFollowedWallet) {
        return NextResponse.json(
          { error: "Missing followed_id or follower_wallet/followed_wallet" },
          { status: 400 }
        );
      }

      if (inputFollowerWallet === inputFollowedWallet) {
        return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
      }

      // Resolve user IDs from wallet addresses
      const { data: followerUser } = await admin
        .from("users")
        .select("id")
        .eq("wallet_address", inputFollowerWallet)
        .single();

      const { data: followedUser } = await admin
        .from("users")
        .select("id")
        .eq("wallet_address", inputFollowedWallet)
        .single();

      if (!followerUser || !followedUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      followerId = followerUser.id;
      followedId = followedUser.id;
      followerWallet = inputFollowerWallet;
      followedWallet = inputFollowedWallet;
    } else {
      // ID-based flow — resolve wallet addresses for backward compat columns
      if (bodyFollowedId === authenticatedUserId) {
        return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
      }

      const { data: followerUser } = await admin
        .from("users")
        .select("wallet_address")
        .eq("id", authenticatedUserId)
        .single();

      const { data: followedUser } = await admin
        .from("users")
        .select("wallet_address")
        .eq("id", bodyFollowedId)
        .single();

      if (!followedUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      followerId = authenticatedUserId;
      followedId = bodyFollowedId;
      followerWallet = followerUser?.wallet_address?.toLowerCase() || null;
      followedWallet = followedUser?.wallet_address?.toLowerCase() || null;
    }

    // Atomic counter helper — falls back to read-then-write if RPC not yet deployed
    async function adjustFollowers(op: "inc" | "dec"): Promise<number> {
      const fn = op === "inc" ? "increment_user_followers" : "decrement_user_followers";
      const { data: rpcData, error: rpcErr } = await admin.rpc(fn, { p_user_id: followedId });
      if (!rpcErr && typeof rpcData === "number") return rpcData;

      // Fallback (pre-migration 018): racy but preserves prior behavior
      const { data: u } = await admin
        .from("users")
        .select("followers_count")
        .eq("id", followedId)
        .single();
      const current = u?.followers_count || 0;
      const next = op === "inc" ? current + 1 : Math.max(0, current - 1);
      await admin.from("users").update({ followers_count: next }).eq("id", followedId);
      return next;
    }

    // Check if already following (by user IDs)
    const { data: existing } = await admin
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followedId)
      .maybeSingle();

    let isFollowing: boolean;
    let followersCount = 0;

    if (existing) {
      // === UNFOLLOW ===
      const { error: deleteErr } = await admin
        .from("follows")
        .delete()
        .eq("id", existing.id);

      if (deleteErr) {
        console.error("[API /social/follow] delete error:", deleteErr);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      followersCount = await adjustFollowers("dec");
      isFollowing = false;
    } else {
      // === FOLLOW ===
      const insertData: Record<string, string> = {
        follower_id: followerId,
        following_id: followedId,
      };
      // Include wallet columns if available (backward compat)
      if (followerWallet) insertData.follower_wallet = followerWallet;
      if (followedWallet) insertData.followed_wallet = followedWallet;

      const { error: insertErr } = await admin
        .from("follows")
        .insert(insertData);

      if (insertErr) {
        console.error("[API /social/follow] insert error:", insertErr);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      followersCount = await adjustFollowers("inc");

      // Create follow notification (best-effort — should not break the follow)
      try {
        const { data: followerUser } = await admin
          .from("users")
          .select("name, username")
          .eq("id", followerId)
          .single();

        const followerName =
          followerUser?.name || followerUser?.username || "Someone";
        const followerHandle = followerUser?.username
          ? `@${followerUser.username}`
          : null;

        const { error: notifErr } = await admin.from("notifications").insert({
          user_id: followedId,
          type: "follow",
          title: "New follower",
          message: followerHandle
            ? `${followerName} (${followerHandle}) is now following you. Tap to view their profile.`
            : `${followerName} is now following you. Tap to view their profile.`,
          related_user_id: followerId,
          link: followerUser?.username ? `/profile/${followerUser.username}` : null,
          read: false,
        });

        if (notifErr) {
          console.error("[API /social/follow] notification insert error:", notifErr);
          Sentry.captureException(notifErr, {
            tags: { area: "social.follow.notification" },
          });
        }
      } catch (notifErr) {
        console.error("[API /social/follow] notification create failed:", notifErr);
      }

      isFollowing = true;
    }

    return NextResponse.json({
      isFollowing,
      followers_count: followersCount,
    });
  } catch (err: unknown) {
    console.error("[API /social/follow POST] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
