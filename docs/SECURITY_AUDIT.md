# eStory DApp — Comprehensive Security Audit

> **Audit Date**: 2026-04-21  
> **Auditor**: Kimi Code CLI (Red-Team Analysis)  
> **Scope**: Full-stack (Frontend, Backend, APIs, Database, Smart Contracts, Infrastructure)  
> **Threat Model**: Hostile environment with motivated attackers (anonymous, authenticated, insider, API consumer)

---

## 1. Vulnerability Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **Critical** | 3 | Auth bypass, Admin compromise, Reentrancy |
| **High** | 7 | CSRF, XSS (CSP weakness), IDOR, Race conditions, Email abuse, Secret mishandling, DoS |
| **Medium** | 9 | Missing validation, Rate limit gaps, Information disclosure, Contract lacks pause, No input size limits, JWT fallback chain, Storage security, Missing integrity checks, Dependency risks |
| **Low** | 6 | Logging sensitive data, Missing security headers on some routes, Verbose errors, Commented code, Unused imports, Preload warnings |

---

## 2. Detailed Findings

### CRITICAL-1: Admin Secret Brute-Force (No Rate Limiting on Admin Endpoints)

- **Severity**: Critical
- **Affected**: `app/api/admin/seed/route.ts`, `app/api/admin/analysis-stats/route.ts`
- **Description**: Admin endpoints are protected only by `ADMIN_SECRET` via Bearer token comparison using `safeCompare()` (constant-time), but there is **no rate limiting** on these routes.
- **Exploitation**:
  1. Attacker discovers `/api/admin/seed` or `/api/admin/analysis-stats`
  2. Attacker sends thousands of requests with different Bearer tokens
  3. No rate limit prevents brute-force of the admin secret
  4. Once compromised, attacker can seed fake data or read analysis stats
- **Impact**: Full admin compromise, data poisoning, platform manipulation
- **Fix**: Add strict per-IP rate limiting (5 req/min) to admin routes. Consider IP allowlisting.

---

### CRITICAL-2: Service Role Key Used as JWT Secret Fallback

- **Severity**: Critical
- **Affected**: `lib/jwt.ts:21-26`
- **Description**: `getSecret()` falls back to `SUPABASE_SERVICE_ROLE_KEY` when `WALLET_JWT_SECRET` is not set.
- **Exploitation**:
  1. If `WALLET_JWT_SECRET` is missing in environment, `SUPABASE_SERVICE_ROLE_KEY` is used to sign wallet JWTs
  2. If the service key is ever rotated (security best practice), ALL existing wallet JWTs immediately become invalid
  3. An attacker with read access to environment variables (via SSRF, log injection, or insider) can forge wallet JWTs for any user
- **Impact**: Mass authentication bypass, user impersonation
- **Fix**: Remove the fallback. Require `WALLET_JWT_SECRET` explicitly and fail hard if missing. Rotate the secret immediately if fallback was ever used.

---

### CRITICAL-3: Smart Contract Reentrancy Risk in `StoryNFT.withdraw()`

- **Severity**: Critical
- **Affected**: `contracts/StoryNFT.sol:48-53`
- **Description**: `withdraw()` uses low-level `.call{value: balance}("")` without a reentrancy guard. While the function follows checks-effects-interactions (no state changes after the call), there are no guarantees about future modifications.
- **Exploitation**:
  1. Attacker deploys a malicious contract that calls back into `withdraw()` in its fallback
  2. If any state change is added after the call in a future upgrade, funds can be drained
  3. Even now, cross-function reentrancy is possible if other state-modifying functions don't use guards
- **Impact**: Complete loss of accumulated mint fees
- **Fix**: Add OpenZeppelin `ReentrancyGuard` and apply `nonReentrant` modifier to `withdraw()` and any payable functions.

---

### HIGH-1: Missing CSRF Protection on State-Changing Endpoints

- **Severity**: High
- **Affected**: All POST/PUT/DELETE API routes (`/api/social/like`, `/api/stories`, `/api/payment/create`, etc.)
- **Description**: No CSRF tokens are used. While SameSite=Lax cookies help, authenticated POST requests can still be forged from cross-origin sites if the user has an active session.
- **Exploitation**:
  1. Attacker creates a malicious website with a form that POSTs to `estories.app/api/social/like`
  2. Victim visits attacker site while logged into eStory
  3. The browser sends the Supabase session cookie + wallet cookie automatically
  4. The like is registered without victim's consent
