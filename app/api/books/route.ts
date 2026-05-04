// app/api/books/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const body = await req.json();

    const {
      title,
      description,
      story_ids,
      ipfs_hash,
    } = body ?? {};

    if (
      !title ||
      !Array.isArray(story_ids) ||
      story_ids.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields (title, story_ids[]).",
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    // Verify user exists and get wallet
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("id, wallet_address, name, username")
      .eq("id", authenticatedUserId)
      .single();

    if (userErr || !userRow) {
      console.error("[API /books] user lookup error:", userErr);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Insert book (author_id from auth token, not request body)
    const { data: inserted, error: insertError } = await admin
      .from("books")
      .insert({
        author_id: authenticatedUserId,
        author_wallet: userRow.wallet_address ?? null,
        title,
        description: description ?? null,
        story_ids,
        ipfs_hash: ipfs_hash ?? null,
        likes: 0,
        views: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[API /books] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save book" },
        { status: 500 }
      );
    }

    // Notify followers (best-effort — don't fail the request on notification errors)
    try {
      if (userRow.wallet_address) {
        const { data: followerRows } = await admin
          .from("follows")
          .select("follower_wallet")
          .eq("followed_wallet", userRow.wallet_address.toLowerCase());

        const followerWallets = (followerRows || [])
          .map((r) => r.follower_wallet)
          .filter(Boolean);

        if (followerWallets.length > 0) {
          const { data: followerUsers } = await admin
            .from("users")
            .select("id")
            .in("wallet_address", followerWallets);

          const authorName = userRow.name || userRow.username || "A storyteller";
          const notifications = (followerUsers || []).map((u) => ({
            user_id: u.id,
            type: "book_published",
            title: `${authorName} published a new book`,
            message: `"${title}" is now available.`,
            link: `/books/${inserted.id}`,
            read: false,
            metadata: { book_id: inserted.id, author_id: authenticatedUserId },
          }));

          if (notifications.length > 0) {
            await admin.from("notifications").insert(notifications);
          }
        }
      }
    } catch (notifErr) {
      console.error("[API /books] follower notify failed (non-blocking):", notifErr);
    }

    return NextResponse.json({ book: inserted }, { status: 200 });
  } catch (err: unknown) {
    console.error("[API /books] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
