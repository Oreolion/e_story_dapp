# Development Roadmap (MVP Evolution)

## Phase 1: Story Metadata Foundation -- COMPLETE

**Goal:** Every story gets automatically analyzed and tagged.

**Tasks:**
- [x] Create `story_metadata` table in Supabase with RLS
- [x] Add `StoryMetadata` types to `app/types/index.ts`
- [x] Build `/api/ai/analyze` endpoint using Gemini Flash
- [x] Integrate analysis trigger into `/api/journal/save` flow
- [x] Display basic insights on story detail page (`app/story/[storyId]/page.tsx`)
- [x] Write backfill script for existing stories
- [x] Add loading states for analysis

**Key files created/modified:**
```
app/api/ai/analyze/route.ts          (created)
app/api/journal/save/route.ts        (modified - triggers analysis)
app/story/[storyId]/page.tsx         (modified - displays insights)
app/types/index.ts                   (modified - StoryMetadata types)
components/StoryInsights.tsx         (created - insights display component)
scripts/backfill-metadata.ts         (created - one-time migration)
```

## Phase 1.5: Validation & Hardening -- COMPLETE

**Goal:** Ensure Phase 1 implementation is robust with comprehensive tests and security.

**Tasks:**
- [x] Task 1.5.0: Setup Claude SDK thinking agent utility (`scripts/think.ts`)
- [x] Task 1.5.1: Create comprehensive test suite for `/api/ai/analyze` endpoint (38 tests, 100% coverage)
- [x] Task 1.5.2: Create test suite for `StoryInsights` component (41 tests)
- [x] Task 1.5.3: Security audit remediation (34 findings, 8 phases)
- [x] Task 1.5.4: Replace mock endpoints with real DB implementations (journal/save, social/like, user/profile)

**Key files created/modified:**
```
scripts/think.ts                           (Claude SDK thinking agent)
__tests__/api/analyze.test.ts              (38 tests for analyze endpoint)
__tests__/components/StoryInsights.test.tsx (41 tests for insights component)
lib/auth.ts                                (shared auth middleware)
lib/crypto.ts                              (timing-safe comparison)
middleware.ts                              (rate limiting)
app/api/auth/nonce/route.ts                (nonce generation)
scripts/verify-deployment.ts               (contract deployment verification)
```

## Phase 1.6: Chainlink CRE Integration -- COMPLETE

**Goal:** Verifiable AI-attested story metrics via Chainlink DON nodes.

**Tasks:**
- [x] Set up CRE CLI project structure (`cre/eStory_workflow/`)
- [x] Build CRE workflow: HTTP trigger → Gemini AI → DON consensus → on-chain write
- [x] Create ReceiverTemplate interfaces (`contracts/interfaces/`)
- [x] Rewrite VerifiedMetrics.sol to extend ReceiverTemplate
- [x] Deploy VerifiedMetrics to Base Sepolia (`0x052B52A4841080a98876275d5f8E6d094c9E086C`)
- [x] Verify contract on Sourcify
- [x] Build trigger API route (`/api/cre/trigger`)
- [x] Build check API route (`/api/cre/check`)
- [x] Build frontend hook (`useVerifiedMetrics`) with polling
- [x] Build display components (`VerifiedBadge`, `VerifiedMetricsCard`)
- [x] Test simulation with --broadcast (end-to-end on-chain write confirmed)
- [x] Update CRE skill templates with correct SDK patterns
- [ ] Pending: CRE workflow deployment (awaiting Chainlink early access approval)

**Key files created/modified:**
```
cre/eStory_workflow/main.ts               (CRE workflow entry point)
cre/eStory_workflow/gemini.ts             (Gemini AI with HTTPClient consensus)
cre/eStory_workflow/httpCallback.ts       (Full handler: parse → analyze → sign → write)
contracts/VerifiedMetrics.sol             (ReceiverTemplate-based receiver)
contracts/interfaces/                      (IERC165, IReceiver, ReceiverTemplate)
app/api/cre/trigger/route.ts              (Trigger verification)
app/api/cre/check/route.ts               (Read results from contract)
app/hooks/useVerifiedMetrics.ts           (Frontend polling hook)
components/VerifiedBadge.tsx              (Verification badge)
components/VerifiedMetricsCard.tsx        (Metrics display)
lib/contracts.ts                          (Updated ABI + address)
scripts/deployVerifiedMetrics.ts          (Deployment script)
skills/cre/                               (CRE skill templates + SKILL.md)
```