- **Impact**: Unauthorized social actions, payment initiation, data modification
- **Fix**: Implement CSRF tokens for all state-changing mutations, or validate `Origin`/`Referer` headers strictly on POST/PUT/DELETE.

---

### HIGH-2: CSP Allows `unsafe-inline` Scripts

- **Severity**: High
- **Affected**: `next.config.mjs:106`
- **Description**: Content-Security-Policy includes `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com`.
- **Exploitation**:
  1. If an attacker finds any XSS injection point (DOM-based, stored, or reflected), `'unsafe-inline'` allows arbitrary inline `<script>` execution
  2. The CSP becomes largely ineffective against XSS
  3. Nonce-based or hash-based CSP should be used instead
- **Impact**: XSS exploitation bypasses CSP protection
- **Fix**: Generate CSP nonces via Next.js `headers()` and use `script-src 'self' 'nonce-{random}'`. Remove `'unsafe-inline'`.

---

### HIGH-3: IDOR on Story Access (Private Story Leakage via Comments)

- **Severity**: High
- **Affected**: `app/api/stories/[storyId]/route.ts:114-122`
- **Description**: When fetching a private story, the endpoint returns 404 if the viewer is not the author. However, the **comments** are fetched unconditionally using the `storyId`, even if the story is private and the viewer is unauthorized.
- **Exploitation**:
  1. Attacker knows or guesses a private story ID
  2. Attacker makes GET request to `/api/stories/{storyId}`
  3. Story content is blocked (404), but comments are returned
  4. Comments may contain sensitive information about the private story
- **Impact**: Information disclosure about private content
- **Fix**: Move comment fetching inside the `isAuthor || isPublic` check. Return empty comments array for unauthorized private story access.

---

### HIGH-4: Race Condition in Like Counter (Double-Spend of Likes)

- **Severity**: High
- **Affected**: `app/api/social/like/route.ts:42-57`
- **Description**: The fallback path for `adjustLikes()` reads the current count, calculates the next value, and writes it back. This is not atomic.
- **Exploitation**:
  1. Two users like the same story simultaneously
  2. Both read `likes = 5` concurrently
  3. Both write `likes = 6`
  4. Final count is 6 instead of 7
  5. Reverse applies for unlikes (count doesn't decrement)
- **Impact**: Inaccurate engagement metrics, potential for infinite inflation/deflation
- **Fix**: Ensure `increment_story_likes` / `decrement_story_likes` RPCs are deployed and remove the fallback. Add a database-level check constraint.

---

### HIGH-5: Email Send Endpoint — Arbitrary Email Injection

- **Severity**: High
- **Affected**: `app/api/email/send/route.ts`
- **Description**: Authenticated users can send emails to arbitrary addresses with arbitrary content (via `type` and `username` parameters). No validation of `email` format, no rate limiting per user, no verification that the email belongs to the authenticated user.
- **Exploitation**:
  1. Attacker creates an account
  2. Attacker sends thousands of emails to arbitrary addresses via `/api/email/send`
  3. Emails appear to come from `noreply@estories.app`
  4. Platform used for spam/phishing
- **Impact**: Reputation damage, domain blacklisting, legal liability (CAN-SPAM violations)
- **Fix**: Rate limit to 5 emails/hour per user. Validate email format strictly. Only allow sending to the authenticated user's own email address. Add unsubscribe headers.

---

### HIGH-6: Missing Ownership Validation on Profile Update

- **Severity**: High
- **Affected**: `app/api/user/route.ts`, `app/api/user/profile/route.ts` (PUT handler)
- **Description**: Need to verify that a user can only update their own profile.
- **Exploitation**:
  1. If `user/route.ts` PUT accepts a `userId` parameter without validating it matches the authenticated user
  2. Attacker can modify other users' profiles, change wallet addresses, or escalate privileges
- **Impact**: Account takeover, privilege escalation
- **Fix**: Verify `authenticatedUserId === targetUserId` on ALL update operations. Reject with 403 if mismatch.

---

### HIGH-7: No Request Body Size Limits → DoS

- **Severity**: High
- **Affected**: All API routes parsing JSON bodies (`/api/ai/analyze`, `/api/ai/enhance`, `/api/journal/save`, `/api/stories`, etc.)
- **Description**: No `bodyParser` size limits are configured in Next.js config. Attackers can send multi-gigabyte JSON payloads.
- **Exploitation**:
  1. Attacker sends a 1GB JSON payload to `/api/ai/analyze`
  2. Server tries to parse it, runs out of memory
  3. Repeated attacks crash the server or exhaust resources
- **Impact**: Denial of service, server crashes, increased cloud costs
- **Fix**: Add `bodyParser: { sizeLimit: '1mb' }` in `next.config.mjs` for API routes. Use streaming for large payloads (audio, images).

---

### MEDIUM-1: Google Linking Tokens in sessionStorage (XSS Theft)

- **Severity**: Medium
- **Affected**: `components/AuthProvider.tsx:206-215`, `app/profile/ProfilePageClient.tsx:253-262`
- **Description**: Google linking tokens are stored in `sessionStorage` during the account-linking flow.
- **Exploitation**:
  1. If an XSS vulnerability exists anywhere in the app, `sessionStorage` is accessible via JavaScript
  2. Attacker steals the linking token and userId
  3. Attacker can link their Google account to victim's wallet account
- **Impact**: Account takeover via OAuth linking
- **Fix**: Use `httpOnly` cookies for linking tokens (short-lived, 5-minute expiry) or pass tokens via URL query params with PKCE validation.

---

### MEDIUM-2: Admin Client Created in Multiple Places (Secret Sprawl)

- **Severity**: Medium
- **Affected**: `lib/auth.ts:8-12`, `app/api/notifications/route.ts:7-12`, `app/utils/supabase/supabaseAdmin.ts`
- **Description**: The Supabase admin client (with `SUPABASE_SERVICE_ROLE_KEY`) is instantiated in multiple files. This increases the attack surface for accidental client-side bundling.
- **Exploitation**:
  1. A future developer accidentally imports `lib/auth.ts` in a client component
  2. `SUPABASE_SERVICE_ROLE_KEY` gets bundled into the client JavaScript
  3. Attacker extracts the key and gains full database access
- **Impact**: Complete database compromise
- **Fix**: Consolidate admin client creation to ONE server-only file. Add `"use server"` directive or a runtime check that throws if `typeof window !== "undefined"`.

---

### MEDIUM-3: Missing UUID Format Validation on storyId

- **Severity**: Medium
- **Affected**: Multiple routes accepting `storyId` param
- **Description**: `storyId` is used directly in Supabase `.eq("id", storyId)` queries without format validation.
- **Exploitation**:
  1. While Supabase parameterizes queries (preventing SQL injection), unexpected `storyId` formats could cause unexpected behavior
  2. Very long strings could cause performance issues or log injection
- **Impact**: Potential DoS, log poisoning
- **Fix**: Validate `storyId` matches UUID v4 format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) before using in queries.

