import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { isAuthError, resolveUserId, validateAuthOrReject } from "@/lib/auth";

async function deleteStorageObjects(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bucketName: string,
  userId: string
) {
  const bucket = admin.storage.from(bucketName);
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await bucket.list(userId, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Unable to enumerate ${bucketName}`);
    if (!data?.length) break;

    paths.push(...data.map((file) => `${userId}/${file.name}`));
    if (data.length < 100) break;
    offset += data.length;
  }

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await bucket.remove(paths.slice(index, index + 100));
    if (error) throw new Error(`Unable to delete ${bucketName}`);
  }
}

/**
 * DELETE /api/user
 *
 * Deletes storage, all off-chain database data, and the Supabase Auth identity.
 * Public blockchain records cannot be removed and are disclosed in the UI.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const admin = createSupabaseAdminClient();

    // Abort before database/auth deletion if private media cannot be removed.
    await deleteStorageObjects(admin, "story-audio", userId);
    await deleteStorageObjects(admin, "avatars", userId);

    const { error: databaseError } = await admin.rpc("delete_user_account_data", {
      p_user_id: userId,
    });
    if (databaseError) {
      console.error("[USER_DELETE] database deletion failed:", databaseError);
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
    }

    // Wallet-only accounts have no Supabase Auth identity. A missing auth user
    // is therefore an expected, idempotent outcome.
    const { error: authError } = await admin.auth.admin.deleteUser(authResult);
    if (authError && authError.status !== 404) {
      console.error("[USER_DELETE] auth identity deletion failed:", authError);
      return NextResponse.json(
        { error: "Account data was deleted, but sign-in removal is still processing" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Account and off-chain data deleted. Public blockchain records may persist.",
    });
    response.cookies.set("estory_wallet_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[USER_DELETE] unexpected error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
