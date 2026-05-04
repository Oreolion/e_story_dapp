# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Detailed references are in `docs/` — read them on-demand when needed.

| Doc | Contents |
|-----|----------|
| `docs/API_REFERENCE.md` | All API routes, methods, auth requirements |
| `docs/DATABASE_SCHEMA.md` | Tables, SQL schemas, type definitions |
| `docs/TESTING_GUIDE.md` | Test setup, mocking patterns, coverage |
| `docs/ROADMAP.md` | Phase 1-3 tasks, privacy model, nav hierarchy |
| `docs/WORKFLOWS.md` | Prompt templates, headless mode, autonomous workflows |
| `docs/DECISIONS.md` | Architecture decision log, references |

---

## Project Overview

**eStory** is a Web3 AI-powered sovereign storytelling platform that transforms narratives into structured, permanent, and verifiable memory infrastructure. Built on Base (Ethereum L2), it combines voice capture, AI transcription, blockchain permanence, and cognitive analysis. Users write about anything they're passionate about — personal journals, historical narratives, geopolitical analysis, cultural stories, creative non-fiction — with AI-powered craft feedback that helps them become better storytellers over time.

### Vision — A Convergent Solution to Three Civilizational Crises

1. **The Ancient Crisis — Memory Extinction.** Throughout history, the vast majority of human experience has vanished. Oral traditions died with their keepers. Cultural narratives and indigenous knowledge disappeared with their communities. Humanity has always lacked infrastructure to capture and preserve stories at scale — personal journals, historical accounts, and cultural wisdom alike. eStory solves this with voice capture → AI transcription → encrypted storage → optional on-chain permanence.

2. **The Present Crisis — The Unexamined Life at Scale.** We are living through a civilizational inflection point comparable to the Renaissance and Industrial Revolution. Future generations will look back and ask how we navigated it. Writing — whether personal journals, historical analysis, or geopolitical commentary — declutters the mind and sharpens thinking, but current platforms harvest intimate data with zero transparency. eStory provides a sovereign space to process this historic moment through both private reflection and public storytelling — client-side encryption (AES-256-GCM) and Chainlink CRE ensure analysis is verifiable without trusting the app operator.

3. **The Emerging Crisis — The Meaning Void.** As AI automates work, millions will lose not just jobs but their primary source of identity and purpose. Storytelling, writing, and creative self-expression are among the oldest answers to that void — and eStory's AI feedback loop helps users improve as storytellers, turning the platform into both a creative tool and a craft-building practice. But in a world flooded with AI-generated content, authenticity must be provable. eStory's on-chain cryptographic proofs create tamper-proof provenance for genuine human narratives.

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

### Current Phase

Phase 1.5 Complete (Security Hardening), CRE Integration Complete, SEO Overhaul Complete, Local Vault Complete — Ready for Phase 2 (Patterns & Discovery). See `docs/ROADMAP.md` for details.

---

## Workflow Preferences

Before starting complex debugging or multi-step implementations, ask if there's a time constraint or if the user wants a checkpoint approach with testing between phases.

### Completion Checklist
Before marking any task as complete, always:
1. Run any pending database migrations and verify they applied successfully
2. Run the full test suite (`npx vitest run`) and fix any broken tests
3. Check for TypeScript errors (`npx tsc --noEmit`)
4. Run `npm run build` to verify production build passes
Do NOT report a task as done if any of these fail.

**IMPORTANT: Batch verification.** Do NOT run `tsc --noEmit` or `npm run build` after every individual file edit. Complete ALL related file changes first, then run a single verification pass at the end. For small/cosmetic changes (font, color, copy), skip build unless explicitly asked.

### Session Continuity
- Proactively save progress to memory files at natural breakpoints (after completing a milestone, before starting a new phase, or when hitting a blocker)
- When resuming from a previous session, read `MEMORY.md` and memory directory files first to restore context
- Keep session-log.md updated with completed work, pending items, and unresolved issues

### Pre-Push Safety Checks (MANDATORY)
**Before every `git push` or `git commit`, Claude MUST run these checks and ALERT the user if any fail:**

