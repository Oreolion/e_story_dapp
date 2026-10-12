import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { isAuthError, resolveUserId, validateAuthOrReject } from "@/lib/auth";
import { parseBlockedUserId } from "@/lib/contentSafety";

async function getAuthenticatedUserId(req: NextRequest) {
  const authResult = await validateAuthOrReject(req);
  if (isAuthError(authResult)) return authResult;
  return resolveUserId(authResult);
}

export async function GET(req: NextRequest) {
  try {
    const blockerId = await getAuthenticatedUserId(req);
    if (isAuthError(blockerId)) return blockerId;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("user_blocks")
      .select("blocked_id, created_at, blocked:users!user_blocks_blocked_id_fkey(id, name, username, avatar)")
      .eq("blocker_id", blockerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SAFETY_BLOCK] list failed:", error);
      return NextResponse.json({ error: "Unable to load blocked users" }, { status: 500 });
    }
    return NextResponse.json({ blockedUsers: data ?? [] });
  } catch (error) {
    console.error("[SAFETY_BLOCK] unexpected list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const blockerId = await getAuthenticatedUserId(req);
    if (isAuthError(blockerId)) return blockerId;

    const parsed = parseBlockedUserId(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.data === blockerId) {
      return NextResponse.json({ error: "You cannot block yourself" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: target } = await admin
      .from("users")
      .select("id")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await admin.rpc("block_user", {
      p_blocker_id: blockerId,
      p_blocked_id: parsed.data,
    });
    if (error) {
      console.error("[SAFETY_BLOCK] block failed:", error);
      return NextResponse.json({ error: "Unable to block user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SAFETY_BLOCK] unexpected block error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const blockerId = await getAuthenticatedUserId(req);
    if (isAuthError(blockerId)) return blockerId;

    const parsed = parseBlockedUserId(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("user_blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", parsed.data);
    if (error) {
      console.error("[SAFETY_BLOCK] unblock failed:", error);
      return NextResponse.json({ error: "Unable to unblock user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SAFETY_BLOCK] unexpected unblock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
