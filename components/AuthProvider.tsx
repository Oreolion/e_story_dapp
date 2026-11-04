"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import type { User, Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/app/utils/supabase/supabaseClient";
import type { OnboardingData } from "@/app/types";

// Wallet JWT is now stored as an httpOnly cookie set by /api/auth/login.
// Legacy localStorage key kept only for migration cleanup.
const WALLET_TOKEN_KEY = "estory_wallet_token";

// Firefox throttles background tabs aggressively; Supabase auth calls and
// fetches can zombie after the tab returns from idle. Bound every external
// call so the UI can never stall waiting on a hung request.
const AUTH_CALL_TIMEOUT_MS = 8_000;
// Tab idle longer than this triggers a session refresh + profile re-probe on
// return. Short enough to catch "came back from lunch" without over-firing
// during quick tab switches.
const IDLE_REFRESH_THRESHOLD_MS = 60_000;

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  ms = AUTH_CALL_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { credentials: "same-origin", ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type PlanType = "free" | "storyteller" | "creator";

export interface UnifiedUserProfile {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  avatar: string | null;
  wallet_address: string | null;
  balance: string;
  isConnected: boolean;
  supabaseUser: User | null;
  auth_provider: "wallet" | "google" | "both";
  is_onboarded: boolean;
  google_id: string | null;
  subscription_plan: PlanType;
  subscription_expires_at: string | null;
}

export interface AuthContextType {
  profile: UnifiedUserProfile | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  /** Get a valid Bearer token for API calls (Supabase or wallet JWT). */
  getAccessToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  profile: null,
  isLoading: true,
  needsOnboarding: false,
  getAccessToken: async () => null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  completeOnboarding: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseClient;
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { signMessageAsync } = useSignMessage();

  const [profile, setProfile] = useState<UnifiedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const signInAttemptRef = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authEpochRef = useRef(0);
  const oauthRequestRef = useRef<{ subject: string; promise: Promise<void> } | null>(null);

  // Refs to stabilize onAuthStateChange callback without adding unstable
  // dependencies (isConnected, handleGoogleSignIn) that cause constant
  // re-subscription and can suppress INITIAL_SESSION events.
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const handleGoogleSignInRef = useRef<any>(null);
  const handleSessionRef = useRef<any>(null);
  // Set once mount hydrates the profile so onAuthStateChange's INITIAL_SESSION
  // branch doesn't re-run handleGoogleSignIn / handleSession. Without this,
  // every Google user load runs the users-table lookup twice and emits two
  // profile object references — which cascades through getAccessToken and
  // invalidates every React Query / useEffect consumer twice on first paint.
  const hydratedRef = useRef(false);

  const VALID_PLANS: PlanType[] = ["free", "storyteller", "creator"];

  const buildProfile = (
    userRow: any,
    sessionUser: User | null
  ): UnifiedUserProfile => {
    // Determine if subscription is still active
    const rawPlan = userRow.subscription_plan ?? "free";
    const planFromDb: PlanType = VALID_PLANS.includes(rawPlan) ? rawPlan : "free";
    const expiresAt = userRow.subscription_expires_at ?? null;
    const isExpired = !expiresAt || new Date(expiresAt) <= new Date();
    const activePlan: PlanType = (planFromDb !== "free" && !isExpired) ? planFromDb : "free";

    return {
      id: userRow.id,
      name: userRow.name ?? null,
      username: userRow.username ?? null,
      email: userRow.email ?? null,
      avatar: userRow.avatar ?? null,
      wallet_address:
        (userRow.wallet_address ?? address ?? null)?.toLowerCase?.() ?? null,
      balance: ethBalance?.formatted ?? "0",
      isConnected: Boolean(isConnected),
      supabaseUser: sessionUser,
      auth_provider: userRow.auth_provider ?? "wallet",
      is_onboarded: userRow.is_onboarded ?? false,
      google_id: userRow.google_id ?? null,
      subscription_plan: activePlan,
      subscription_expires_at: expiresAt,
    };
  };

  const setUnifiedProfile = (userRow: any, sessionUser: User | null) => {
    if (!userRow) {
      setProfile(null);
      setNeedsOnboarding(false);
      return;
    }
    const p = buildProfile(userRow, sessionUser);
    setProfile(p);
    setNeedsOnboarding(!p.is_onboarded);
  };

  // ─── Centralized token accessor ──────────────────────────────────────
  // Returns an explicit token for Google/OAuth users (Supabase session).
  // For wallet users, returns "cookie" sentinel — the httpOnly cookie is
  // sent automatically by the browser with every same-origin request.
  // API routes (lib/auth.ts) check both Bearer header and cookie.
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // 1. Fast path: valid Supabase session in browser storage (Google OAuth users)
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        const sessionValid =
          session?.expires_at && session.expires_at * 1000 > Date.now() + 60_000;

        if (session?.access_token && sessionValid) {
          return session.access_token;
        }
      }
    } catch {
      // getSession() failed (expired session + _refreshAccessToken override error,
      // or timeout). Fall through to refresh proxy.
    }

    // 2. Session expired or missing — attempt refresh via same-origin proxy.
    // The server can read Supabase cookies and refresh even when the browser
    // client can't (Firefox ETP, computer sleep, or _refreshAccessToken override).
    // We ALWAYS try this — don't gate on profile state or refresh_token presence.
    try {
      const res = await fetchWithTimeout("/api/auth/refresh", {
        method: "POST",
      });
      if (res.ok) {
        const refreshed = await res.json();
        if (refreshed?.access_token) {
          return refreshed.access_token;
        }
      } else if (
        res.status === 401 &&
        profile &&
        profile.auth_provider === "google"
      ) {
        // Google-only user: Supabase session died server-side and there's no
        // wallet cookie fallback. Clear profile so UI reflects logged-out state
        // and React Query hooks stop retrying. Deferred so in-flight callers
        // finish cleanly before the re-render cascade.
        // Wallet and "both" users are excluded — a 401 here is expected for
        // them (no Supabase session to refresh) and their cookie path still works.
        setTimeout(() => {
          setProfile(null);
          setNeedsOnboarding(false);
          hydratedRef.current = false;
        }, 0);
      }
    } catch {
      /* proxy refresh failed (network/timeout) — do NOT clear profile; transient */
    }

    // 3. Fallback: direct cross-origin refresh (dead codepath because
    // _refreshAccessToken is overridden, but kept as a safety net).
    try {
      if (supabase) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
      }
    } catch {
      /* direct refresh failed */
    }

    // 4. Wallet user — httpOnly cookie is sent automatically.
    if (profile?.auth_provider === "wallet" || profile?.auth_provider === "both") {
      return "cookie";
    }

    return null;
  }, [supabase, profile]);

  // ─── Google OAuth handler ────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(
    async (session: Session) => {
      if (!supabase) return;
      const subject = session.user.id;
      if (oauthRequestRef.current?.subject === subject) return oauthRequestRef.current.promise;
      const epoch = ++authEpochRef.current;
      const work = (async () => {
        try {
          const stored = sessionStorage.getItem("googleLinkingProof");
          sessionStorage.removeItem("googleLinkingProof");
          sessionStorage.removeItem("googleLinkingToken");
          sessionStorage.removeItem("googleLinkingUserId");
          const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
          if (stored) {
            const proof = JSON.parse(stored);
            const linked = await fetchWithTimeout("/api/auth/link-google", {
              method: "POST", headers, body: JSON.stringify({ challengeId: proof.challengeId, signature: proof.signature }),
            });
            const result = await linked.json();
            if (!linked.ok) throw new Error(result.code === "link_conflict" ? "Account link conflict. Your existing data is preserved; contact support before merging accounts." : "Link verification failed or expired. Restart from your wallet profile.");
          }
          const response = await fetchWithTimeout("/api/auth/session", { method: "POST", headers });
          const result = await response.json();
          if (authEpochRef.current !== epoch) return;
          if (!response.ok || !result.user) {
            setUnifiedProfile(null, null);
            setAuthError(result.code === "identity_reverification_required"
              ? "This account link needs verification. Sign out, connect your wallet, then choose Verify Google link in Profile and sign in to the same Google account."
              : "Your account could not be loaded. Please retry signing in.");
            return;
          }
          setAuthError(null);
          setUnifiedProfile(result.user, session.user);
        } catch (error) {
          if (authEpochRef.current !== epoch) return;
          setUnifiedProfile(null, null);
          setAuthError(error instanceof Error && error.message.startsWith("Account link conflict") ? error.message : "Account verification could not finish. Restart linking from your wallet profile.");
        }
      })();
      oauthRequestRef.current = { subject, promise: work };
      try { await work; }
      finally { if (oauthRequestRef.current?.promise === work) oauthRequestRef.current = null; }
    },
    [supabase, address, isConnected, ethBalance]
  );
  handleGoogleSignInRef.current = handleGoogleSignIn;

  // ─── Mount-time eager auth hydration ────────────────────────────────
  // Replaces the removed getUser() call. This is the fastest way to
  // restore auth state without waiting for onAuthStateChange, which can
  // hang in Firefox (Web Locks deadlock).
  //
  // Order:
  //   1. Try Supabase session (Google users) via getSession()
  //   2. Try wallet cookie directly via /api/user/profile
  //   3. If neither works, flip isLoading false so the wallet effect can run
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        // Fast path 1: Supabase session (Google / OAuth users)
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          const provider = session.user.app_metadata?.provider;
          if (provider === "google") {
            await handleGoogleSignInRef.current?.(session);
          } else {
            await handleSessionRef.current?.(session);
          }
          hydratedRef.current = true;
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[AUTH] Mount effect getSession failed:", (err as Error)?.message);
      }

      try {
        // Fast path 2: Wallet httpOnly cookie (wallet users)
        const res = await fetchWithTimeout("/api/user/profile");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUnifiedProfile(data.user, null);
            hydratedRef.current = true;
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("[AUTH] Mount effect probe failed:", (err as Error)?.message);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    run();

    // UI safety net: if getSession() hangs on a cross-tab lock, don't
    // block the page forever. Unblock after 3s so public data can load.
    const uiTimeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 3_000);

    return () => {
      cancelled = true;
      clearTimeout(uiTimeout);
    };
  }, [supabase]);

  // ─── Auth state change listener (single source of truth) ─────────────
  // Subscription is created ONCE and never recreated. Unstable callbacks
  // are accessed via refs to avoid suppressing INITIAL_SESSION events.
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === "SIGNED_OUT") {
          authEpochRef.current++;
          oauthRequestRef.current = null;
          if (!isConnectedRef.current) {
            setProfile(null);
            setNeedsOnboarding(false);
          }
          return;
        }

        // Handle Google sign-in on BOTH events:
        // - SIGNED_IN: fires during active sign-in (user clicks "Sign in with Google")
        // - INITIAL_SESSION: fires on page load when session cookies already exist
        //   (PKCE flow sets cookies server-side in the callback route, so the
        //    browser client sees an existing session and fires INITIAL_SESSION,
        //    NOT SIGNED_IN)
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
          // Skip if mount effect already hydrated — otherwise we re-query
          // users and emit a second profile object ref, doubling downstream
          // React Query / useCallback invalidations on first paint.
          if (event === "INITIAL_SESSION" && hydratedRef.current) {
            return;
          }

          const provider = session.user.app_metadata?.provider;

          // CRITICAL: _notifyAllSubscribers() is called from inside
          // _initialize() while the auth lock is held. If we await
          // handleGoogleSignIn/handleSession here, and they call
          // supabase.from() which internally calls getSession(), we
          // deadlock: getSession() queues behind the lock, but the lock
          // won't release until _notifyAllSubscribers() completes.
          //
          // Fix: defer to next event loop tick so _initialize() finishes
          // and releases the lock before any nested getSession() calls.
          if (provider === "google") {
            setTimeout(() => {
              handleGoogleSignInRef.current?.(session)
                .then(() => { hydratedRef.current = true; })
                .catch((err: any) => {
                  console.error("[AUTH] deferred handleGoogleSignIn error:", err);
                });
            }, 0);
          } else {
            setTimeout(() => {
              handleSessionRef.current?.(session)
                .then(() => { hydratedRef.current = true; })
                .catch((err: any) => {
                  console.error("[AUTH] deferred handleSession error:", err);
                });
            }, 0);
          }
          return;
        }

        // INITIAL_SESSION fired with no Supabase session → could be a wallet user
        // whose session lives in an httpOnly cookie (no Supabase auth user involved).
        // Probe the server immediately so profile is restored without waiting for
        // the wallet extension to reconnect.
        if (event === "INITIAL_SESSION" && !session) {
          try {
            const probeRes = await fetchWithTimeout("/api/user/profile");
            if (probeRes.ok) {
              const probeData = await probeRes.json();
              if (probeData?.user) {
                setUnifiedProfile(probeData.user, null);
                return;
              }
            }
          } catch (err) {
            // Timeout or no valid cookie — user is genuinely logged out.
            if (err instanceof Error && err.name === "AbortError") {
              console.warn("[AUTH] INITIAL_SESSION probe aborted after timeout");
            }
          }
        }

        // TOKEN_REFRESHED fires when /api/auth/refresh rotates the sb-* cookies
        // and @supabase/ssr re-reads them. Profile data is unchanged — re-running
        // handleSession would emit a new profile object reference, invalidate
        // every getAccessToken/useCallback consumer, and cascade into refetches.
        // See docs/AUTH_BUG_ANALYSIS.md.
        if (event === "TOKEN_REFRESHED") {
          return;
        }

        // USER_UPDATED / PASSWORD_RECOVERY etc. — re-hydrate from session.
        if (session) {
          await handleSessionRef.current?.(session);
        }
      } catch (err) {
        console.error("[AUTH] onAuthStateChange unexpected error:", err);
        setProfile(null);
        setNeedsOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // ─── Auth hydration safety net ───────────────────────────────────────
  // Firefox can leave Supabase's auth client in a state where
  // onAuthStateChange never fires INITIAL_SESSION (Web Locks deadlock,
  // background tab throttling, or zombie connections). This guarantees
  // the UI never stays in loading limbo.
  useEffect(() => {
    if (!supabase) return;

    const safetyTimer = setTimeout(() => {
      setIsLoading((currentlyLoading) => {
        if (!currentlyLoading) return false;

        // Don't race with an active wallet login flow.
        if (signInAttemptRef.current) {
          console.warn(
            "[AUTH] Auth hydration safety timeout skipped — sign-in attempt in progress"
          );
          return false;
        }

        console.warn(
          "[AUTH] Auth hydration safety timeout fired — forcing isLoading false"
        );

        // Attempt one last lightweight probe via API (avoids Supabase auth
        // lock entirely). If it fails, assume logged out.
        fetchWithTimeout("/api/user/profile")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.user) {
              setUnifiedProfile(data.user, null);
            } else {
              setProfile(null);
              setNeedsOnboarding(false);
            }
          })
          .catch(() => {
            setProfile(null);
            setNeedsOnboarding(false);
          });

        return false;
      });
    }, 10_000);

    return () => clearTimeout(safetyTimer);
  }, [supabase]);

  // ─── Tab visibility: recover from idle (Firefox zombie-connection fix) ─
  // Firefox throttles background tabs and can leave Supabase's auth client
  // and cookies in a stale state after >60s idle. On return, force a
  // session refresh and re-probe the profile so the UI doesn't flash
  // logged-out or leave data hooks hanging on a stuck getAccessToken().
  useEffect(() => {
    if (!supabase) return;
    if (typeof document === "undefined") return;

    let hiddenAt: number | null = null;

    const onVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null) return;
      const idleMs = Date.now() - hiddenAt;
      hiddenAt = null;
      if (idleMs < IDLE_REFRESH_THRESHOLD_MS) return;

      // Re-probe profile. We intentionally do NOT call refreshSession()
      // here because it can hold the Supabase auth lock for seconds if the
      // network is slow, blocking all subsequent getSession() calls and
      // causing the UI to hang on the next navigation.
      try {
        const probeRes = await fetchWithTimeout("/api/user/profile");
        if (probeRes.ok) {
          const probeData = await probeRes.json();
          if (probeData?.user) {
            setUnifiedProfile(
              probeData.user,
              probeData.user.auth_provider === "google" ? profile?.supabaseUser ?? null : null,
            );
          }
        } else if (probeRes.status === 401) {
          // Definitive: server reached and both auth methods (Supabase session
          // cookie AND wallet JWT cookie) failed to validate. Session is dead.
          // Clear profile so UI flips to logged-out and the user can re-auth.
          // Other HTTP errors (5xx, 404) are treated as transient and ignored.
          setProfile(null);
          setNeedsOnboarding(false);
          hydratedRef.current = false;
        }
      } catch {
        // Network error or timeout — silent, don't clear (could be offline/blip)
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [supabase, profile?.supabaseUser]);

  // ─── Supabase session handler (Google/OAuth) ─────────────────────────
  const handleSession = async (session: Session | null) => {
    if (!session?.user) {
      authEpochRef.current++;
      oauthRequestRef.current = null;
      setUnifiedProfile(null, null);
      return;
    }
    if (session.user.identities?.some(identity => identity.provider === "google")) {
      await handleGoogleSignInRef.current?.(session);
      return;
    }
    const epoch = ++authEpochRef.current;
    try {
      const response = await fetchWithTimeout("/api/user/profile", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (authEpochRef.current !== epoch) return;
      setUnifiedProfile(response.ok ? result.user : null, response.ok ? session.user : null);
    } catch {
      if (authEpochRef.current === epoch) setUnifiedProfile(null, null);
    }
  };
  handleSessionRef.current = handleSession;

  // ─── Wallet connection effect ────────────────────────────────────────
  // For returning users with a stored wallet JWT, hydrate profile immediately.
  // For new users (or expired JWT), trigger the signature flow.
  // IMPORTANT: Never trigger the MetaMask signature flow when a Google
  // session exists — the user should use the explicit "Link Wallet" button.
  useEffect(() => {
    if (!isConnected || !address) return;
    if (signInAttemptRef.current) return;
    if (profile) return;
    // Wait for session hydration to finish before triggering wallet login.
    // Otherwise, we race against the Google OAuth session hydration and
    // may start a nonce flow that the user didn't intend.
    if (isLoading) return;

    const run = async () => {
      try {
        const addrLower = address?.toLowerCase?.();
        if (!addrLower) {
          console.warn("[AUTH] Wallet address is undefined, skipping");
          return;
        }

        // ── Step 0: Check if there's an active Supabase session (Google user).
        // If so, the Google handler will set the profile — do NOT start
        // the MetaMask nonce→sign flow.  The user should use the
        // explicit "Link Wallet" button on the profile page instead.
        if (supabase) {
          const {
            data: { session: existingSession },
          } = await supabase.auth.getSession();

          // Only trust the session if it's not expired
          const sessionValid = existingSession?.expires_at
            && existingSession.expires_at * 1000 > Date.now() + 60_000;

          if (existingSession?.user && sessionValid) {
            console.log(
              "[AUTH] Active Supabase session detected — skipping wallet auto-login. Use 'Link Wallet' to connect."
            );
            // Reuse canonical server resolution; an OAuth subject may map to
            // a different domain profile after verified wallet linking.
            await handleSessionRef.current?.(existingSession);
            return;
          }
        }

        // ── Step 1: Check for httpOnly cookie (returning wallet user)
        // We can't read the cookie from JS (it's httpOnly), so we probe
        // the server with a lightweight call to check if we're authenticated.
        if (supabase) {
          try {
            const probeRes = await fetchWithTimeout("/api/user/profile", {
              headers: { "x-probe": "1" },
            });
            if (probeRes.ok) {
              const probeData = await probeRes.json();
              if (probeData?.user) {
                setUnifiedProfile(probeData.user, null);
                return; // Happy path: valid cookie + user exists
              }
            }
          } catch {
            // Probe failed or timed out — fall through to re-authenticate
          }

          // Clean up legacy localStorage token if present
          if (typeof window !== "undefined") {
            localStorage.removeItem(WALLET_TOKEN_KEY);
          }
        }

        // ── Step 2: User exists but no valid JWT → must re-authenticate
        // Don't short-circuit here — fall through to Step 3 to get a fresh JWT.
        // Without a JWT, API calls will fail with 401.

        // ── Step 3: Authenticate via MetaMask signature → get fresh JWT
        signInAttemptRef.current = true;

        try {
          const nonceRes = await fetch(
            `/api/auth/nonce?address=${encodeURIComponent(addrLower)}`
          );
          if (!nonceRes.ok) {
            throw new Error("Failed to get nonce");
          }
          const { message } = await nonceRes.json();

          const signature = await signMessageAsync({ message });

          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: addrLower, message, signature }),
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            console.error("[AUTH] /api/auth/login failed:", errJson);
            throw new Error(errJson.error || "Auth failed");
          }

          const json = await res.json();
          const userRow = json.user;

          // Wallet JWT is now set as httpOnly cookie by the server.
          // Clean up legacy localStorage token if present.
          if (typeof window !== "undefined") {
            localStorage.removeItem(WALLET_TOKEN_KEY);
          }

          if (userRow) {
            setUnifiedProfile(userRow, null);
          }
        } catch (err: any) {
          if (err.code !== "ACTION_REJECTED") {
            console.error("Sign-in error:", err);
          }
        } finally {
          setTimeout(() => {
            signInAttemptRef.current = false;
          }, 3000);
        }
      } catch (err) {
        console.error("[AUTH] unexpected error in wallet login flow:", err);
      }
    };

    run();
  }, [supabase, isConnected, address, profile, isLoading, signMessageAsync]);

  // ─── Public API ──────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) {
        console.error("[AUTH] signInWithOAuth error:", error.message);
      }
    } catch (err) {
      console.error("[AUTH] signInWithOAuth threw:", err);
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    authEpochRef.current++;
    oauthRequestRef.current = null;
    setAuthError(null);
    sessionStorage.removeItem("googleLinkingProof");
    if (!supabase) return;
    await supabase.auth.signOut();
    // Clear httpOnly wallet JWT cookie via server endpoint
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Logout endpoint unavailable — cookie will expire naturally
    }
    // Clean up legacy localStorage token if present
    if (typeof window !== "undefined") {
      localStorage.removeItem(WALLET_TOKEN_KEY);
    }
    // Clear vault DEKs from memory (safe to call even if no vault exists)
    try {
      const { clearAllKeys } = await import("@/lib/vault");
      clearAllKeys();
    } catch {
      // Vault module may not be loaded — ignore
    }
    setProfile(null);
    setNeedsOnboarding(false);
  }, [supabase]);

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      if (!profile) throw new Error("No profile to onboard");

      const token = await getAccessToken();
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: profile.id, ...data }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Onboarding failed");
      }

      const { user } = await res.json();
      setUnifiedProfile(user, profile.supabaseUser);
    },
    [profile, address, isConnected, ethBalance, getAccessToken]
  );

  const refreshProfile = useCallback(async () => {
    if (!profile) return;
    try {
      // Use the API route (admin client, works for both Google + wallet users).
      // Wallet users authenticate via httpOnly cookie sent automatically.
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token && token !== "cookie") {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/user/profile", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setUnifiedProfile(data.user, profile.supabaseUser);
          return;
        }
      }
    } catch {
      // Silent fail — profile stays as-is
    }
  }, [profile, getAccessToken]);

  const contextValue: AuthContextType = {
    profile,
    isLoading,
    needsOnboarding,
    getAccessToken,
    signInWithGoogle,
    signOut,
    completeOnboarding,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {authError && <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{authError} <button type="button" onClick={() => void signOut()} className="ml-2 underline">Sign out to verify your wallet</button></div>}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