## Phase 1.6.1: Privacy-Preserving CRE -- COMPLETE

**Goal:** Rewrite CRE pipeline to protect user privacy. Full metrics visible only to author; blockchain stores only cryptographic proofs.

**Tasks:**
- [x] Create `PrivateVerifiedMetrics.sol` — minimal on-chain struct (tier, threshold, hashes)
- [x] Move old contract to `contracts/legacy/VerifiedMetrics.sol`
- [x] Create deployment script `scripts/deployPrivateVerifiedMetrics.ts`
- [x] Rewrite `gemini.ts` to use `ConfidentialHTTPClient` (encrypted enclave)
- [x] Rewrite `httpCallback.ts` — 8-step flow with privacy fields + confidential callback
- [x] Add `callbackUrl` and `owner` to Config type
- [x] Create `/api/cre/callback` route (DON callback receiver with secret auth)
- [x] Rewrite `/api/cre/check` with author-based response filtering + legacy fallback
- [x] Update `lib/contracts.ts` with new ABI
- [x] Rewrite `useVerifiedMetrics` hook (metrics + proof separation)
- [x] Rewrite `VerifiedMetricsCard` (dual author/public view)
- [x] Update `VerifiedBadge` with quality tier label
- [x] Update `StoryPageClient` and `StoryCard` component props
- [x] Update middleware rate limits for callback endpoint
- [x] Update all documentation
- [ ] Pending: Deploy new contract (requires funded wallet)
- [ ] Pending: Update CRE workflow secrets for Vault DON

**Key files created/modified:**
```
contracts/PrivateVerifiedMetrics.sol          (new — privacy-preserving contract)
contracts/legacy/VerifiedMetrics.sol          (moved — backward compat)
scripts/deployPrivateVerifiedMetrics.ts       (new — deployment script)
cre/iStory_workflow/gemini.ts                (rewritten — ConfidentialHTTPClient)
cre/iStory_workflow/httpCallback.ts          (rewritten — 8-step privacy flow)
cre/iStory_workflow/main.ts                  (modified — Config type)
cre/iStory_workflow/config.staging.json      (modified — callbackUrl, owner)
app/api/cre/callback/route.ts                (new — DON callback receiver)
app/api/cre/check/route.ts                  (rewritten — author-based filtering)
app/hooks/useVerifiedMetrics.ts              (rewritten — metrics + proof)
components/VerifiedMetricsCard.tsx           (rewritten — dual view)
components/VerifiedBadge.tsx                 (modified — tier label)
lib/contracts.ts                             (modified — new ABI)
middleware.ts                                (modified — callback rate limit)
```

## Phase 2.2: Local Vault (Client-Side Encrypted Storage) -- COMPLETE

**Goal:** PIN-protected AES-256-GCM encrypted local storage with offline capability.

**Tasks:**
- [x] Create `lib/vault/crypto.ts` — PBKDF2 key derivation, AES-KW wrapping, AES-GCM encryption
- [x] Create `lib/vault/db.ts` — Dexie.js IndexedDB schema (stories, vaultKeys, syncQueue)
- [x] Create `lib/vault/keyManager.ts` — DEK lifecycle (setup, unlock, lock, changePin)
- [x] Create `lib/vault/index.ts` — barrel export
- [x] Create `app/hooks/useVault.ts` — React state wrapper for vault lifecycle
- [x] Create `app/hooks/useLocalStories.ts` — encrypted CRUD with useLiveQuery reactive updates
- [x] Create `components/vault/PinEntryModal.tsx` — 6-digit PIN entry with confirm flow
- [x] Create `components/vault/VaultGuard.tsx` — gate component requiring unlock
- [x] Create `components/vault/VaultSettings.tsx` — setup/unlock/lock/change-PIN UI
- [x] Integrate into RecordPageClient — dual-write (cloud first, vault additive/non-blocking)
- [x] Integrate into ProfilePageClient — VaultSettings in profile settings panel
- [x] Integrate into AuthProvider — clearAllKeys() called on sign-out
- [x] Unit tests — 27 tests (12 crypto, 15 keyManager)

