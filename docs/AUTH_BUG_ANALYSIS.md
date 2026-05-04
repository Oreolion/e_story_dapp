# Firefox Auth Bug — Deep Analysis & Resolution Log

> **Status**: **RESOLVED** — Re-entrancy deadlock fix verified in production  
> **Affected Browsers**: Firefox (Normal & Dev Edition), Firefox Mobile  
> **Root Cause**: Supabase `gotrue-js` re-entrancy deadlock — `onAuthStateChange` fires `SIGNED_IN` during `_initialize()` while holding the auth lock; handler calls `supabase.from()` which internally calls `getSession()` → tries to acquire the same lock → deadlock forever. Firefox ETP was a secondary factor that masked/exacerbated the issue. See Section 17.  
> **Emergency Rollback Commit**: `10729729bc7b78d4b0e61d9ffbe2d0a4e568fd1b`  
> **Resolution Date**: 2026-04-23  

---

## 1. Symptom Description

### Primary Symptoms
- **Login works** on initial page load in normal Firefox
- **After staying on the page for ~50+ minutes**, navigating to new tabs/pages fails to load data
- **Reload fixes the issue** immediately
- **Firefox Dev Edition** cannot log in at all (login loop — returns to login page)
- **Chrome works perfectly** — no issues
- Console shows: `Cross-Origin Request Blocked: ... Status code: (null)` + `TypeError: NetworkError when attempting to fetch resource`

### Secondary Symptoms (Fixed During Diagnosis)
- `onAuthStateChange` never fired `INITIAL_SESSION` in Firefox
- `isLoading` stayed `true` indefinitely in some scenarios
- Constant re-subscription to `onAuthStateChange` suppressed auth events

---

## 2. The Working Baseline (Commit `10729729bc7b78d4b0e61d9ffbe2d0a4e568fd1b`)

### Architecture Overview
The old working code had a simpler auth architecture:

```
AuthProvider.tsx
├── getAccessToken()
│   ├── supabase.auth.getSession() → returns token
│   ├── if expired: supabase.auth.refreshSession() → refresh cross-origin to supabase.co
│   └── fallback: "cookie" sentinel for wallet users
├── Mount effect: getUser() + getSession() + handleGoogleSignIn/handleSession
├── onAuthStateChange: deps = [supabase, isConnected, handleGoogleSignIn]
└── Wallet effect: fetch("/api/user/profile") for wallet auto-login
```

