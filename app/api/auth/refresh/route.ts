import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/refresh
 *
 * Same-origin proxy for Supabase session refresh.
 *
 * Firefox's Enhanced Tracking Protection / Total Cookie Protection silently
 * blocks cross-origin requests to *.supabase.co. By routing refresh through
 * this same-origin endpoint, we bypass the blocklist entirely.
 *
 * Cookie handling:
 *   - Uses explicit request/response cookie adapter (Next.js App Router pattern)
 *   - Ensures refreshed session cookies are ALWAYS set on the response
 *   - Returns the new access_token so the caller can use it immediately
 */
export async function POST(request: NextRequest) {
  // Start with a response object that shares the request cookies
  const response = NextResponse.next({ request });

  const allCookies = request.cookies.getAll();
  const supabaseCookie = allCookies.find((c) =>
    c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mutate request cookies (for downstream middleware if any)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Set cookies on the response so the browser stores them
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message || "No active session" },
      { status: 401 }
    );
  }

  // Build final JSON response and copy over any cookies that were set
  // during refreshSession() above
  const finalResponse = NextResponse.json({
    access_token: data.session.access_token,
    expires_at: data.session.expires_at,
    refresh_token: data.session.refresh_token,
  });

  for (const cookie of response.cookies.getAll()) {
    finalResponse.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      path: cookie.path,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    });
  }

  return finalResponse;
}
