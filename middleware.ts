import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000; // 1 minute

// Cleanup expired entries periodically
let lastCleanup = Date.now();
function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup > WINDOW_MS * 2) {
    for (const [key, entry] of rateLimitStore) {
      if (now - entry.windowStart > WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
    lastCleanup = now;
  }
}

function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
  cleanupIfNeeded();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// ============================================================================
// Route-specific rate limits
// ============================================================================

function getRateLimit(pathname: string): number {
  // CRE callback: higher limit (multiple DON nodes call per verification)
  if (pathname === "/api/cre/callback") return 30;

  // AI endpoints: stricter limits (expensive API calls)
  if (pathname.startsWith("/api/ai/")) return 10;

  // Login endpoint: tightest limit (5/min per IP) — wallet sig brute-force prevention
  if (pathname === "/api/auth/login") return 5;

  // Auth endpoints: prevent brute force
  if (pathname.startsWith("/api/auth/")) return 20;

  // Public waitlist: prevent abuse (no auth required)
  if (pathname === "/api/waitlist") return 10;

  // Email endpoint: prevent spam
  if (pathname === "/api/email/send") return 5;

  // Payment endpoints: prevent abuse
  if (pathname.startsWith("/api/payment/")) return 10;

  // Default for all other API routes
  if (pathname.startsWith("/api/")) return 60;

  // Non-API routes: no rate limiting
  return 0;
}

// ============================================================================
// CORS Configuration
// ============================================================================

// Origins allowed to make cross-origin API requests (mobile app dev + production)
const ALLOWED_ORIGINS = [
  "http://localhost:8081",  // Expo web dev server
  "http://localhost:19006", // Expo web (alternate port)
  "http://localhost:3000",  // Next.js dev server
  "https://estories.app",
  "https://www.estories.app",
  "https://e-story-dapp.vercel.app", // Legacy Vercel deployment
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// ============================================================================
// Supabase Session Refresh
// ============================================================================

/**
 * Refresh the Supabase session on every page navigation.
 * Required for PKCE cookie-based auth — without this, expired sessions
 * are never refreshed and users appear logged out after ~1 hour.
 *
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
function refreshSupabaseSession(request: NextRequest, response: NextResponse): {
  supabase: ReturnType<typeof createServerClient>;
  response: NextResponse;
} {
  let currentResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies (for downstream middleware/routes)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Create a new response that includes the updated cookies
          currentResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            currentResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, get response() { return currentResponse; } };
}

// ============================================================================
// Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  // ── Step 1: Refresh Supabase session (page navigations only) ──────
  // Only run session refresh for browser page loads — NOT for API routes.
  // API routes handle their own auth via validateAuthOrReject/Bearer tokens.
  // Running getUser() on /api/auth/callback interferes with PKCE code exchange.
  // Running getUser() on /api/payment/webhook breaks Blockradar delivery.
  if (!pathname.startsWith("/api/")) {
    try {
      const sessionHelper = refreshSupabaseSession(request, response);
      await sessionHelper.supabase.auth.getUser();
      // Access response AFTER getUser() so setAll cookies are captured
      response = sessionHelper.response;
    } catch {
      // Never let session refresh crash the middleware — user will just
      // see a stale session and can re-authenticate on the next load.
    }
  }

  // ── Step 2: API routes — rate limiting + CORS ─────────────────────
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");

    // Handle CORS preflight (OPTIONS) requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    const maxRequests = getRateLimit(pathname);
    if (maxRequests > 0) {
      // Use IP + path prefix as rate limit key
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      // Group by path prefix (e.g., /api/ai/* all share the same bucket)
      const pathPrefix = pathname.split("/").slice(0, 4).join("/");
      const rateLimitKey = `${ip}:${pathPrefix}`;

      const { allowed, remaining } = checkRateLimit(rateLimitKey, maxRequests);

      if (!allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": "0",
              ...getCorsHeaders(origin),
            },
          }
        );
      }

      response.headers.set("X-RateLimit-Limit", String(maxRequests));
      response.headers.set("X-RateLimit-Remaining", String(remaining));
    }

    // Add CORS headers to API responses
    for (const [key, value] of Object.entries(getCorsHeaders(origin))) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes EXCEPT static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
