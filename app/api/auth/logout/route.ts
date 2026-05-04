import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout — Clear the wallet JWT httpOnly cookie.
 * Supabase session is cleared client-side via supabase.auth.signOut().
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("estory_wallet_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });
  return response;
}