```bash
# 1. Check for merge conflict markers in ALL source files
grep -r "^<<<<<<< \|^=======$\|^>>>>>>> " --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" --include="*.json" --include="*.css" .

# 2. Verify package.json scripts are correct (deployment depends on these)
#    - "dev" must contain "next dev" (NOT "expo start")
#    - "build" must contain "next build" (NOT "web:build" or missing)
node -e "const p=require('./package.json'); const ok=p.scripts.build?.includes('next build') && p.scripts.dev?.includes('next dev'); console.log(ok ? 'PASS' : 'FAIL: scripts are wrong — deployment will break'); process.exit(ok ? 0 : 1)"

# 3. Verify next.config.mjs parses correctly
node -e "import('./next.config.mjs').then(()=>console.log('PASS')).catch(e=>{console.log('FAIL:',e.message);process.exit(1)})"

# 4. Production build passes
npm run build
```

**If any check fails, STOP and alert the user before pushing.** Explain what's wrong and fix it.

### Merge Conflict Prevention
Merge conflicts happen when two branches edit the same file in the same area. Common conflict-prone files in this project:

| File | Why it conflicts | Prevention |
|------|-----------------|------------|
| `package.json` | Scripts, dependencies changed by web and mobile branches | Always push local changes before merging PRs on GitHub |
| `next.config.mjs` | Config keys added by different features | Push first, merge second |
| `AuthProvider.tsx` | Frequently edited for auth fixes | Keep changes small, commit often |

**Rules:**
1. **Push local changes before merging PRs on GitHub** — if you have unpushed commits that touch `package.json` or `next.config.mjs`, push first
2. **After every `git pull` or merge**, immediately run: `grep -r "^<<<<<<<" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" .`
3. **Silent auto-merges are the real danger** — Git may auto-merge `package.json` scripts incorrectly (one branch renames `build` → `web:build`, the other edits dependencies — Git combines both, but the renamed scripts break Vercel). Always verify `npm run build` works after pulling.
4. **Mobile scripts must be namespaced** — `mobile:*` prefix. Never let `dev`/`build`/`start` point to Expo.

---

## Never Do This

These rules are non-negotiable. Violating them will be reverted on sight.

1. **Never install packages without asking the user first.** Always explain why a package is needed and get explicit approval. The project already has a large dependency tree.
2. **Never rewrite components or pages that weren't explicitly asked for.** If you need to refactor for a requested change, keep the scope minimal and explain what you're touching.
3. **Never use `useEffect` for data fetching.** Use React Query (`@tanstack/react-query`) with the hooks in `lib/queries/hooks.ts`. `useEffect` + `fetch` is banned for data fetching.
4. **Never add `console.log` to production code.** Use `console.error` for actual errors only. Remove or comment out debug logs before marking a task complete.
5. **Never use inline styles (`style={{ ... }}`).** Use Tailwind CSS classes only. The only exception is dynamic CSS variables passed to components.
6. **Never suggest switching frameworks, databases, auth providers, or build tools.** The stack is fixed (Next.js, Supabase, Tailwind). Work within it.
7. **Never add placeholder TODO comments like `// TODO: fix this later`.** If something needs doing, do it or file a real issue. Commented-out code is also forbidden — delete it.
8. **Never use emojis in code comments or commit messages.** Use plain text only.
9. **Never wrap code in `try/catch` without explaining why.** Silent swallowing (`catch { /* ignored */ }`) must be justified in a comment. If you can't explain it, don't catch it.
10. **Never modify `next.config.mjs` to add an `api` key.** Next.js App Router does not support this. Use per-route `export const config` or middleware instead.
11. **Never ignore build, TypeScript, or test failures.** Fix them before marking a task complete. The only exception is pre-existing warnings that would require risky refactors to fix — document those instead.

---

## Database

- **Always run migrations after creating them.** Verify the migration was applied by checking the database schema before moving on. Never mark a migration task as complete without executing it.
- **When fixing database constraint errors** (e.g., 409 Conflict, duplicate key), check ALL unique constraints and indexes on the affected table(s), not just the primary key. Handle each potential conflict column (id, wallet_address, email, etc.).
- Use `docs/DATABASE_SCHEMA.md` as the source of truth for table schemas.

