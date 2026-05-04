# CLAUDE.md — eStory Project Guide

This file provides full context for Claude Code working on the eStory codebase.
It combines architecture docs, accumulated experience from 20+ sessions, known pitfalls, and workflow preferences.

---

## Project Overview

**eStory** is a Web3 AI-powered voice journaling dApp that transforms personal narratives into structured, sovereign memory infrastructure. Built on Base (Ethereum L2), it combines voice capture, AI transcription, blockchain permanence, and cognitive analysis.

### Vision — Three Civilizational Crises

1. **Memory Extinction** — Human experience vanishes. eStory: voice → AI transcription → encrypted storage → on-chain permanence.
2. **The Unexamined Life at Scale** — We're in an AI revolution. Journaling declutters the mind, but platforms exploit data. eStory: sovereign, verifiable journaling (AES-256-GCM + Chainlink CRE).
3. **The Meaning Void** — As AI automates jobs, storytelling fills the void. Authenticity must be provable. On-chain proofs = tamper-proof provenance for genuine human narratives.

**1-line pitch**: Privacy-preserving AI journal verification via Chainlink CRE on Base L2

### Tech Stack

- **Frontend:** Next.js 15.5.9, React 19, Tailwind CSS 4, shadcn/ui
- **Web3:** Wagmi 2.17, Viem 2.38, RainbowKit 2.2, Hardhat
- **Backend:** Supabase (PostgreSQL + Auth + Storage), Pinata (IPFS)
- **AI:** ElevenLabs Scribe (speech-to-text), Google Gemini 2.5 Flash (text enhancement + analysis), Claude SDK (thinking agent)
- **Testing:** Vitest (unit tests), Playwright (E2E tests)
- **Local Storage:** Dexie.js (IndexedDB), Web Crypto API (AES-256-GCM, PBKDF2, AES-KW)
- **Email:** Resend
- **Blockchain:** Base Sepolia (chain ID: 84532)
- **Verification:** Chainlink CRE (verifiable off-chain compute + on-chain attestation)

### Current Phase (March 2026)

Phase 2.6 — Logo & branding overhaul complete. All prior phases done:
- Phase 1–1.5: Core features, security hardening (96 tests, 34 audit findings fixed)
- Phase 1.6–1.6.1: Chainlink CRE integration (privacy-preserving dual-write)
- Phase 1.7: SEO overhaul (server/client page split, OG images, structured data)
- Phase 1.8–1.9: Mobile app scaffolding (React Native + Expo SDK 54)
- Phase 2.0: Auth overhaul (custom JWT for wallet, eliminated fake @wallet.local emails)
- Phase 2.1: Waitlist (Resend + Supabase)
- Phase 2.2: Local Vault (AES-256-GCM encrypted IndexedDB, 27 vault tests)
- Phase 2.3: Mobile UI overhaul (glassmorphism, 12 shared components)
- Phase 2.4: Record page UX, archive grouping, draft persistence, performance audit
- Phase 2.5: Hackathon submission (Chainlink CRE, Mar 2026)
- Phase 2.6: New "Pen & Book" logo — `components/LogoMark.tsx`, amber→purple brand palette

**Pending**: Run Supabase migrations `005_create_waitlist_table.sql` and `006_create_verified_metrics_tables.sql`. Next up: Phase 2 (Patterns & Discovery).

---

## User Preferences & Prompting Style

- **Model preference**: Claude Opus | **Effort**: high
- **Stack**: Next.js, React, TypeScript, Tailwind, shadcn/ui, Supabase, Web3
- **Verify before done**: always run `npx tsc --noEmit` + `npm run build`
- **Security**: pause to flag concerns before proceeding
- **No over-engineering**: only implement what's requested
- **Checkpoint approach**: break complex tasks into 2-3 phases with testable endpoints

### How the User Writes Implementation Plans
- Writes highly structured plans with file paths + line numbers
- Uses tables for batch file→change mappings — execute them as a batch, not separate steps
- **Don't repeat verification steps** — this guide already mandates `tsc` + `build`. Skip if the plan includes a redundant "verification" section.
- **Infer mechanical details** — when the plan says "generate PNGs at standard sizes," choose the right tool and standard sizes without needing them spelled out.
- **Read source files for content** — if the plan references designs/content in a file, read it directly rather than relying on the plan's description.
- **Handle import cleanup automatically** — when replacing a component, remove the old import without being told.