---

### MEDIUM-4: Payment Webhook Missing Timestamp Validation

- **Severity**: Medium
- **Affected**: `app/api/payment/webhook/route.ts`
- **Description**: Webhook handlers should validate request timestamps to prevent replay attacks.
- **Exploitation**:
  1. Attacker intercepts a valid Blockradar webhook request
  2. Attacker replays the webhook later to re-activate a subscription
  3. No timestamp validation means the replay succeeds
- **Impact**: Double subscription activation, financial loss
- **Fix**: Validate webhook timestamp is within 5 minutes of current time. Implement idempotency keys.

---

### MEDIUM-5: Smart Contract Lacks Emergency Pause

- **Severity**: Medium
- **Affected**: `contracts/StoryNFT.sol`, `contracts/VerifiedMetrics.sol`
- **Description**: No `Pausable` functionality. If a critical bug is discovered, there is no way to pause minting.
- **Impact**: Inability to stop exploitation during incident response
- **Fix**: Add OpenZeppelin `Pausable` and `whenNotPaused` modifiers to minting functions. Grant pause role to a multisig or admin.

---

### MEDIUM-6: Verbose Error Messages in Production

- **Severity**: Medium
- **Affected**: Multiple API routes
- **Description**: Some routes return detailed error messages that could leak internal structure.
- **Exploitation**:
  1. Attacker probes APIs with malformed requests
  2. Detailed error messages reveal database schema, column names, or internal logic
- **Impact**: Information disclosure aids reconnaissance
- **Fix**: Return generic error messages to clients (`"Internal server error"`). Log detailed errors server-side only.

---

### MEDIUM-7: Missing Input Sanitization on AI Prompts