---

## Testing

- **After making changes, run the full test suite before reporting completion.** Fix any broken tests before moving on to the next task.
- If a change introduces a new validation rule or constraint, check that existing tests still pass — update test fixtures/mocks as needed.
- Run `npx vitest run` for unit tests and `npm run build` for build verification after every significant change.

---

## Development Commands

All commands run from the `i_story_dapp/` directory:

```bash
# Web Development
npm run dev              # Start Next.js dev server on localhost:3000
npm run build            # Production build (what Vercel runs)
npm run start            # Start production server
npm run lint             # Run ESLint

# Mobile Development
npm run mobile           # Start Expo dev server
npm run mobile:android   # Start Expo for Android
npm run mobile:ios       # Start Expo for iOS

# Unit Tests (Vitest)
npx vitest run           # Run once without watch
npx vitest run __tests__/RecordPage.test.tsx  # Single test file

# E2E Tests (Playwright)
npx playwright test                    # Run all e2e tests (server on port 3001)
npx playwright test --ui               # Interactive UI mode

# Smart Contracts (Hardhat)
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia
npx hardhat run scripts/verify-deployment.ts --network baseSepolia
```

**CRITICAL:** `npm run dev` must always run `next dev` (not Expo). `npm run build` must always run `next build`. These are what Vercel uses for deployment. Mobile scripts are namespaced under `mobile:*`. If a merge ever changes these, fix immediately — it will break deployment.

---

## Directory Structure

```
i_story_dapp/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (all require Bearer token auth)
│   │   ├── admin/, ai/, auth/, book/, books/, cron/, email/
│   │   ├── habits/, ipfs/, journal/, notifications/
│   │   ├── paywall/, social/, stories/, sync/, tip/, user/
│   ├── hooks/                    # React hooks (useVault, useLocalStories, useVerifiedMetrics, ...)
│   ├── types/                    # TypeScript definitions
│   ├── utils/                    # Utilities (Supabase clients, services)
│   └── [pages]/                  # books, library, profile, record, social, story, tracker
│                                   # Each page: server page.tsx (metadata) + *PageClient.tsx (UI)
├── components/                   # React components (ui/, emails/, vault/, Provider, AuthProvider, Nav)
├── contracts/                    # Solidity smart contracts + CRE interfaces
├── cre/                          # Chainlink CRE workflows (project.yaml, secrets, workflows)
├── skills/                       # Claude Code skills (CRE templates + patterns)
├── lib/                          # Shared libraries (auth, crypto, contracts, wagmi, viem, vault/)
│   └── vault/                    # Client-side encryption: crypto.ts, db.ts (Dexie), keyManager.ts
├── scripts/                      # Hardhat deployment & utility scripts
├── middleware.ts                 # API rate limiting
├── __tests__/                    # Unit tests (Vitest)
├── e2e/                          # E2E tests (Playwright)
└── docs/                         # Detailed reference docs
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

**Adding auth to a new API route:**
```typescript
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authResult = await validateAuthOrReject(req);
  if (isAuthError(authResult)) return authResult;
  const authenticatedUserId = authResult;
  // ... route logic
}
```

**Error response pattern (never leak internals):**
```typescript
console.error("[ROUTE_NAME] Error:", err);
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

---

## Authentication

### Wallet Flow
1. User connects wallet via RainbowKit
2. Client fetches nonce: `GET /api/auth/nonce?address=0x...`
3. User signs nonce message (includes UUID nonce + timestamp)
4. Client sends signature to `POST /api/auth/login`
5. Server verifies nonce (one-time use, 5-min expiry) and signature
6. AuthProvider stores Supabase JWT in localStorage
7. All API routes verify JWT via `lib/auth.ts`

### Google OAuth Flow
1. User clicks "Sign in with Google" → Google OAuth redirect
2. Redirected to `/api/auth/callback` (validates URL against whitelist)
3. Supabase handles session, AuthProvider picks up token

