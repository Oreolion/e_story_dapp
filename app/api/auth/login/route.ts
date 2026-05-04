import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { verifyMessage, type Address, isHex } from "viem";
import { verifyNonce } from "@/lib/nonce";
import { signWalletToken } from "@/lib/jwt";

/**
 * Wallet login route (server)
 *
 * Flow:
 * 1. Client fetches nonce from /api/auth/nonce?address=0x...
 * 2. Client signs the message containing the nonce
 * 3. Client sends address + signature + message to this endpoint
 * 4. Server verifies signature AND nonce (replay prevention)
 * 5. Server upserts the users table row
 * 6. Server returns a custom JWT — no fake emails, no verifyOtp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, signature, message } = body ?? {};

    // 1. Input validation
    if (!address || !signature || !message) {
      return NextResponse.json(
        { error: "Missing address, signature, or message." },
        { status: 400 }
      );
    }

    if (typeof signature !== "string" || !isHex(signature)) {
      return NextResponse.json(
        { error: "The provided signature was not a valid hexadecimal string." },
        { status: 400 }
      );
    }
    const validatedSignature = signature as `0x${string}`;
    const validatedAddress = address as Address;

    // 2. Verify wallet signature
    const isValid = await verifyMessage({
      address: validatedAddress,
      message,
      signature: validatedSignature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Signature verification failed." },
        { status: 401 }
      );
    }

    // 3. Verify nonce (replay prevention)
    const nonceResult = await verifyNonce(address, message);
    if (!nonceResult.valid) {
      return NextResponse.json(
        { error: nonceResult.error || "Invalid nonce" },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdminClient();
    const walletAddress = validatedAddress.toLowerCase();

    // 4. Find or create user in the users table (no Supabase auth user needed)
    const { data: existingUser } = await admin
      .from("users")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    let profile;
    if (existingUser) {
      // Update auth_provider if needed (e.g., was "google", now has wallet)
      if (
        existingUser.auth_provider === "google" &&
        existingUser.wallet_address
      ) {
        const { data: updated } = await admin
          .from("users")
          .update({ auth_provider: "both" })
          .eq("id", existingUser.id)
          .select()
          .maybeSingle();
        profile = updated ?? existingUser;
      } else {
        profile = existingUser;
      }
    } else {
      // Create new wallet-only user
      const { data: created, error: createErr } = await admin
        .from("users")
        .insert({
          wallet_address: walletAddress,
          auth_provider: "wallet",
          is_onboarded: false,
        })
        .select()
        .single();

      if (createErr) {
        // Handle race condition: user was created between check and insert
        if (createErr.code === "23505") {
          const { data: raceUser } = await admin
            .from("users")
            .select("*")
            .eq("wallet_address", walletAddress)
            .maybeSingle();
          profile = raceUser;
        } else {
          console.error("[AUTH LOGIN] User creation failed:", createErr);
          return NextResponse.json(
            { error: "An internal server error occurred" },
            { status: 500 }
          );
        }
      } else {
        profile = created;
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "An internal server error occurred" },
        { status: 500 }
      );
    }

    // 5. Sign a custom JWT for this wallet user
    //    The wallet signature was already verified above, so this is secure.
    const walletToken = await signWalletToken(profile.id, walletAddress);

    const response = NextResponse.json({
      success: true,
      user: profile,
    });

    // Set wallet JWT as httpOnly cookie — immune to XSS
    response.cookies.set("estory_wallet_token", walletToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days (matches JWT expiry)
    });

    return response;
  } catch (err: unknown) {
    console.error("Wallet auth route error:", err);
    return NextResponse.json(
      { error: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