### Debugging Style
- Investigation-first: read extensively before making changes
- Integrates Playwright browser testing with code changes
- Prefers structured task lists for complex sessions
- Sessions often interrupted by usage limits — commit incrementally to avoid losing progress

---

## Development Commands

All commands run from the project root (`i_story_dapp/`):

```bash
# Web Development
npm run dev              # Next.js dev server (localhost:3000)
npm run build            # Production build (what Vercel runs)
npm run start            # Production server
npm run lint             # ESLint

# Mobile Development (namespaced — NEVER let dev/build/start point to Expo)
npm run mobile           # Expo dev server
npm run mobile:android   # Android
npm run mobile:ios       # iOS

# Unit Tests (Vitest)
npx vitest run                                    # Full suite
npx vitest run __tests__/RecordPage.test.tsx      # Single file

# E2E Tests (Playwright)
npx playwright test                               # All e2e (port 3001)
npx playwright test --ui                          # Interactive UI

# Smart Contracts (Hardhat)
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia

# CRE (from cre/ directory)
cre workflow simulate iStory_workflow              # Local test
cre workflow simulate iStory_workflow --broadcast  # With on-chain write
```

**CRITICAL:** `npm run dev` = `next dev`. `npm run build` = `next build`. These are what Vercel deploys. If a merge ever changes these to Expo commands, fix immediately — it will break deployment.

---

## Directory Structure

```
i_story_dapp/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (all require Bearer token auth)
│   │   ├── admin/, ai/, auth/, book/, books/, cron/, email/
│   │   ├── habits/, ipfs/, journal/, notifications/
│   │   ├── paywall/, social/, stories/, sync/, tip/, user/
│   │   └── cre/                  # Chainlink CRE routes (trigger, callback, check)
│   ├── hooks/                    # React hooks (useVault, useLocalStories, useVerifiedMetrics, ...)
│   ├── types/                    # TypeScript definitions
│   ├── utils/                    # Utilities (Supabase clients, services)
│   └── [pages]/                  # books, library, profile, record, social, story, tracker
│                                   # Pattern: server page.tsx (metadata) + *PageClient.tsx (UI)
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── emails/                   # React Email templates (WelcomeEmail, WaitlistEmail)
│   ├── vault/                    # VaultGuard, VaultSetup, VaultUnlock
│   ├── three/                    # Three.js background (dynamically loaded)
│   ├── LogoMark.tsx              # Brand logo SVG component (pen & book, dark/light variants)
│   ├── Navigation.tsx            # Top nav + mobile bottom nav
│   ├── Footer.tsx                # Site footer
│   ├── AuthProvider.tsx          # Auth state management (wallet JWT + Supabase session)
│   ├── AuthButton.tsx            # Login/logout UI
│   └── Provider.tsx              # Wagmi → RainbowKit → Theme → Auth → App context
├── contracts/                    # Solidity (iStoryToken, StoryNFT, StoryProtocol, PrivateVerifiedMetrics)
│   ├── interfaces/               # IERC165, IReceiver, ReceiverTemplate
│   └── legacy/                   # VerifiedMetrics.sol (backward compat)
├── cre/                          # Chainlink CRE workflows
│   └── iStory_workflow/          # main.ts, gemini.ts, httpCallback.ts
├── lib/                          # Shared libraries
│   ├── auth.ts                   # validateAuth, validateAuthOrReject, isAuthError
│   ├── jwt.ts                    # Custom JWT for wallet users (jose, HS256)
│   ├── crypto.ts                 # safeCompare (timing-safe)
│   ├── contracts.ts              # ABI + deployed addresses
│   └── vault/                    # Client-side encryption: crypto.ts, db.ts (Dexie), keyManager.ts
├── scripts/                      # Hardhat deploy + utilities
├── middleware.ts                 # API rate limiting
├── __tests__/                    # Unit tests (Vitest)
├── e2e/                          # E2E tests (Playwright)
├── docs/                         # Reference docs
│   ├── API_REFERENCE.md          # All API routes, methods, auth requirements
│   ├── DATABASE_SCHEMA.md        # Tables, SQL schemas, type definitions
│   ├── TESTING_GUIDE.md          # Test setup, mocking patterns, coverage
│   ├── ROADMAP.md                # Phase 1-3 tasks, privacy model
│   ├── WORKFLOWS.md              # Prompt templates, headless mode
│   └── DECISIONS.md              # Architecture decision log
└── public/                       # Static assets
    ├── logo-mark.svg             # Dark variant SVG
    ├── logo-mark-light.svg       # Light variant SVG
    ├── favicon.svg               # Simplified mark (SVG favicon)
    ├── favicon.ico               # ICO fallback
    ├── icon-192.png, icon-512.png # PWA icons
    └── apple-touch-icon.png      # iOS icon
```