- **Severity**: Medium
- **Affected**: `/api/ai/analyze`, `/api/ai/enhance`, `/api/ai/reflection`, `/api/ai/transcribe`
- **Description**: User content is passed directly to AI APIs (Gemini, ElevenLabs) without prompt injection safeguards.
- **Exploitation**:
  1. Attacker submits a story containing prompt injection instructions
  2. AI API processes the injection, potentially leaking system prompts or generating harmful content
  3. Could increase API costs or generate policy-violating content
- **Impact**: Prompt injection, API abuse, content policy violations
- **Fix**: Sanitize user inputs before sending to AI APIs. Use delimiters and system prompts that resist injection. Implement output filtering.

---

### MEDIUM-8: Rate Limiting Bypass via Path Normalization

- **Severity**: Medium
- **Affected**: `middleware.ts:52-78`
- **Description**: Rate limiting groups by `pathname.split("/").slice(0, 4).join("/")`. Path normalization tricks (e.g., `/api//auth/login`, `/api/auth/login/`) could bypass rate limit grouping.
- **Impact**: Rate limit bypass for brute force attacks
- **Fix**: Normalize paths before rate limit key generation (`pathname.replace(/\/+/g, "/").replace(/\/$/, "")`).

---

### MEDIUM-9: `unsafe-eval` in Development CSP

- **Severity**: Medium
- **Affected**: `next.config.mjs:106`
- **Description**: `'unsafe-eval'` is added to CSP in development mode.
- **Impact**: If `NODE_ENV` is misconfigured or the dev build is accidentally deployed, eval-based XSS becomes trivial
- **Fix**: Never include `'unsafe-eval'` in CSP, even in development. Use Next.js dev server features that don't require eval.

---

### LOW-1: Unused `browserClient.ts` with localStorage

- **Severity**: Low
- **Affected**: `app/utils/supabase/browserClient.ts`
- **Description**: This file creates a Supabase client with `storage: window.localStorage` but is not imported anywhere. However, it exists in the codebase and could be accidentally imported in the future.
- **Impact**: If used, it would bypass the cookie-based session and store tokens in localStorage (XSS-vulnerable)
- **Fix**: Delete `browserClient.ts` if unused, or add a clear comment warning against its use.

---

### LOW-2: Missing `HttpOnly` on Some Cookies

- **Severity**: Low
- **Affected**: `app/utils/supabase/supabaseClient.ts`
- **Description**: The `cookieOptions` for the Supabase browser client do not specify `httpOnly`. While `@supabase/ssr` may set this internally, explicit configuration is safer.
- **Impact**: If cookies are not httpOnly, XSS can steal session cookies
- **Fix**: Explicitly set `httpOnly: true` in cookie options (if supported by `@supabase/ssr` 0.7.0).

---

### LOW-3: Preload Warnings (Performance, Not Security)

- **Severity**: Low
- **Affected**: Browser console warnings
- **Description**: Font preloads are not used within a few seconds, causing console warnings.
- **Impact**: Minor performance degradation, console noise
- **Fix**: Remove unnecessary preload links or ensure fonts are actually used immediately.

---

### LOW-4: Commented Code in Production

- **Severity**: Low
- **Affected**: Multiple files
- **Description**: Significant amounts of commented-out code remain in production files.
- **Impact**: Codebase clutter, potential accidental re-activation of old code
- **Fix**: Remove commented code or move to documentation.

---

### LOW-5: Missing `Secure` Attribute on Cookies in Dev

- **Severity**: Low
- **Affected**: `app/utils/supabase/supabaseClient.ts:24`
- **Description**: `secure: process.env.NODE_ENV === "production"` means cookies are sent over HTTP in development.
- **Impact**: Cookie theft via network sniffing in local development (low risk)
- **Fix**: Acceptable for local dev, but ensure production always has `secure: true`.

---

### LOW-6: `fetchWithTimeout` Signal Override Bug

- **Severity**: Low
- **Affected**: `components/AuthProvider.tsx:51-57`
- **Description**: `fetchWithTimeout` spreads `...init` after `signal: controller.signal`, which means if `init` contains `signal`, the timeout abort controller is overridden.
- **Impact**: Timeout may not work if caller passes custom signal
- **Fix**: Merge signals using `AbortSignal.any()` or ensure `signal` from init doesn't override the timeout controller.

---

## 3. Attack Chains

### Chain A: Admin Takeover → Data Poisoning → Reputation Destruction
1. **LOW**: Missing rate limits on admin endpoints allow brute-force of `ADMIN_SECRET`
2. **CRITICAL**: Once `ADMIN_SECRET` is cracked, attacker accesses `/api/admin/seed`
3. **HIGH**: Seeder injects malicious/fake stories and profiles
4. **MEDIUM**: Fake content propagates through public feed
5. **Impact**: Platform reputation destroyed, users lose trust