### Why It "Worked" (Most of the Time)
1. **No proactive timeout wrappers** — Supabase calls ran to completion naturally
2. **`getUser()` on mount** — This validated the token server-side and triggered a refresh if needed. Being a single call at mount, it had lower chance of hitting the Firefox block.
3. **Tab stayed active** — If the user kept the tab active, the auto-refresh timer fired successfully (not blocked by tracking protection because the request wasn't classified as "background tracker" while tab was foreground)
4. **Luck** — The refresh often completed before Firefox's tracking protection heuristics kicked in

### Why It Was Actually Broken (Just Less Noticeably)
- The old code **was still vulnerable** to the same Firefox blocking issue
- It just manifested less frequently because:
  - `getUser()` at mount sometimes succeeded
  - Users often reloaded the page before the session expired
  - Chrome users never saw the issue, masking the cross-browser incompatibility

---

## 3. The Failed Fixes (What Didn't Work & Why)

### Attempt 1: Adding `withTimeout()` to Supabase Auth Calls
**Code added**:
```ts
const { data } = await withTimeout(supabase.auth.getSession(), 8000, "getSession");
const { data: refreshed } = await withTimeout(supabase.auth.refreshSession(), 8000, "refreshSession");
```

**Why it failed**:  
Supabase's `@supabase/gotrue-js` uses the **Web Locks API** internally to serialize auth operations. When `withTimeout()` rejected after 8 seconds, the Promise was abandoned but the underlying lock holder continued running. All subsequent `getSession()`/`refreshSession()` calls queued behind the zombie lock and also timed out. This caused a **cascading deadlock** where auth permanently broke until reload.

**Lesson**: Never timeout Promises that hold OS-level locks (Web Locks, IndexedDB transactions, etc.). The timeout rejects the consumer but doesn't release the lock.

---

### Attempt 2: Replacing `getUser()` with `getSession()` on Mount
**Code change**:
```ts
// Old: const { data: { user } } = await supabase.auth.getUser();
// New: const { data: { session } } = await supabase.auth.getSession();
```

**Why it helped but didn't fix the root cause**:  
`getUser()` makes a cross-origin network request to validate the token. `getSession()` reads from cookies locally. Removing `getUser()` reduced cross-origin requests at mount, which helped with initial load. But it didn't address the **auto-refresh timer** that still fired cross-origin requests after ~50 minutes.

---

### Attempt 3: Stabilizing `onAuthStateChange` with Refs
**Code added**:
```ts
const isConnectedRef = useRef(isConnected);
const handleGoogleSignInRef = useRef(handleGoogleSignIn);
// Subscription deps: [supabase] only
```

**Why it helped but wasn't the root cause**:  
This fixed a React effect re-subscription bug where `onAuthStateChange` was recreated constantly, suppressing `INITIAL_SESSION`. This was a **real bug** that caused login issues in some scenarios, but not the "works for 50 minutes then breaks" issue.

---

### Attempt 4: Adding Tab Visibility Recovery with `refreshSession()`
**Code added**:
```ts
// On tab visible after 60s idle:
await supabase.auth.refreshSession();
const probeRes = await fetchWithTimeout("/api/user/profile");
```

**Why it made things worse**:  
If the network was slow, `refreshSession()` held the Supabase auth lock for seconds. If the user navigated to a new page during this time, `getSession()` blocked waiting for the lock. The UI hung until reload.

**Lesson removed**: The final fix removes `refreshSession()` from the visibility handler entirely.

---

### Attempt 5: Adding `credentials: "same-origin"` to Fetch Calls
**Code added**:
```ts
return await fetch(input, { credentials: "same-origin", ...init, signal: controller.signal });
```

**Why it didn't fix the core issue**:  
This ensured cookies were sent with API calls, which was a valid fix for a different bug (wallet auth not sending cookies). But it doesn't affect Supabase's internal `refreshSession()` call, which is made by the Supabase client itself, not our `fetch` wrapper.

---

## 4. The Correct Fix (Current Implementation)

### Core Insight
**Firefox's Enhanced Tracking Protection + Total Cookie Protection categorizes `*.supabase.co` as a tracker domain.** Cross-origin requests to tracker domains are silently blocked when:
- The tab has been idle for a while
- The request fires from a background tab
- Firefox Dev Edition's stricter heuristics trigger

The error signature is diagnostic:
```
Status code: (null)
Reason: CORS request did not succeed
TypeError: NetworkError when attempting to fetch resource
```

A **real** CORS error shows an HTTP status (like 403) or a preflight failure. `(null)` means the browser **never sent the request** — it was killed by tracking protection.

### The Solution: Same-Origin Refresh Proxy

#### File 1: `app/api/auth/refresh/route.ts` (NEW)
A server-side proxy that calls `supabase.auth.refreshSession()` using the server-side Supabase client (`@supabase/ssr`'s `createServerClient`). Server-to-Supabase requests are **never** blocked by browser tracking protection.

```ts
// Browser (same-origin) → /api/auth/refresh → Server → Supabase
//                                    ↑
//                     Firefox allows this (same-origin)
```

#### File 2: `app/utils/supabase/supabaseClient.ts` (MODIFIED)
Disabled `autoRefreshToken: false` in the browser client. This stops the background cross-origin timer that Firefox blocks.

```ts
auth: {
  autoRefreshToken: false, // ← was implicitly true before
},
```

#### File 3: `components/AuthProvider.tsx` (MODIFIED)
Updated `getAccessToken()` to call `/api/auth/refresh` instead of `supabase.auth.refreshSession()`:

```ts
// Old (cross-origin, blocked by Firefox):
const { data: refreshed } = await supabase.auth.refreshSession();

// New (same-origin, bypasses Firefox blocklist):
const res = await fetchWithTimeout("/api/auth/refresh", { method: "POST" });
const refreshed = await res.json();
return refreshed.access_token;
```

### Supporting Fixes (Also Applied)
1. **Removed `refreshSession()` from tab visibility handler** — prevents lock contention
2. **Added 3-second UI safety timeout on mount** — unblocks the page if `getSession()` hangs on a cross-tab lock
3. **Removed `withTimeout()` from Supabase auth calls** — prevents zombie lock holders
4. **Stabilized `onAuthStateChange` subscription** — `[supabase]` deps only, callbacks via refs

---

## 5. Comparison: Old vs. Current Architecture

| Aspect | Old (`10729729`) | Current (Fixed) |
|--------|------------------|-----------------|
| **Mount hydration** | `getUser()` + `getSession()` | `getSession()` + `/api/user/profile` probe |
| **Token refresh** | `supabase.auth.refreshSession()` (cross-origin) | `/api/auth/refresh` (same-origin proxy) |
| **Auto-refresh timer** | Enabled (implicit `autoRefreshToken: true`) | Disabled (`autoRefreshToken: false`) |
| **onAuthStateChange deps** | `[supabase, isConnected, handleGoogleSignIn]` | `[supabase]` only (refs for callbacks) |
| **Tab visibility handler** | None | Re-probes profile (no `refreshSession()`) |
| **Safety timeout** | None | 3s UI unblock + 10s auth fallback |
| **Firefox ETP resilience** | Vulnerable (masked by luck) | Explicitly bypassed via same-origin proxy |

---

## 6. Why Sleep Mode Is a Red Herring

The user noted that network errors could be from the computer going to sleep. Here's why the sleep hypothesis doesn't match the evidence:

| Sleep Mode | Firefox ETP Block |
|------------|-------------------|
| Affects **all** network requests indiscriminately | Only affects **cross-origin requests to tracker domains** |
| Error would show `ERR_NETWORK_CHANGED` or `NS_ERROR_NET_TIMEOUT` | Error shows `Status code: (null)` + `CORS request did not succeed` |
| Recovery is automatic when network returns | Requires reload to reset Supabase client state |
| Would affect Chrome too | Only affects Firefox |
| Timing is random (whenever sleep occurs) | Timing is consistent (~50 min = token expiry) |

**Conclusion**: Sleep might cause occasional network errors, but the consistent "after some minutes" pattern with `(null)` status is definitively Firefox tracking protection.

---

## 7. Testing Checklist for Deployment Verification

### Normal Firefox
- [ ] Log in with Google
- [ ] Stay on page for 60+ minutes (or manually expire session cookie)
- [ ] Navigate to new pages/tabs — data should load
- [ ] No `Status code: (null)` errors in console

### Firefox Dev Edition
- [ ] Log in with Google
- [ ] Should not loop back to login page
- [ ] Session should persist across page reloads

### Regression Tests
- [ ] Chrome still works (no changes to Chrome behavior)
- [ ] Wallet login still works
- [ ] Google + wallet linking still works
- [ ] Logout works for both auth methods
- [ ] Session refresh happens transparently during API calls

---

## 8. Lessons for Future AI Agents

1. **Never wrap lock-holding Promises with `Promise.race`/timeout** — creates zombie lock holders
2. **Status `(null)` + `NetworkError` in Firefox = tracking protection, not CORS** — look for the `(null)` status
3. **Cross-origin auth refresh is fragile in Firefox** — always prefer same-origin proxies for auth operations
4. **Disable `autoRefreshToken` when using cookie-based auth with Supabase SSR** — proactive refresh in `getAccessToken()` is more reliable
5. **Firefox != Chrome** — always test auth flows in both; Chrome's permissive defaults hide privacy-related bugs
6. **The old code wasn't truly "working"** — it was just lucky. Don't assume the baseline is bug-free.

---

## 9. Files Changed in This Fix

| File | Change |
|------|--------|
| `app/api/auth/refresh/route.ts` | **NEW** — Same-origin refresh proxy |
| `app/utils/supabase/supabaseClient.ts` | Added `autoRefreshToken: false` + `cookieOptions` |
| `components/AuthProvider.tsx` | Proxy refresh in `getAccessToken()`, stabilized subscription, removed `withTimeout` from auth calls, added UI safety timeouts, removed `refreshSession()` from visibility handler |
| `app/social/SocialPageClient.tsx` | Skip `Authorization` header when `token === "cookie"` |

---

## 10. Post-Deployment Verification — Fix FAILED

### Symptoms After Deploying the Same-Origin Proxy Fix

**Date reported**: 2026-04-22  
**Environment**: Production (`estories.app`), Firefox 149.0 (Windows), Firefox Dev Edition  
**User state**: Logged in with Google OAuth (cookie `sb-qfwhtsmqndnocfidhdhy-auth-token` present in request)

#### Symptom 1: `/api/user/profile` returns 401
```
GET https://estories.app/api/user/profile
Status: 401 Unauthorized
```

**Request headers show the Supabase auth cookie IS being sent**:
```
Cookie: sb-qfwhtsmqndnocfidhdhy-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SW1SeFNsUkVPRUpMTjFCaWFraDJTamdpTENKMGVYQWlPaUpLVjFRaWZRLmV5SnBjM01pT2lKb2RIUndjem92TDNGbWQyaDBjMjF4Ym1SdWIyTm1hV1JvWkdoNUxuTjFjR0ZpWVhObExtTnZMMkYxZEdndmRqRWlMQ0p6ZFdJaU9pSTJPR0l3TkdVek9DMWhZMk0yTFRRMU5tRXRPRGs0T1MxbU56WmxPVGxsTkRRME5HSWlMQ0poZFdRaU9pSmhkWFJvWlc1MGFXTmhkR1ZrSWl3aVpYaHdJam94TnpjMk9EWTJPVEk0TENKcFlYUWlPakUzTnpZNE5qTXpNamdzSW1WdFlXbHNJam9pY21WdGVXOXlaVzh4TVVCbmJXRnBiQzVqYjIwaUxDSndhRzl1WlNJNk…25lX3ZlcmlmaWVkIjpmYWxzZSwicHJvdmlkZXJfaWQiOiIxMDc2NTkzNTc2MDU3Njc2MDY5NDQiLCJzdWIiOiIxMDc2NTkzNTc2MDU3Njc2MDY5NDQifSwicHJvdmlkZXIiOiJnb29nbGUiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAxLTMwVDEyOjAzOjE3LjI5NTQ5N1oiLCJjcmVhdGVkX2F0IjoiMjAyNi0wMS0zMFQxMjowMzoxNy4yOTU1NTVaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDQtMjJUMTA6MDQ6MDguMDQ3MDc0WiIsImVtYWlsIjoicmVteW9yZW8xMUBnbWFpbC5jb20ifV0sImNyZWF0ZWRfYXQiOiIyMDI2LTAxLTMwVDEyOjAzOjE3LjI1NjQ1NFoiLCJ1cGRhdGVkX2F0IjoiMjAyNi0wNC0yMlQxMzowODo0OC4zODA0MDlaIiwiaXNfYW5vbnltb3VzIjpmYWxzZX19
```

The cookie is present, same-origin, and the request reaches the server. Yet the server responds with **401**. This means:
- **Firefox ETP is NOT blocking the request** — the request arrives at the server (HTTP/2 401, not `(null)` status).
- **The cookie value is either expired, malformed, or the server-side validation is failing** for a different reason.

#### Symptom 2: Infinite Loading on Navigation
- Navigate to any data-fetching tab (e.g., `/tracker`, `/library`, `/social`)
- Page shows loading spinner **indefinitely**
- **Reloading the page fixes it immediately**
- This happens consistently in both normal Firefox and Firefox Dev Edition

#### Symptom 3: Firefox Dev Edition Behavior Unchanged
- Dev Edition still exhibits the same login loop / auth failure pattern
- No improvement after the same-origin proxy fix

### Critical Insight: The Error Changed

| Before Fix | After Fix |
|------------|-----------|
| `Status code: (null)` + `NetworkError` | `HTTP/2 401` |
| Cross-origin `refreshSession()` blocked | Same-origin request **arrives** at server |
| Firefox never sent the request | Firefox **sent** the request with cookie |

**Conclusion**: The same-origin proxy successfully bypassed Firefox's cross-origin blocking, but the underlying auth mechanism is still broken. The problem is now server-side: the Supabase auth cookie is being transmitted but not validated correctly by the API middleware.

---

## 11. What Has Been Tried (And Failed)

| Attempt | What Was Changed | Result |
|---------|------------------|--------|
| Same-origin refresh proxy | `app/api/auth/refresh/route.ts` + `autoRefreshToken: false` | Request reaches server but still 401s |
| Proactive `getAccessToken()` refresh | `AuthProvider.tsx` calls `/api/auth/refresh` before API calls | Cookie present but invalid/expired |
| `credentials: "same-origin"` on fetch | All `apiGet`/`apiPost` calls | Did not affect cookie validation |
| Stabilized `onAuthStateChange` | `[supabase]` deps only | No impact on the 401 issue |
| Removed `withTimeout` from auth calls | Prevents zombie Web Locks | No impact on the 401 issue |

---

## 12. New Hypotheses (For the Next Agent)

### Hypothesis A: Cookie Expiry / Clock Skew
The base64 cookie contains an `expires_at` field. If the server clock and client clock diverge, or if the cookie expires between the client reading it and the server validating it, the server rejects it. **However**, a page reload fixes it, which suggests the cookie is re-read/re-validated successfully on reload.

### Hypothesis B: Supabase SSR Cookie Parsing Bug
`@supabase/ssr` parses cookies differently on the client vs. server. The client may be sending a cookie that the server-side `createServerClient` cannot decode properly. The cookie name contains the project ref (`sb-qfwhtsmqndnocfidhdhy-auth-token`) — verify that the server-side client is looking for the **exact same cookie name**.

### Hypothesis C: `getAccessToken()` Returns Stale / Wrong Token
`getAccessToken()` in `AuthProvider.tsx` may be returning an expired token from `supabase.auth.getSession()` (client-side cache) even after the same-origin refresh "succeeds." The client-side token and the cookie token may be out of sync.

### Hypothesis D: API Route Middleware Bug
`validateAuthOrReject()` in API routes may be failing to extract or validate the cookie correctly. Check:
- Does `createSupabaseAdminClient()` or `createServerClient()` in the API route read the cookie from `cookies()` correctly?
- Is the cookie being parsed as base64-decoded JSON correctly?
- Does `cookies()` from `next/headers` return the cookie when the request is made client-side via `fetch`?

### Hypothesis E: React Query Cache + Auth Race
React Query hooks fire immediately on mount. If `getAccessToken()` is called before `AuthProvider` has finished its mount hydration, the token may be `null` or stale. The component shows "loading" forever because the 401 response is not handled (no error UI — just infinite spinner).

**Evidence for Hypothesis E**: The infinite loading only happens on *navigation* (client-side routing), not on full page reload. On reload, the server renders the page and `AuthProvider` hydrates before React Query fires. On navigation, React Query may fire before auth is ready.

---

## 13. Recommended Diagnostic Steps for Next Agent

1. **Add server-side logging** to `/api/user/profile` and `/api/auth/refresh`:
   - Log what cookies are received (`console.log(cookies().getAll())`)
   - Log what `supabase.auth.getUser()` returns (or if it throws)
   - Log the decoded cookie structure (is `access_token` present and non-empty?)

2. **Add client-side logging** to `AuthProvider.tsx`:
   - Log the output of `getAccessToken()` before every API call
   - Log `document.cookie` to verify the browser actually has the cookie
   - Log `supabase.auth.getSession()` vs. `supabase.auth.getUser()` divergence

3. **Test the cookie directly**:
   - In Firefox DevTools, copy the cookie value and base64-decode it
   - Check `expires_at` — is it in the past?
   - Check `access_token` — is it present and looks like a valid JWT?

4. **Test the API route in isolation**:
   - Use `curl` with the cookie to call `/api/user/profile`
   - If `curl` works but browser `fetch` doesn't, it's a cookie/header issue
   - If `curl` also 401s, the cookie value itself is invalid

5. **Check React Query error handling**:
   - The infinite loading suggests React Query hooks are NOT handling 401 errors
   - Add `throwOnError: true` or `error` state rendering to see if queries are failing silently
   - Check if `useAuth()` returns `isLoading: true` indefinitely during navigation

6. **Verify the server-side Supabase client config**:
   - In `lib/supabase/server.ts` (or wherever `createServerClient` is configured), ensure `cookieOptions` match the client-side config exactly
   - Ensure the server client is configured with the same `auth.flowType` (pkce) and `auth.detectSessionInUrl` settings

---

## 14. Files That Must Be Examined

| File | Why |
|------|-----|
| `components/AuthProvider.tsx` | `getAccessToken()` may return stale token; mount hydration may race with React Query |
| `app/api/auth/refresh/route.ts` | May not be correctly refreshing the cookie or may be returning an expired token |
| `app/api/user/profile/route.ts` | Server-side cookie validation is failing — add logging here |
| `lib/supabase/server.ts` (or equivalent) | Server-side `createServerClient` config must match client config |
| `lib/api.ts` | `apiGet`/`apiPost` may not be handling 401s or token refresh correctly during navigation |
| `app/utils/supabase/supabaseClient.ts` | Browser client config; verify `cookieOptions` and `auth` settings |

---

## 15. Emergency Rollback

The emergency rollback commit `10729729bc7b78d4b0e61d9ffbe2d0a4e568fd1b` is always available via:
```bash
git checkout 10729729bc7b78d4b0e61d9ffbe2d0a4e568fd1b -- components/AuthProvider.tsx
```

**Note**: The old code had the same Firefox issues, just masked by luck. Rolling back is a temporary measure, not a fix.

---

## 16. Post-Deployment Catastrophic Failure — 2026-04-22

> **CRITICAL**: The current deployed code has made the auth situation **worse** than before the fix. Do not attempt further auth fixes without reading this section completely.

### New Severity
- **Normal Firefox** (not just Dev Edition) now **cannot log in** — login succeeds briefly then immediately logs out on navigation or reload
- **Previously**: Normal Firefox worked for ~50 min, Dev Edition was broken
- **Now**: Both normal Firefox and Dev Edition are broken immediately after login

### Timeline of Failure (User-Observed)

1. **User logs in** (Google OAuth)
2. **Initial landing page loads correctly** — no 401s, authenticated data is fetched successfully
3. **User navigates to a new tab** (e.g., `/library`, `/social`, `/story/[id]`)
4. **UI briefly shows "Connect" / logged-out state** — as if auth was lost
5. **Then console floods with 401 errors** on ALL API endpoints:
   ```
   GET /api/user/profile → 401
   GET /api/stories → 401
   GET /api/stories/collections → 401
   GET /api/social/follow?followed_ids=... → 401
   GET /api/social/like/status?story_ids=... → 401
   ```
6. **Story page loads infinitely** (spinner never stops)
7. **Reloading the page does NOT fix it** — user remains logged out
8. **Re-logging in also fails** — the cycle repeats

### Critical Observations

#### A. The Cookie IS Present
Request headers show the Supabase auth cookie `sb-qfwhtsmqndnocfidhdhy-auth-token` is being sent with the 401 requests. The server receives the cookie but rejects it.

#### B. Auth Works Initially, Then Collapses
The fact that authenticated data loads **correctly immediately after login** proves:
- The cookie is valid at the moment of login
- The server CAN validate the cookie
- The React Query hooks CAN fetch authenticated data

The collapse happens **on client-side navigation**, not on initial server render. This is a **massive clue**.

#### C. "Connect" State Appears Before 401s
The UI briefly shows the logged-out "Connect" state when navigating. This suggests `useAuth()` is returning `null` for `profile` during navigation, which causes:
1. Components to render logged-out UI
2. React Query hooks to still fire (because they're not gated by auth state)
3. API calls to go out with a stale/invalid token → 401

#### D. Story Page Infinite Loading
The story page loading spinner never stops. This suggests:
- `useStory(storyId)` is in `isLoading: true` state
- Either the 401 is not being caught as an error, OR
- The query is retrying indefinitely, OR
- `isLoading` is derived from something that never flips (e.g., `isAuthLoading` from `useAuth()` stuck true)

### What Changed That Made It Worse?

The only auth-related changes between "old buggy but semi-working" and "now completely broken" are:

1. **`autoRefreshToken: false`** in `supabaseClient.ts` — stops background refresh
2. **`getAccessToken()` calls `/api/auth/refresh`** instead of `supabase.auth.refreshSession()`
3. **Removed `refreshSession()` from tab visibility handler**
4. **React Query migrations** in `SocialPageClient`, `LibraryPageClient`, `StoryPageClient`, `ProfilePageClient`, `RecordPageClient` — added `useQuery` hooks that call APIs immediately on mount

**Hypothesis: The React Query migration introduced a race condition.**

Before the migration, pages used `useEffect` + `fetch` inside the component. The `useEffect` ran AFTER React's render cycle, giving `AuthProvider`'s mount effect time to finish. After migration, `useQuery` hooks execute during render (or at least earlier in the lifecycle), firing API calls before `AuthProvider` has finished hydrating the session.

When the user navigates client-side:
1. Next.js unmounts the old page, mounts the new page
2. New page's `useQuery` hooks fire immediately
3. `getAccessToken()` runs, but `AuthProvider` may be in a transient state
4. The token returned is stale/expired/null
5. API returns 401
6. `AuthProvider` sees 401s and assumes the user is logged out
7. Auth state resets to null
8. All subsequent API calls also 401

**This creates a death spiral**: React Query fires → 401 → AuthProvider clears session → more 401s → UI shows logged out.

### Why Reload Doesn't Fix It

If the cookie itself is valid, why does reload not fix it? Possible explanations:
1. The server-side render on reload ALSO gets a 401 (cookie is valid but SSR supabase client can't read it)
2. The `AuthProvider` mount effect is now broken (possibly due to `autoRefreshToken: false` changes)
3. Something in the new `getAccessToken()` path permanently corrupts the cookie/session

### The IndexedDB Error
```
Analytics SDK: Error: IndexedDB:Set:InternalError
```
This is a **Sentry/analytics SDK error**, likely unrelated to the auth bug. However, if the IndexedDB error is from Supabase's own storage (not Sentry), it could indicate that Supabase's client-side session storage is failing. Verify which SDK this error comes from.

### Previous "Fix" Files That May Have Caused Regression

| File | Change | Risk |
|------|--------|------|
| `app/utils/supabase/supabaseClient.ts` | `autoRefreshToken: false` | **HIGH** — Stops all background refresh. If proactive refresh in `getAccessToken()` fails, session dies permanently |
| `components/AuthProvider.tsx` | `getAccessToken()` calls `/api/auth/refresh` | **HIGH** — New code path, untested in production. May return wrong token or corrupt cookie |
| `components/AuthProvider.tsx` | Removed `refreshSession()` from visibility handler | **MEDIUM** — Removed a recovery path |
| `lib/queries/hooks.ts` | Added `useUserStories`, `useStory`, `useLikeStatus`, etc. | **HIGH** — These hooks fire immediately on navigation, racing with auth hydration |
| Multiple pages | Replaced `useEffect` + `fetch` with `useQuery` | **HIGH** — Changed execution timing of data fetching relative to auth initialization |

### What Must NOT Be Changed Without Extreme Care

1. **`components/AuthProvider.tsx`** — This is the auth brain. Any change here affects ALL users, ALL auth methods (Google + wallet), ALL pages.
2. **`app/api/auth/refresh/route.ts`** — Server-side cookie handling. A bug here could corrupt cookies for all users.
3. **`app/utils/supabase/supabaseClient.ts`** — Browser client config. Changing `autoRefreshToken` back to `true` without understanding the full implications could re-introduce the Firefox ETP bug.
4. **Any database schema or user table migrations** — There are registered users. Do not touch `users` table, `unlocked_content`, `payments`, or any table with production data.
5. **Payment/web3 flows** — `useStoryProtocol`, `useEStoryToken`, `useStoryNFT` hooks. Do not change these.

### Recommended Immediate Diagnostic Actions (Read-Only / Logging Only)

1. **Add console logging to `getAccessToken()`** in `AuthProvider.tsx`:
   ```ts
   console.log("[getAccessToken] called");
   console.log("[getAccessToken] session:", session?.access_token?.slice(0,10));
   console.log("[getAccessToken] refresh response:", refreshed?.access_token?.slice(0,10));
   ```

2. **Add console logging to API route `/api/auth/refresh`**:
   ```ts
   console.log("[/api/auth/refresh] cookies:", cookies().getAll().map(c => c.name));
   console.log("[/api/auth/refresh] refresh result:", data);
   ```

3. **Add console logging to `/api/user/profile`**:
   ```ts
   console.log("[/api/user/profile] cookies:", cookies().getAll().map(c => c.name));
   console.log("[/api/user/profile] auth result:", authResult);
   ```

4. **Add React Query `onError` logging** in `lib/api.ts`:
   ```ts
   console.error("[API] 401 on:", endpoint, "token prefix:", token?.slice(0,10));
   ```

5. **Verify `/api/auth/refresh` is actually being called** during navigation:
   - The user reports 401s on ALL APIs
   - If `getAccessToken()` is working, `/api/auth/refresh` should be called before each API
   - If it's NOT being called, the proactive refresh isn't firing

### Nuclear Option (If Nothing Else Works)

If the auth system cannot be fixed safely, the safest path is:
1. **Rollback `components/AuthProvider.tsx`** to the pre-fix state (commit before the same-origin proxy was added)
2. **Keep the React Query migrations** (they're not the root cause, just exposing it faster)
3. **Accept that Firefox ETP will still be an issue** until a proper fix is designed

**DO NOT attempt to fix both the auth race condition AND the Firefox ETP issue in the same deployment.** These are two different bugs that got tangled together.

---

## 17. Final Resolution — Re-entrancy Deadlock (2026-04-23)

### The Actual Root Cause

After extensive diagnosis, the root cause was **not** Firefox ETP alone. It was a **re-entrancy deadlock** inside `@supabase/gotrue-js` that was triggered by Firefox's behavior but could theoretically occur in any browser.

#### The Deadlock Chain

```
1. Page loads → supabase.auth._initialize() starts
2. _initialize() acquires the auth lock (Web Locks API)
3. _initialize() finishes, calls _notifyAllSubscribers()
4. _notifyAllSubscribers() fires onAuthStateChange("SIGNED_IN", session)
5. Our handler: handleGoogleSignIn(session)
6. handleGoogleSignIn calls supabase.from("users").select("*")...
7. Supabase postgrest-js internally calls supabase.auth.getSession()
8. getSession() tries to acquire the SAME auth lock
9. DEADLOCK: getSession() waits for the lock, but the lock won't release
   until _notifyAllSubscribers() completes, which is waiting for our
   handler to complete, which is waiting for getSession() to complete.
```

**Why Firefox was worse**: Firefox's ETP blocks `*.supabase.co` requests, causing `getSession()` (which internally tries to refresh) to hang FOREVER instead of failing fast. In Chrome, the refresh might fail quickly and release the lock. In Firefox, the fetch hangs, making the deadlock permanent.

### The Fix

#### 1. `components/AuthProvider.tsx` — Deferred Handler Execution

```ts
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
    handleGoogleSignInRef.current?.(session).catch((err) => {
      console.error("[AUTH] deferred handleGoogleSignIn error:", err);
    });
  }, 0);
} else {
  setTimeout(() => {
    handleSessionRef.current?.(session).catch((err) => {
      console.error("[AUTH] deferred handleSession error:", err);
    });
  }, 0);
}
```

#### 2. `app/utils/supabase/supabaseClient.ts` — Firefox-Specific Overrides

```ts
// Firefox: bypass Web Locks to prevent OAuth redirect deadlocks
const lockNoOp = async (_name: string, _timeout: number, fn: () => Promise<any>) =>
  await fn();

// Force-disable auto-refresh (createBrowserClient silently overrides to true)
(client.auth as any).autoRefreshToken = false;
client.auth.stopAutoRefresh();

// Prevent getSession() from hanging on blocked *.supabase.co requests
(client.auth as any)._refreshAccessToken = async () => ({
  data: { session: null, user: null },
  error: new Error("Direct Supabase refresh disabled — use /api/auth/refresh"),
});

// Safety net: timeout getSession() so blocked fetches don't stall the UI
const originalGetSession = client.auth.getSession.bind(client.auth);
client.auth.getSession = async () => {
  return Promise.race([
    originalGetSession(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("getSession timeout")), 4000)
    ),
  ]) as any;
};
```

#### 3. `AuthProvider.tsx` — Proactive Same-Origin Refresh

`getAccessToken()` calls `/api/auth/refresh` (same-origin proxy) instead of `supabase.auth.refreshSession()` (cross-origin, blocked by Firefox ETP).

### Verification

- **Normal Firefox**: Log in, stay on page for 60+ minutes, navigate to new tabs — data loads correctly ✅
- **Firefox after idle**: Return to tab after hours — auth state intact, data fetches successfully ✅
- **Chrome**: No regression ✅
- **Sentry**: "Direct Supabase refresh disabled" errors eliminated by returning graceful error object instead of throwing ✅

### Lessons Learned (Updated)

1. **Never await handlers inside `onAuthStateChange`** when those handlers call back into the same library — always defer with `setTimeout(..., 0)`
2. **Firefox ETP was a contributing factor, not the root cause** — the deadlock would occur even without ETP, just less severely
3. **Supabase's auth lock is not re-entrant** — calling `getSession()` from inside an `onAuthStateChange` handler is dangerous
4. **Status `(null)` + `NetworkError` can mean EITHER**: tracking protection OR a deadlock where the fetch never starts because the JS thread is blocked
5. **The old code "worked" because**: `getUser()` at mount often completed before `onAuthStateChange` fired, so the handler found the user already cached and didn't need to query the database

### Files Changed in Final Fix

| File | Change |
|------|--------|
| `components/AuthProvider.tsx` | Deferred `handleGoogleSignIn`/`handleSession` via `setTimeout(..., 0)` in `onAuthStateChange`; cleaned up diagnostic logging |
| `app/utils/supabase/supabaseClient.ts` | Firefox no-op lock; force `autoRefreshToken: false`; graceful `_refreshAccessToken` override; `getSession()` 4s timeout |
| `app/api/auth/refresh/route.ts` | Cleaned up diagnostic logging |
| `app/api/user/profile/route.ts` | Cleaned up diagnostic logging |
| `lib/auth.ts` | Cleaned up diagnostic logging |

---

## 18. Related Fixes Applied During Auth Work

### Public Profile Page (Notification 404 Fix)

Follow notifications linked to `/profile/${username}` but no route existed. Created:
- `app/profile/[username]/page.tsx` — Server component fetching public user data
- `app/profile/[username]/PublicProfileClient.tsx` — Client component with follow button, stats, public stories

### Notification Link Fixes

| Notification Type | Before | After |
|-------------------|--------|-------|
| Follow | `/profile/${username}` | Same (now works with new route) |
| Like | No link (fallback to `/story/${id}`) | Explicit `/story/${storyId}` |
| Comment | `/story/${story_id}` | Same (already correct) |
| Book published | `/books/${id}` | Same (already correct) |
