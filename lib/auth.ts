import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { verifyWalletToken } from "./jwt";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Validate Supabase session cookies (Google/OAuth PKCE users).
 * Server-side only — uses @supabase/ssr to read PKCE cookies.
 */
async function validateSupabaseCookie(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // API routes don't need to write cookies back here;
          // middleware handles cookie refresh on page navigations.
        },
      },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user.id;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Validate auth from request and return user ID if valid.
 *
 * Checks three sources in order:
 *   1. Bearer token → Supabase session JWT (Google/OAuth users)
 *   2. Bearer token → Custom wallet JWT (wallet-authenticated users)
 *   3. httpOnly cookie `estory_wallet_token` → Custom wallet JWT (fallback)
 *
 * Returns null if no valid auth found.
 */
export async function validateAuth(
  request: NextRequest
): Promise<string | null> {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (token) {
      // 1. Try Supabase session token (Google/OAuth users)
      try {
        const supabase = getAdminClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (!error && user) {
          return user.id;
        }
      } catch {
        /* Supabase token invalid — fall through to wallet JWT */
      }

      // 2. Try custom wallet JWT from Bearer header
      const walletPayload = await verifyWalletToken(token);
      if (walletPayload) {
        return walletPayload.userId;
      }
    }

    // 3. Try httpOnly cookie (wallet users with cookie-based auth)
    const cookieToken = request.cookies.get("estory_wallet_token")?.value;
    if (cookieToken) {
      const cookiePayload = await verifyWalletToken(cookieToken);
      if (cookiePayload) {
        return cookiePayload.userId;
      }
    }

    // 4. Try Supabase session cookies (Google OAuth / PKCE users).
    // Fallback when no Bearer token is sent — the browser sends Supabase
    // auth cookies automatically with same-origin requests.
    const supabaseUserId = await validateSupabaseCookie(request);
    if (supabaseUserId) {
      return supabaseUserId;
    }

    return null;
  } catch (err) {
    console.warn("[AUTH] validateAuth unexpected error:", (err as Error)?.message);
    return null;
  }
}

/**
 * Validate Bearer token and return user ID, or return a 401 response.
 * Use this when the route requires authentication.
 */
export async function validateAuthOrReject(
  request: NextRequest
): Promise<string | NextResponse> {
  const userId = await validateAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}

/**
 * Verify that the authenticated user owns the given wallet address.
 * Looks up the users table to confirm wallet_address matches.
 */
export async function validateWalletOwnership(
  userId: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    if (error || !data) return false;

    return data.wallet_address?.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Resolve the effective users-table ID from the authenticated user ID.
 *
 * For wallet JWT users, the ID already points at the users table row
 * (no Supabase auth user indirection). For Supabase OAuth users,
 * the auth uid usually matches the users table ID directly.
 * Falls back to wallet_address lookup if there's an ID mismatch.
 */
export async function resolveUserId(
  authenticatedUserId: string
): Promise<string> {
  const supabase = getAdminClient();

  // Fast path: ID directly matches a users row
  const { data: directUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", authenticatedUserId)
    .maybeSingle();

  if (directUser) return directUser.id;

  // Slow path: look up via wallet_address from Supabase auth user metadata
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.admin.getUserById(authenticatedUserId);
    const walletAddress = authUser?.user_metadata?.wallet_address;
    if (walletAddress) {
      const { data: walletUser } = await supabase
        .from("users")
        .select("id")
        .eq("wallet_address", walletAddress.toLowerCase())
        .maybeSingle();
      if (walletUser) return walletUser.id;
    }
  } catch {
    // getUserById failed — return original ID
  }

  return authenticatedUserId;
}

/**
 * Helper: check if a value is a NextResponse (i.e., auth failed).
 */
export function isAuthError(
  result: string | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