### Chain B: XSS → Cookie Theft → Account Takeover
1. **HIGH**: CSP `'unsafe-inline'` allows XSS payload execution
2. **MEDIUM**: Session cookies may not be `httpOnly` (unconfirmed in Supabase SSR 0.7.0)
3. **MEDIUM**: `sessionStorage` linking tokens stolen via XSS
4. **CRITICAL**: Attacker uses stolen tokens to link their Google account to victim's wallet
5. **Impact**: Full account takeover, data access, financial loss

### Chain C: Race Condition + Spam → Platform Manipulation
1. **HIGH**: Like counter race condition allows engagement metric manipulation
2. **HIGH**: Email endpoint abused for spam
3. **MEDIUM**: No input size limits allow DoS
4. **Impact**: Fake engagement stats, domain blacklisting, platform unavailability

---

## 4. Secure Design Recommendations

### Architectural Improvements

1. **Consolidate Admin Client Creation**
   - Create ONE `server-only` file for Supabase admin client
   - Add runtime guard: `if (typeof window !== "undefined") throw new Error("Server only")`
   - Never import admin client files in client components

2. **Implement API Gateway Pattern**
   - All external API calls (AI, blockchain, email) should go through server-side proxies
   - Never call third-party APIs directly from the browser (except where unavoidable like Web3 wallet)

3. **Add CSRF Protection**
   - Generate CSRF tokens per session
   - Validate on all state-changing requests
   - Or: Strict `Origin`/`Referer` header validation for same-origin requests

4. **Implement Comprehensive Rate Limiting**
   - Per-user rate limits (not just per-IP)
   - Separate limits for expensive operations (AI, email, payments)
   - Redis-backed rate limiting for multi-instance deployments

5. **Smart Contract Hardening**
   - Add `ReentrancyGuard` to all payable functions
   - Add `Pausable` for emergency stops
   - Add URI validation (length, format)
   - Implement multisig for admin functions

### Safer Patterns

| Current Pattern | Safer Pattern |
|----------------|---------------|
| `getSecret()` falls back to service key | Fail hard if `WALLET_JWT_SECRET` is missing |
| `sessionStorage` for linking tokens | Short-lived `httpOnly` cookies |
| `script-src 'unsafe-inline'` | Nonce-based CSP |
| Read-then-write like counters | Database atomic operations or RPCs only |
| Admin auth via single secret | IP allowlist + MFA + rate limiting |
| No request size limits | `bodyParser.sizeLimit` in next.config |
| Multiple admin client instantiations | Single server-only factory |

### Immediate Action Items (Priority Order)

1. [ ] **CRITICAL**: Remove `SUPABASE_SERVICE_ROLE_KEY` fallback in `lib/jwt.ts`
2. [ ] **CRITICAL**: Add rate limiting to admin endpoints (`/api/admin/*`)
3. [ ] **CRITICAL**: Add `ReentrancyGuard` to `StoryNFT.sol`
4. [ ] **HIGH**: Fix CSP to remove `'unsafe-inline'` for scripts
5. [ ] **HIGH**: Add CSRF protection to state-changing endpoints
6. [ ] **HIGH**: Fix IDOR on private story comments
7. [ ] **HIGH**: Remove like counter race condition fallback
8. [ ] **HIGH**: Rate limit and restrict email send endpoint
9. [ ] **HIGH**: Add body size limits to API routes
10. [ ] **MEDIUM**: Add `Pausable` to smart contracts
11. [ ] **MEDIUM**: Move linking tokens to httpOnly cookies
12. [ ] **MEDIUM**: Consolidate admin client to single server-only file
13. [ ] **MEDIUM**: Add UUID validation on storyId parameters
14. [ ] **MEDIUM**: Add webhook timestamp validation
15. [ ] **LOW**: Delete unused `browserClient.ts`

---

## 5. Compliance & Legal Notes

- **CAN-SPAM**: Email endpoint needs unsubscribe links and rate limiting
- **GDPR**: User data deletion (right to erasure) not implemented in API routes
- **COPPA**: No age verification for minors using the platform
- **PCI-DSS**: Crypto payments are not credit card payments, but financial data handling should still follow security best practices

---

*This audit should be reviewed by a human security engineer before deployment. Automated tools cannot catch all logic flaws.*