### Implementation Guidelines
- **All new API routes MUST** use `validateAuthOrReject` from `lib/auth.ts`
- **Ownership checks:** Verify user owns the resource before mutations
- **Error responses:** Never return `error.message` — use generic messages
- Always consider race conditions between OAuth and wallet auth providers

---

## Architecture

### Provider Stack (components/Provider.tsx)
WagmiProvider → QueryClientProvider → RainbowKitProvider → ThemeProvider → AuthProvider → AppContext

AuthProvider sign-out calls `clearAllKeys()` (lib/vault) to wipe DEKs from memory before clearing the session.

### Smart Contracts (Base Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| **eStoryToken** | `0xf9eDD76B...` | ERC20 $STORY token, MAX_SUPPLY 100M |
| **StoryProtocol** | `0xA51a4cA0...` | Tips & paywall |
| **StoryNFT** | `0x6D37ebc5...` | ERC721 story books, mintFee 0.001 ETH |
| **PrivateVerifiedMetrics** | `0x158e08BC...` | Privacy-preserving CRE metrics (minimal on-chain proofs) |
| **VerifiedMetrics (legacy)** | `0x052B52A4...` | Old CRE metrics contract (full data on-chain, backward compat) |

- Addresses in `lib/contracts.ts`
- VerifiedMetrics uses Chainlink KeystoneForwarder (`0x82300bd7...`) for CRE report delivery

### Chainlink CRE Integration (Privacy-Preserving)

CRE (Compute Runtime Environment) provides verifiable AI analysis with privacy-preserving on-chain attestation.

**Architecture (Dual-Write):**
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

**Key files:**
| File | Purpose |
|------|---------|
| `cre/iStory_workflow/main.ts` | Workflow entry: HTTPCapability + Runner |
| `cre/iStory_workflow/gemini.ts` | Gemini AI via ConfidentialHTTPClient |
| `cre/iStory_workflow/httpCallback.ts` | 8-step handler with privacy fields + callback |
| `contracts/PrivateVerifiedMetrics.sol` | Privacy-preserving on-chain storage |
| `contracts/legacy/VerifiedMetrics.sol` | Old contract (backward compat) |
| `contracts/interfaces/` | IERC165, IReceiver, ReceiverTemplate |
| `app/api/cre/trigger/route.ts` | Triggers CRE workflow |
| `app/api/cre/callback/route.ts` | Receives full metrics from DON nodes |
| `app/api/cre/check/route.ts` | Author-filtered metrics reading |
| `app/hooks/useVerifiedMetrics.ts` | Frontend hook (metrics + proof) |
| `skills/cre/SKILL.md` | CRE SDK patterns reference |

**CRE Commands (run from `cre/` directory):**
```bash
cre workflow simulate iStory_workflow              # Local test
cre workflow simulate iStory_workflow --broadcast  # Test with on-chain write
cre workflow deploy iStory_workflow                # Deploy (requires early access)
```

**CRITICAL SDK patterns** — see `skills/cre/SKILL.md` for correct vs wrong patterns.

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
5. **NEVER initialize Supabase client at module scope** — use a lazy factory/singleton pattern to avoid build-time failures when env vars are unavailable:
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
6. **Route files can only export HTTP handlers** (GET, POST, PUT, DELETE, etc.). Extract shared logic to `lib/` files.

### Add a new page
1. Create `app/[page-name]/[PageName]PageClient.tsx` with `"use client"` (UI logic)
2. Create `app/[page-name]/page.tsx` as server component that exports `metadata` and renders the client component
3. For dynamic routes (`[id]`): use `generateMetadata()` with `createSupabaseAdminClient()` for server-side data fetching
4. Private content must return `robots: { index: false }` with no content leak in metadata
5. Update `Navigation.tsx` if needed

### Add a new Web3 hook
1. Create in `app/hooks/`, import ABI from `lib/contracts.ts`
2. Use Wagmi hooks (useReadContract, useWriteContract)

