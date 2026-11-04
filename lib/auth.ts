import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { verifyWalletToken } from "./jwt";
import type { User } from "@supabase/supabase-js";
import { AuthStoreUnavailable, canonicalUserId, type AuthPrincipal } from "./auth/principal";
import { runtimeConfiguration } from "./runtime/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  runtimeConfiguration();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Validate Supabase session cookies (Google/OAuth PKCE users).
 * Server-side only — uses @supabase/ssr to read PKCE cookies.
 */
async function validateSupabaseCookie(request: NextRequest): Promise<User | null> {
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
      return user;
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
export async function authenticatePrincipal(
  request: NextRequest
): Promise<AuthPrincipal | null> {
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
          return { kind: "supabase", subject: user.id, user };
        }
      } catch {
        /* Supabase token invalid — fall through to wallet JWT */
      }

      // 2. Try custom wallet JWT from Bearer header
      const walletPayload = await verifyWalletToken(token);
      if (walletPayload) {
        return { kind: "wallet", subject: walletPayload.userId, wallet: walletPayload.wallet };
      }
    }

    // 3. Try httpOnly cookie (wallet users with cookie-based auth)
    const cookieToken = request.cookies.get("estory_wallet_token")?.value;
    if (cookieToken) {
      const cookiePayload = await verifyWalletToken(cookieToken);
      if (cookiePayload) {
        return { kind: "wallet", subject: cookiePayload.userId, wallet: cookiePayload.wallet };
      }
    }

    // 4. Try Supabase session cookies (Google OAuth / PKCE users).
    // Fallback when no Bearer token is sent — the browser sends Supabase
    // auth cookies automatically with same-origin requests.
    const user = await validateSupabaseCookie(request);
    if (user) {
      return { kind: "supabase", subject: user.id, user };
    }

    return null;
  } catch (err) {
    console.warn("[AUTH] Principal verification unavailable");
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
  let userId: string | null;
  try { userId = await validateAuth(request); }
  catch (error) {
    if (error instanceof AuthStoreUnavailable) return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503 });
    throw error;
  }
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
 * validateAuth resolves verified principals before returning a domain ID.
 * This compatibility helper must not remap a domain ID a second time.
 */
export async function resolveUserId(
  authenticatedUserId: string
): Promise<string> {
  return authenticatedUserId;
}

/** OAuth proof must never fall back to a wallet cookie. */
export async function authenticateSupabasePrincipal(request: NextRequest): Promise<Extract<AuthPrincipal, { kind: "supabase" }> | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (token) {
    try {
      const { data, error } = await getAdminClient().auth.getUser(token);
      if (!error && data.user) return { kind: "supabase", subject: data.user.id, user: data.user };
    } catch { return null; }
    return null;
  }
  const user = await validateSupabaseCookie(request);
  return user ? { kind: "supabase", subject: user.id, user } : null;
}

export async function resolvePrincipalId(principal: AuthPrincipal): Promise<string> {
  return canonicalUserId(async subject => {
    const { data, error } = await getAdminClient().from("auth_identity_links").select("user_id").eq("auth_user_id", subject).maybeSingle();
    if (error) throw new AuthStoreUnavailable();
    if (!data) return null;
    if (typeof data.user_id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.user_id)) throw new AuthStoreUnavailable();
    return data.user_id;
  }, principal);
}

export async function validateAuth(request: NextRequest): Promise<string | null> {
  const principal = await authenticatePrincipal(request);
  return principal ? resolvePrincipalId(principal) : null;
}

/**
 * Helper: check if a value is a NextResponse (i.e., auth failed).
 */
export function isAuthError(
  result: string | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