**Key files created/modified:**
```
lib/vault/crypto.ts                     (new — AES-256-GCM + PBKDF2 + AES-KW)
lib/vault/db.ts                         (new — Dexie.js IndexedDB schema)
lib/vault/keyManager.ts                 (new — DEK lifecycle)
lib/vault/index.ts                      (new — barrel export)
app/hooks/useVault.ts                   (new — vault React hook)
app/hooks/useLocalStories.ts            (new — encrypted story CRUD hook)
components/vault/PinEntryModal.tsx       (new — PIN entry UI)
components/vault/VaultGuard.tsx          (new — vault gate component)
components/vault/VaultSettings.tsx       (new — vault settings panel)
app/record/RecordPageClient.tsx          (modified — vault dual-write after cloud save)
app/profile/ProfilePageClient.tsx        (modified — VaultSettings in settings tab)
components/AuthProvider.tsx              (modified — clearAllKeys on sign-out)
__tests__/vault/crypto.test.ts           (new — 12 encryption tests)
__tests__/vault/keyManager.test.ts       (new — 15 key lifecycle tests)
__tests__/setup.ts                       (modified — IndexedDB + crypto polyfills)
```

## Phase 2.6: Quick Fixes & Auth Hardening -- COMPLETE

**Goal:** Fix known issues and harden auth before moving to new features.

**Tasks:**
- [x] Fix waitlist email URL → `estories.app` (production domain)
- [x] Fix welcome email URL → `estories.app`
- [x] Add auth guard (`validateAuthOrReject`) to `/api/ai/reflection` GET and POST
- [x] Add client-side short text guard (< 50 chars) on RecordPage — show toast instead of silent failure
- [x] Update all docs/README with storytelling platform positioning (not just journaling)
- [x] Run Supabase migrations: `005_create_waitlist.sql`, `006_create_verified_metrics_tables.sql`, `007_add_actionable_advice_and_story_collections.sql`
- [x] Auth overhaul: Google/OAuth first in AuthModal, OnboardingModal for all new users (including Google), prefill name/email
- [x] Story collections: `parent_story_id` for story continuation/series, collection CRUD, collection detail page
- [x] Pricing page with affordable tiers + FAQ
- [x] Rebrand eStory → eStories across all user-facing text (~25 files)
- [x] Logo boldness: darker page fills, edge strokes, thicker spine shadows

## Phase 2: Patterns & Discovery -- COMPLETE

**Goal:** Users can see patterns across their stories.

**Tasks:**
- [x] Add "Themes" tab to Library page with story grouping
- [x] Add "Life Domains" grouping view with distribution chart
- [x] Implement "Mark as Canonical" button on story detail (CanonicalBadge)
- [x] Create monthly summary component (MonthlySummary)
- [x] Add visual indicators for canonical stories in lists
- [x] usePatterns hook with theme groups, domain groups, canonical stories, monthly summary

**Key files created/modified:**
```
app/library/LibraryPageClient.tsx             (modified — Themes + Domains tabs)
components/patterns/ThemesView.tsx            (new — expandable theme cards)
components/patterns/DomainsView.tsx           (new — domain distribution + cards)
components/patterns/MonthlySummary.tsx         (new — monthly stats)
components/CanonicalBadge.tsx                  (new — mark as important)
app/hooks/usePatterns.ts                       (new — pattern data hook)
```

## Phase 3: AI Reflection & Actionable Advice -- COMPLETE

