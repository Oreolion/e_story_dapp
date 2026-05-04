import { createBrowserClient } from "@supabase/ssr";

// Firefox's Web Locks API can deadlock when a page navigates away during
// OAuth (window.location.assign) while holding a lock. The lock is never
// released, so getSession() hangs forever on the next page load.
// @see https://github.com/supabase/gotrue-js/issues/983
const isFirefox =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");

// No-op lock bypasses the Navigator LockManager API entirely.
// This is safe because we disable auto-refresh below; the only concurrent
// operations are getSession() reads which are harmless without locking.
const lockNoOp = async (
  _name: string,
  _timeout: number,
  fn: () => Promise<any>
) => {
  return await fn();
};

// Singleton browser Supabase client using @supabase/ssr.
// Uses cookie-based sessions with PKCE auth flow (default).
// Replaces the old createClient + localStorage implicit flow.
const createSupabaseClient = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // NOTE: createBrowserClient OVERRIDES autoRefreshToken to true
      // regardless of what we pass here (see @supabase/ssr source). We
      // force it back to false after construction below.
      auth: {
        autoRefreshToken: false,
        // Firefox only: disable Web Locks to prevent OAuth redirect deadlocks.
        ...(isFirefox ? { lock: lockNoOp } : {}),
      },
      // Ensure client-side token writes persistent cookies (with maxAge),
      // not session cookies. Without this, Firefox clears the refreshed
      // session on window close because document.cookie writes default to
      // session cookies (no expiry). Chrome silently restores them via
      // "Continue where you left off".
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 400, // 400 days — matches Supabase max session lifetime
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    } as any
  );

  // createBrowserClient internally forces autoRefreshToken: true. This causes
  // the client to make direct requests to *.supabase.co which are blocked by
  // Firefox ETP, corrupting the session. We force it back to false and stop
  // any ticker that may have already started.
  (client.auth as any).autoRefreshToken = false;
  client.auth.stopAutoRefresh();

  // CRITICAL: getSession() internally calls _refreshAccessToken() when the
  // session is expired — regardless of autoRefreshToken setting. In Firefox,
  // the fetch() to *.supabase.co can hang FOREVER (not just fail) when ETP
  // blocks it. This blocks getSession() indefinitely, which blocks
  // getAccessToken(), which blocks all React Query hooks → infinite loading.
  //
  // Return a null session with no error so internal callers that do
  // `if (error) throw error` don't emit unhandled rejections (Firefox surfaces
  // these; Chrome silences them). AuthProvider falls back to /api/auth/refresh.
  (client.auth as any)._refreshAccessToken = async () => {
    return {
      data: { session: null, user: null },
      error: null,
    };
  };

  // Safety net: if getSession() still hangs for any reason, force a timeout
  // so AuthProvider can fall back to /api/auth/refresh instead of blocking
  // the UI forever.
  //
  // IMPORTANT: Promise.race() leaks uncaught rejections from the losing
  // promise. We use a manual race that clears the timeout when
  // originalGetSession() settles.
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async () => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({
            data: { session: null },
            error: new Error("getSession timeout — falling back to proxy"),
          } as any);
        }
      }, 4000);

      originalGetSession()
        .then((result: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((err: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  };

  return client;
};

export const supabaseClient =
  typeof window !== "undefined" ? createSupabaseClient() : null;