---

## Security Architecture

All API routes are protected by a layered security model:

```
Layer 4: Ownership Verification — User can only modify their own resources
Layer 3: Input Validation — File size, MIME type, text length limits
Layer 2: Bearer Token Auth — validateAuthOrReject() via lib/auth.ts
Layer 1: Rate Limiting — middleware.ts (AI=10/min, Auth=20/min)
Layer 0: Security Headers — CSP, X-Frame-Options, CORS via next.config
Client: Local Vault — AES-256-GCM encryption at rest in IndexedDB (lib/vault/)
        PIN → PBKDF2 (100K iterations) → KEK → AES-KW wraps DEK
        DEK held in-memory only while unlocked. clearAllKeys() on sign-out.
```

**Key Security Files:**
| File | Purpose |
|------|---------|
| `lib/auth.ts` | `validateAuth`, `validateAuthOrReject`, `validateWalletOwnership`, `isAuthError` |
| `lib/crypto.ts` | Timing-safe string comparison (`safeCompare`) |
| `middleware.ts` | Rate limiting with route-specific limits |
| `app/api/auth/nonce/route.ts` | Nonce generation for wallet signature replay prevention |
| `next.config.mjs` | Security headers (CSP, X-Frame-Options DENY, nosniff) |

---

## Authentication Architecture (IMPORTANT — read carefully)

Dual-auth system supporting both wallet and Google OAuth users.

### Wallet Flow
1. User connects wallet via RainbowKit
2. Client fetches nonce: `GET /api/auth/nonce?address=0x...`
3. User signs nonce message (UUID nonce + timestamp)
4. Client sends signature to `POST /api/auth/login`
5. Server verifies nonce (one-time use, 5-min expiry) and signature
6. Server issues **custom JWT** via `lib/jwt.ts` (jose, HS256, 7-day expiry)
7. Stored in `localStorage` as `estory_wallet_token`

### Google OAuth Flow
1. User clicks "Sign in with Google" → Google OAuth redirect
2. Redirected to `/api/auth/callback` (validates URL against whitelist)
3. Supabase handles session, AuthProvider picks up token

### Key Auth Rules
- **Wallet users NEVER create Supabase auth users.** No `@wallet.local` fake emails.
- **Server (`lib/auth.ts`)**: `validateAuth()` tries Supabase token first, then custom wallet JWT
- **Client (`AuthProvider`)**: `getAccessToken()` tries Supabase session first, then localStorage wallet JWT
- **All API calls** go through API routes with admin client (bypass RLS). No direct Supabase client queries for data.
- **All pages** use `getAccessToken()` from AuthProvider — no page has its own `getSession()` call
- **Services** (ipfsService, emailService) accept `accessToken` as parameter from callers
- **Audio upload** goes through `/api/audio/upload` API route (admin client, bypasses storage RLS)
- **Race conditions** between OAuth redirect and wallet connection state are a known issue — always check both paths

### Adding Auth to New API Routes
```typescript
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authResult = await validateAuthOrReject(req);
  if (isAuthError(authResult)) return authResult;
  const authenticatedUserId = authResult;
  // ... route logic
}
```

### Error Response Pattern (never leak internals)
```typescript
console.error("[ROUTE_NAME] Error:", err);
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

---

## Architecture

### Provider Stack (`components/Provider.tsx`)
```
WagmiProvider → QueryClientProvider → RainbowKitProvider → ThemeProvider → AuthProvider → AppContext
```
AuthProvider sign-out calls `clearAllKeys()` (lib/vault) to wipe DEKs from memory before clearing the session.

### Smart Contracts (Base Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| **eStoryToken** | `0xf9eDD76B...` | ERC20 $STORY token, MAX_SUPPLY 100M |
| **StoryProtocol** | `0xA51a4cA0...` | Tips & paywall |
| **StoryNFT** | `0x6D37ebc5...` | ERC721 story books, mintFee 0.001 ETH |
| **PrivateVerifiedMetrics** | `0x158e08BC...` | Privacy-preserving CRE metrics (minimal on-chain proofs) |
| **VerifiedMetrics (legacy)** | `0x052B52A4...` | Old contract (backward compat) |

Addresses live in `lib/contracts.ts`.

### Chainlink CRE (Privacy-Preserving Dual-Write)

```
POST /api/cre/trigger → CRE Workflow (Chainlink DON, ConfidentialHTTPClient)
                              ↓
                    Gemini AI Analysis (encrypted enclave) + DON Consensus
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
  [On-Chain] KeystoneForwarder         [Off-Chain] /api/cre/callback
  → PrivateVerifiedMetrics.sol         → Supabase (full metrics, author-only)
  (tier, threshold, hashes only)       (scores, themes, word count)
              ↓                               ↓
              └───────────────┬───────────────┘
                              ↓
