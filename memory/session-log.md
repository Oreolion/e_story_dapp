# Session Log

## 2026-07-22 — Codex — Mobile Stability Baseline

Timestamp: 2026-07-22T12:03:44.0199647-07:00

### Completed

- Confirmed the monorepo root is the correct Git/backend working directory and `mobile/` is the Expo application root.
- Created `feature/mobile-stability-baseline` from `master`.
- Repaired the mobile dependency install and aligned Expo SDK 54 package versions.
- Added mobile test/typecheck scripts and a stable single-worker Vitest configuration for this Windows environment.
- Added Supabase session-token synchronization and native AppState refresh lifecycle handling.
- Reworked offline replay to require an explicit owner and idempotency key, reject external URLs, omit authorization headers, isolate account queues, and retain exhausted requests for recovery.
- Added fail-closed local cleanup for logout, account deletion, and signed-out sessions.
- Scoped recording drafts by account to prevent cross-account disclosure.
- Added regression coverage for auth refresh/sign-out, AppState transitions, queue policy, owner isolation, token stripping, retry retention, legacy queue rejection, and draft ownership.

### Verification Results

- `mobile/npm test`: pass — 6 files, 32 tests.
- `mobile/npm run typecheck`: pass.
- `mobile/npx expo-doctor`: pass — 18/18 checks.
- `mobile/npx expo export --platform android --output-dir dist --max-workers 1`: pass.
- Root `npm test -- --reporter=dot`: pass; existing `StoryInsights` act warnings remain.
- Root `npx tsc --noEmit`: pass.
- Root `npm run build`: pass on cached retry; warnings documented in `MEMORY.md`.
- `git diff --check`: pass; only Windows LF/CRLF notices.

### Security / Dependency Follow-up

- Production-tree audit is not clean: 60 indirect advisories, including critical `shell-quote` and 14 high findings.
- Remediation should be handled separately with Expo/Reown/Wagmi compatibility checks; a forced audit fix proposes breaking dependency changes.

### Next Actions

1. Review and commit the mobile milestone on `feature/mobile-stability-baseline`.
2. Open a separate dependency-remediation task/branch for the audit findings.
3. Define backend idempotency semantics before opting any production mutation into offline replay.
4. Run device-level sign-in, token refresh, background/foreground, offline recovery, logout, and account-switch smoke tests on Android and iOS.

## 2026-07-27 — Codex — Idempotent Offline Story Save

Timestamp: 2026-07-27T08:52:33.8241520-07:00

### Completed

- Reconciled `feature/mobile-stability-baseline` with `origin/master` after confirming the previously merged GitHub change was PR #14, not the local stability milestone.
- Resolved only the expected mobile test dependency/config conflicts, pinned Jest Expo to the Expo SDK 54 line, committed the stability baseline as `f0f11ac`, created merge commit `9465f4a`, pushed the branch, and opened draft PR #18.
- Created `feature/mobile-offline-story-save` from the reconciled commit so the next milestone remains isolated.
- Hardened `app/api/journal/save/route.ts` with Zod validation, application-user resolution, legacy snake-case normalization, complete story-field persistence, paid continuation checks, deterministic owner-scoped UUIDs, replay-safe duplicate handling, and HTTP 409 conflict detection.
- Added `__tests__/api/journal-save.test.ts` for invalid input/key rejection, mobile field mapping, deterministic UUID shape, safe replay, conflicting replay, and continuation plan enforcement.
- Added `mobile/lib/storySave.ts` so the app sends the exact camel-case API contract and only marks audio present when upload returned a URL.
- Updated `mobile/app/(tabs)/record.tsx` to persist a UUID with each account-scoped draft, opt journal saves into the owner-scoped offline queue, reject account changes during an in-flight save, distinguish queued versus server-saved outcomes, and reset all story-scoped state after acceptance.
- Cleared in-memory editor/media state when owners change so a mounted record screen cannot retain the prior account's draft or active audio resources.
- Aligned mobile tag limits with the API and restricted persisted audio URLs to HTTP(S).
- Updated `mobile/lib/offline.ts` so failed replay attempts are reported immediately while their requests remain recoverable.
- Updated `mobile/stores/syncStore.ts` and `mobile/hooks/useOfflineSync.ts` to prevent stale cross-account counts/results, sync queued work at online startup and reconnection, and avoid continuous failed-retry loops.
- Added `mobile/components/SyncStatusBanner.tsx` and mounted it in `mobile/app/_layout.tsx` to expose offline, syncing, queued, and failed states globally.
- Added mobile regression tests for request mapping, audio fallback, queue failure accounting, owner-switch races, stale sync completion, and sync-status messaging.

### Verification Results

- Focused journal API test: pass — 7/7.
- Mobile Vitest: pass — 9 files, 41 tests.
- Mobile Jest components: pass — 2 suites, 18 tests; existing PricingScreen timer `act(...)` warning remains.
- Mobile `npm run typecheck`: pass.
- Mobile `npx expo-doctor`: pass — 18/18 checks; expected local Sentry configuration notice remains.
- Android Expo export: pass — 5,687 modules and a 14 MB Hermes bundle, written to `C:\tmp\istory-mobile-export-final-9465f4a`.
- Root tests: pass — 6 files, 130 tests; existing test-console warnings remain.
- Root TypeScript: pass using direct Node invocation with explicit memory after stale Windows workers were stopped.
- Root `npm run build`: pass; existing lint, WalletConnect `pino-pretty`, edge-runtime, and Sentry source-map warnings remain.
- `git diff --check`: pass; only Windows LF/CRLF notices.

### Findings / Decisions

- No migration is needed: the existing `stories.id` UUID primary key atomically serializes retries when the API derives that ID from the resolved user and idempotency key.
- A duplicate key is not automatically considered success. The stored story must match every request-owned field before the route returns `replayed: true`.
- The mobile queue remains an explicit opt-in; only the journal-save call opts in after the endpoint gained idempotency.
- Owner IDs scope local queue visibility/replay, while the server independently derives the authoritative application user from the current access token.

### Pending

1. Open a focused pull request from `feature/mobile-offline-story-save` to `master`.
2. Run physical Android and iOS smoke tests for save-while-offline, cold-start replay, reconnection replay, failed replay visibility, and account switching.
3. Handle production dependency advisories in a separate compatibility-focused branch.

### Working Tree

- Offline-save implementation and checkpoint files are committed and published on `feature/mobile-offline-story-save`.
- User-owned untracked `docs/UI_UX_IMPLEMENTATION_GUIDE.md` and `docs/images/` remain untouched and must not be staged with this feature.