**Goal:** AI generates insights about the user's life patterns and provides actionable advice based on analyzed themes.

**Tasks:**
- [x] Create `weekly_reflections` table
- [x] Build `/api/ai/reflection` endpoint
- [x] Add auth guard to reflection endpoint
- [x] Display reflection on Profile page (WeeklyReflectionSection)
- [x] useReflection hook for fetching/triggering reflections
- [x] AI actionable advice in analyze endpoint (actionable_advice field per story)
- [ ] Weight canonical stories higher in reflection — future refinement
- [ ] Storytelling craft feedback: Track narrative quality improvement over time — future

**Key files created/modified:**
```
app/api/ai/reflection/route.ts       (modified — auth guard added)
app/api/ai/analyze/route.ts          (modified — actionable_advice field)
app/profile/ProfilePageClient.tsx     (modified — WeeklyReflectionSection)
components/WeeklyReflection.tsx       (new)
app/hooks/useReflection.ts           (new)
```

## Phase 4: Story Collections & Continuations -- COMPLETE

**Goal:** Users can create story series and add continuations to existing stories.

**Tasks:**
- [x] Add `parent_story_id` column to stories table (migration 007)
- [x] Create `story_collections` + `collection_stories` tables (migration 007)
- [x] API routes: `/api/stories/collections` (CRUD), `[collectionId]` (detail), `[collectionId]/stories` (add/remove)
- [x] UI for "Continue this story" on story detail page
- [x] Collection view page (`/library/collections/[collectionId]`)
- [x] Collections tab in Library page with create/delete
- [ ] NFT minting for collections (thematic book compilation) — future

**Key files created/modified:**
```
supabase/migrations/007_add_actionable_advice_and_story_collections.sql  (new)
app/api/stories/collections/route.ts                                      (new)
app/api/stories/collections/[collectionId]/route.ts                       (new)
app/api/stories/collections/[collectionId]/stories/route.ts               (new)
app/story/[storyId]/StoryPageClient.tsx                                   (modified — "Continue Story" button)
app/record/RecordPageClient.tsx                                           (modified — continuation banner + parent_story_id)
app/library/LibraryPageClient.tsx                                         (modified — Collections tab)
app/library/collections/[collectionId]/CollectionPageClient.tsx           (new)
app/library/collections/[collectionId]/page.tsx                           (new)
```

## Phase 5: Pricing & Monetization -- COMPLETE

**Goal:** Affordable pricing tiers and a sustainable creator economy.

**Tasks:**
- [x] Design pricing page with Free / Storyteller / Creator tiers
- [x] FAQ page addressing common questions (10 FAQs)
- [ ] Implement subscription logic (Stripe integration) — future
- [ ] Enhanced paywall analytics for creators — future

**Key files created:**
```
app/pricing/page.tsx                  (new — server component with metadata)
app/pricing/PricingPageClient.tsx     (new — pricing cards, features, FAQ)
```

## Phase 6: Onboarding Overhaul -- COMPLETE

**Goal:** Production-ready onboarding with OAuth-first auth and vault setup.

**Tasks:**
- [x] OAuth/Google sign-in as primary entry (reordered in AuthModal: Google first, wallet second)
- [x] Google users now go through OnboardingModal (pick username, pre-filled name/email)
- [x] Fixed empty onComplete callback in AuthButton (was no-op, now redirects to /onboarding)
- [x] Dedicated onboarding page/flow (`/onboarding` — multi-step with progress bar)
- [x] Vault setup step during onboarding (optional PIN setup for encrypted local storage)
- [x] Optional wallet connection step (for Google users who want Web3 features)
- [x] Progressive disclosure: steps reveal features incrementally, Web3 is clearly optional
- [x] Contribution heatmap fix: dynamic month labels with year, data covers full 365-day grid

**Key files created/modified:**
```
app/onboarding/page.tsx                 (new — server component with metadata)
app/onboarding/OnboardingPageClient.tsx (new — multi-step onboarding flow)
components/AuthButton.tsx               (modified — redirect to /onboarding instead of inline modal)
app/profile/ProfilePageClient.tsx       (modified — heatmap data + dynamic month labels)
```