### Add vault-encrypted storage to a page
1. Wrap content with `<VaultGuard>` from `components/vault/` (handles locked/not-set-up states)
2. Use `useLocalStories()` for reactive CRUD — decrypts automatically when vault is unlocked
3. Import from `@/lib/vault` for direct crypto ops (`getDEK`, `encryptString`, `decryptString`)
4. Never call `crypto.subtle` directly — always go through `lib/vault/crypto.ts` helpers
5. Vault ops are browser-only (`window.crypto.subtle`) — never import in API routes or server components

### Update contracts after deployment
1. Deploy: `npx hardhat run scripts/deploy.ts --network baseSepolia`
2. Update `lib/contracts.ts` and `.env.local`

---

## Environment Variables

Create `.env.local` from `.env.example`. Key groups: Supabase, WalletConnect, AI Services (Gemini, ElevenLabs, Anthropic), IPFS/Pinata, Contract Addresses (Base Sepolia), Hardhat (private key, Basescan), Resend, CRON_SECRET.

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

## Performance

### Bundle Budget
Current First Load JS per page (March 2026):
- Shared (all pages): **104 kB** — wagmi + viem + RainbowKit + react-query
- Landing: **426 kB** | Record: **467 kB** | Library: **462 kB** | Profile: **498 kB** | Social: **462 kB**

Target: Keep pages under **500 kB** First Load JS. Red flag if any page exceeds this.

### What makes this app heavy (unavoidable)
- **Web3 stack** (~200 kB): wagmi + viem + RainbowKit loaded in shared Provider for wallet auth. Can't split without breaking auth flow.
- **Three.js background** (~120 kB): Already dynamically loaded (`ssr: false`), has capability detection to skip on weak devices.
- **Framer-motion** (~45 kB): Used in 19 files for animations. Replaceable with Tailwind `transition-*` classes for simple cases.

### Optimizations applied
- `next.config.mjs` → `experimental.optimizePackageImports` for `lucide-react`, `framer-motion`, `@radix-ui/*`, `date-fns`, `@supabase/supabase-js`
- Unused `recharts` dependency removed (~90 kB saved from dependency tree)
- Three.js: dynamic import with `ssr: false`, `powerPreference: 'low-power'`, `antialias: false`, DPR capped at 1.5
- Provider stack: `ProvidersDynamic` wraps all providers with `ssr: false` to avoid hydration issues

### Future optimizations (do when needed)
- Replace simple `motion.div whileHover` with Tailwind `hover:scale-105 transition-transform` (~40 kB/page)
- Replace Three.js background with pure CSS/Canvas particles (~120 kB saved)
- Split Web3 providers to only load on wallet-interactive pages (~200 kB saved on non-wallet pages)

### How to measure
- **Lighthouse**: Chrome DevTools → Lighthouse → Performance (target 70+ mobile)
- **Core Web Vitals**: https://pagespeed.web.dev with deployed URL
- **Bundle analysis**: `npm run build` output shows per-route sizes
- **Network tab**: Filter JS, sort by size to find heaviest chunks
- **React Profiler**: React DevTools browser extension → Profiler tab

### Record page loading states
The record page uses **three separate loading states** (not a single `isProcessing`):
- `isTranscribing` — ElevenLabs transcription in progress
- `isEnhancing` — AI text enhancement in progress
- `isSaving` — Cloud save + vault save in progress
- `isBusy = isTranscribing || isEnhancing || isSaving` — derived, disables all inputs
- Save button spinner only shows during `isSaving`, not during transcription/enhancement

---

## Hooks Reference

**Web3:** `useEStoryToken` (balance, approve), `useStoryProtocol` (tipCreator, payPaywall), `useStoryNFT` (mintBook)
**CRE:** `useVerifiedMetrics` (poll for CRE-attested story metrics)
**Vault:** `useVault` (setup/unlock/lock/changePin, isSetup, isUnlocked), `useLocalStories` (encrypted CRUD via IndexedDB, reactive via useLiveQuery)
**Supabase:** `useBrowserSupabase` (client singleton), `useNotifications` (CRUD + real-time polling)
**Planned:** `useStoryMetadata`, `usePatterns` — see `docs/ROADMAP.md`