POST /api/cre/check (author-based filtering) ← useVerifiedMetrics hook
  Author: full metrics + proof | Public: proof only (tier, threshold)
```

**CRE Key Files:**
| File | Purpose |
|------|---------|
| `cre/iStory_workflow/main.ts` | Workflow entry: HTTPCapability + Runner |
| `cre/iStory_workflow/gemini.ts` | Gemini AI via ConfidentialHTTPClient |
| `cre/iStory_workflow/httpCallback.ts` | 8-step handler with privacy fields + callback |
| `contracts/PrivateVerifiedMetrics.sol` | Privacy-preserving on-chain storage |
| `app/api/cre/trigger/route.ts` | Triggers CRE workflow |
| `app/api/cre/callback/route.ts` | Receives full metrics from DON nodes |
| `app/api/cre/check/route.ts` | Author-filtered metrics reading |
| `app/hooks/useVerifiedMetrics.ts` | Frontend hook (metrics + proof) |
| `skills/cre/SKILL.md` | CRE SDK patterns (correct vs wrong) |

### Supabase Client Variants (`app/utils/supabase/`)

| File | Use Case |
|------|----------|
| `supabaseClient.ts` | Browser/client components (singleton, SSR-safe) |
| `supabaseServer.ts` | API routes, SSR (uses cookies) |
| `supabaseAdmin.ts` | Admin operations (bypasses RLS) |

---

## Key Patterns & Conventions

- **Path alias:** `@/*` maps to project root
- **UI:** shadcn/ui in `components/ui/`, Tailwind CSS 4 dark mode via `class`
- **Forms:** react-hook-form + zod validation
- **Toasts:** sonner + react-hot-toast
- **Animations:** framer-motion
- **Brand colors:** amber `#d4a04a` → purple `#9b7dd4` → deep purple `#6c3dbd`
- **Logo component:** `<LogoMark size={32} variant="dark" />` — see `components/LogoMark.tsx`

### Naming Conventions
| Concept | Internal Name | User-Facing Name |
|---------|--------------|------------------|
| Important story | `is_canonical` | "Important" / "Key Moment" |
| Story with metadata | `NarrativeObject` | "Story" |
| Metadata extraction | `analyzeStory()` | "Insights" |
| Weekly summary | `WeeklyReflection` | "Weekly Reflection" |

### API Response Patterns
```typescript
// Success: { success: true, data: {...} }
// Error:   { error: "Human-readable message", code?: "ERROR_CODE" }
// Analysis: { success: true, metadata: {...}, insight: "..." }
```

---

## Common Tasks

### Add a new API route
1. Create folder in `app/api/[route-name]/`
2. Add `route.ts` with `validateAuthOrReject` from `lib/auth.ts`
3. Add ownership verification where applicable
4. Use generic error messages (never `error.message`)
5. **NEVER initialize Supabase client at module scope** — use lazy singleton:
```typescript
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
let _supabase: ReturnType<typeof getSupabase> | null = null;
function supabase() {
  if (!_supabase) _supabase = getSupabase();
  return _supabase;
}
```
6. **Route files can only export HTTP handlers** (GET, POST, PUT, DELETE). Extract shared logic to `lib/`.

### Add a new page
1. Create `app/[page-name]/[PageName]PageClient.tsx` with `"use client"` (UI logic)
2. Create `app/[page-name]/page.tsx` as server component (exports `metadata`, renders client component)
3. For dynamic routes (`[id]`): use `generateMetadata()` with `createSupabaseAdminClient()`
4. Private content: `robots: { index: false }` with no content leak in metadata
5. Update `Navigation.tsx` if needed

### Add vault-encrypted storage to a page
1. Wrap content with `<VaultGuard>` (handles locked/not-set-up states)
2. Use `useLocalStories()` for reactive CRUD — decrypts automatically when vault is unlocked
3. Import from `@/lib/vault` for direct crypto ops (`getDEK`, `encryptString`, `decryptString`)
4. Never call `crypto.subtle` directly — always use `lib/vault/crypto.ts`
5. Vault ops are browser-only — never import in API routes or server components

### Add a new Web3 hook
1. Create in `app/hooks/`, import ABI from `lib/contracts.ts`
2. Use Wagmi hooks (`useReadContract`, `useWriteContract`)

---

## Known Issues & Gotchas (Learned from Experience)

### Auth Race Conditions
- Race conditions between Google OAuth redirect and wallet connection state
- Always check both happy path AND auth provider interactions
- Verify state synchronization after OAuth redirects
- Key files: `AuthProvider.tsx`, `Provider.tsx`, `app/api/auth/`

### Database Constraint Conflicts (409 Errors)
- `users` table has unique constraints on BOTH `id` AND `wallet_address`
- Must handle conflicts on each constraint independently
- Don't assume only primary key conflicts — check ALL unique fields on the table

### Test Failures After Adding Auth
- When adding auth to a route, existing tests will fail with 401
- Fix: mock `@/lib/auth` using `vi.hoisted` + `vi.mock` pattern
- Also mock ownership check (Supabase `from("stories").select("author_id")`)
- Error message assertions may need updating (sanitized errors → generic messages)
- **Canonical auth mock pattern**: see `__tests__/api/analyze.test.ts`

### Merge Conflict Danger Zone
A previous incident: mobile-app PR merged on GitHub while local had unpushed `package.json`/`next.config.mjs` changes. Git auto-merged SILENTLY but wrong — `build` renamed to `web:build`, `dev` pointed to Expo. Vercel deployment broke.

**Prevention:**
1. Push local changes BEFORE merging PRs on GitHub
2. After every `git pull` or merge, check for conflict markers AND verify `npm run build` works
3. Mobile scripts must be namespaced `mobile:*` — never let `dev`/`build`/`start` point to Expo

### Short Text Analysis
`/api/ai/analyze` returns 400 if `storyText` < 50 chars (`MIN_CONTENT_LENGTH`). Client doesn't guard against this yet — needs graceful "Story too short for analysis" message.

### `/api/ai/reflection` Missing Auth
Has no `validateAuthOrReject` guard — should add for consistency (low priority).

---

## Completion Checklist (MANDATORY)

Before marking ANY task as complete:
1. Run pending database migrations and verify they applied
2. Run full test suite: `npx vitest run` — fix broken tests
3. TypeScript check: `npx tsc --noEmit`
4. Production build: `npm run build`

Do NOT report a task as done if any of these fail.

### Pre-Push Safety Checks (MANDATORY)

Before every `git push` or `git commit`:

```bash
# 1. Check for merge conflict markers
grep -r "^<<<<<<< \|^=======$\|^>>>>>>> " --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" --include="*.json" --include="*.css" .

# 2. Verify package.json scripts (deployment depends on these)
node -e "const p=require('./package.json'); const ok=p.scripts.build?.includes('next build') && p.scripts.dev?.includes('next dev'); console.log(ok ? 'PASS' : 'FAIL: scripts are wrong'); process.exit(ok ? 0 : 1)"

# 3. Verify next.config.mjs parses
node -e "import('./next.config.mjs').then(()=>console.log('PASS')).catch(e=>{console.log('FAIL:',e.message);process.exit(1)})"

# 4. Production build
npm run build
```

If any check fails, STOP and alert the user.

---

## Performance

### Bundle Budget
- Shared (all pages): **104 kB** (wagmi + viem + RainbowKit + react-query)
- Target: Keep pages under **500 kB** First Load JS
- Current: Landing 426 kB | Record 467 kB | Library 462 kB | Profile 498 kB | Social 462 kB

### What makes it heavy (unavoidable)
- Web3 stack ~200 kB (wagmi + viem + RainbowKit)
- Three.js background ~120 kB (dynamically loaded, `ssr: false`, weak-device detection)
- Framer-motion ~45 kB (used in 19 files)

### Optimizations applied
- `optimizePackageImports` in next.config.mjs for lucide-react, framer-motion, @radix-ui, date-fns, @supabase/supabase-js
- Removed unused recharts (~90 kB saved)
- Three.js: dynamic import, `powerPreference: 'low-power'`, `antialias: false`, DPR capped at 1.5
- `ProvidersDynamic` wraps providers with `ssr: false`

### Record Page Loading States
Three separate states (NOT a single `isProcessing`):
- `isTranscribing` — ElevenLabs transcription
- `isEnhancing` — AI text enhancement
- `isSaving` — Cloud + vault save
- `isBusy = isTranscribing || isEnhancing || isSaving` — derived, disables all inputs
- Save button spinner only shows during `isSaving`

---

## Hooks Reference

| Category | Hook | Purpose |
|----------|------|---------|
| **Web3** | `useEStoryToken` | Balance, approve |
| **Web3** | `useStoryProtocol` | tipCreator, payPaywall |
| **Web3** | `useStoryNFT` | mintBook |
| **CRE** | `useVerifiedMetrics` | Poll for CRE-attested story metrics |
| **Vault** | `useVault` | setup/unlock/lock/changePin, isSetup, isUnlocked |
| **Vault** | `useLocalStories` | Encrypted CRUD via IndexedDB, reactive (useLiveQuery) |
| **Supabase** | `useBrowserSupabase` | Client singleton |
| **Supabase** | `useNotifications` | CRUD + real-time polling |

---

## Files Changed Most Frequently

| Area | Key Files |
|------|-----------|
| Auth | `lib/auth.ts`, `lib/jwt.ts`, `AuthProvider.tsx`, `Provider.tsx`, `app/api/auth/` |
| Security | `lib/crypto.ts`, `middleware.ts`, `next.config.mjs` |
| Database | `app/utils/supabase/`, `app/api/user/`, `app/api/journal/save/` |
| Tests | `__tests__/setup.ts`, `__tests__/api/`, `__tests__/components/` |
| AI | `app/api/ai/analyze/`, `components/StoryInsights.tsx` |
| Contracts | `contracts/`, `lib/contracts.ts` |
| CRE | `cre/iStory_workflow/`, `app/api/cre/`, `app/hooks/useVerifiedMetrics.ts` |
| SEO | `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/layout.tsx` |
| Branding | `components/LogoMark.tsx`, `components/Navigation.tsx`, `components/Footer.tsx` |
| Email | `app/api/email/send/`, `components/emails/` |
| Vault | `lib/vault/`, `components/vault/`, `app/hooks/useVault.ts`, `app/hooks/useLocalStories.ts` |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.mjs` | Next.js config + security headers + `optimizePackageImports` |
| `middleware.ts` | API rate limiting |
| `hardhat.config.ts` | Solidity config |
| `vitest.config.ts` | Unit test config |
| `playwright.config.ts` | E2E test config |
| `tailwind.config.ts` | Tailwind CSS config |
| `app/robots.ts` | Crawler directives |
| `app/sitemap.ts` | Dynamic sitemap (public stories) |
| `app/opengraph-image.tsx` | Default branded OG image |
| `public/manifest.json` | PWA manifest |

---

## Environment Variables

Create `.env.local` from `.env.example`. Key groups:
- Supabase (URL, anon key, service role key)
- WalletConnect (project ID)
- AI Services (Gemini API key, ElevenLabs API key, Anthropic API key)
- IPFS/Pinata (JWT, gateway URL)
- Contract Addresses (Base Sepolia)
- Hardhat (private key, Basescan API key)
- Resend (API key)
- CRON_SECRET

---

## Best Practices (Earned Through Experience)

1. **Checkpoint approach** — Break complex tasks into 2-3 phases with testable endpoints. Commit between phases.
2. **Security first** — All new API routes MUST use `validateAuthOrReject` from `lib/auth.ts`.
3. **Verify before moving on** — Run tests after each fix before proceeding to the next.
4. **Commit incrementally** — Save working changes to avoid losing progress to session limits.
5. **Never leak errors** — Use generic error messages in API responses. Log details server-side only.
6. **Ownership checks** — Verify user owns the resource before any mutation.
7. **Pre-push checks** — Always check for conflict markers + verify scripts before pushing.
8. **Push before merging PRs** — If you have local changes to shared config files, push first.
9. **No over-engineering** — Only implement what's requested. Don't add abstractions for single-use patterns.
10. **Read before writing** — Always read existing files before modifying. Understand the code first.

---

## Mobile App (Separate Worktree)

**Location**: `i_story_mobile/mobile/` (git worktree on `mobile-app` branch)
- React Native + Expo SDK 54
- 12 shared UI components (GlassCard, GradientButton, AnimatedListItem, etc.)
- `wagmi` pinned to 2.19.5 (Reown AppKit requires `wagmi@>=2 <3.0.0`)
- TypeScript: 0 errors, web bundle compiles (4456 modules)

```bash
cd i_story_mobile/mobile
npm start                            # Expo dev server
npx expo export --platform android   # Verify Android bundle
npx expo start --web                 # Test in browser
```