## Monetization Architecture (Current)

**Two independent payment systems:**

| System | Currency | Status | Purpose |
|--------|----------|--------|---------|
| **Subscriptions** | USDC via Blockradar | **Live** (mainnet) | Monthly plans ($2.99/$7.99) for premium features |
| **Token economy** | $STORY (ERC-20) | **Testnet** (disabled in UI) | Tips, paywalls, NFT minting |

**Current state:**
- Subscriptions process real USDC on Base via Blockradar wallet infrastructure
- Tips, paywalls, and NFT minting buttons are visible but disabled ("Coming soon")
- $STORY token contracts remain deployed on Base Sepolia testnet only
- All smart contract code is preserved — no code removed, only UI disabled

**Mainnet migration criteria for token economy:**
- 100+ registered users (minimum viable community)
- Subscription system stable for 4+ weeks
- Then: deploy $STORY, StoryProtocol, StoryNFT contracts to Base mainnet
- Tips/paywalls will use USDC on-chain (direct wallet-to-wallet via contract)
- $STORY token becomes optional governance/loyalty layer
- No liquidity pool until sufficient adoption warrants it

**To re-enable token features:** Remove `disabled`, `opacity-50`, `cursor-not-allowed` classes and "Coming soon" labels from:
- `app/story/[storyId]/StoryPageClient.tsx` — tip button, mint button, paywall unlock
- `components/StoryCard.tsx` — tip button, paywall unlock
- `app/profile/ProfilePageClient.tsx` — daily journal mint button
- Reconnect `handleTip`, `handleMintStory`, `handleUnlock` handlers

## Phase 2.9: Nav Dropdown Wallet Status & OAuth Fixes -- COMPLETE

**Goal:** Improve wallet connection UX and fix OAuth redirect for local development.

**Tasks:**
- [x] Add wallet status to nav dropdown — shows "Wallet: 0x12...ab" (green check) when linked, or "Connect Wallet" button when not
- [x] Fix OAuth redirect: `localhost:3000/api/auth/callback` added to Supabase allowed redirect URLs
- [x] Fix `auth_error=missing_code` URL noise — callback now silently redirects home for implicit flow (no `?code`)
- [x] Document implicit OAuth flow decision and PKCE migration plan

**Key files modified:**
```
components/AuthButton.tsx               (wallet status in dropdown)
app/api/auth/callback/route.ts          (graceful handling of missing code)
docs/DECISIONS.md                       (implicit flow + wallet dropdown decisions)
```

**Pending (next priority):**
- [ ] Migrate OAuth from implicit flow to PKCE (security — see memory `oauth-pkce-migration.md`)

## Future Phases (Post-MVP)

- Vault → Cloud sync (process syncQueue, upload encrypted stories to Supabase storage)
- Multi-device vault recovery via `getWrappedKeyMaterial` / `importWrappedKeyMaterial`
- Graph-based memory (theme -> story relationships)
- Topic-driven story discovery (History, Culture, Geopolitics, Science, Philosophy categories)
- Storytelling progression tracking (narrative quality improvement over time)
- Memory API for external AI agents
- Default to private with public opt-in
- Only canonical stories can be shared publicly
- ERC-8004 agent identity integration (speculative)

## Privacy & Sharing Model (Target State)

| Story Type | Default Visibility | Can Be Shared | Can Be Minted |
|------------|-------------------|---------------|---------------|
| Regular story | Private | Yes (opt-in) | No |
| Canonical story | Private | Yes (opt-in) | Yes |
| Shared story | Public | Already shared | If canonical |
| Vault story | Device-local only | Opt-in sync | If canonical |

### Navigation Hierarchy (Target State)

```
Primary:   Record -> Archive -> Patterns -> Profile
Secondary: Community Stories (social feed)
```

The social feed should be a discovery mechanism, not the core loop.
