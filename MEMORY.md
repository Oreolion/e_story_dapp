# iStory DApp Memory

Last updated: 2026-07-27T08:52:33.8241520-07:00

## Current State

- Active branch: `feature/mobile-offline-story-save`
- Base commit: `2bddb6a` (PR #18 squash-merged into `origin/master`)
- Active milestone: idempotent, owner-scoped offline journal saving
- Mobile development remains rooted in `mobile/`; repository-wide Git and web verification run from the monorepo root.
- PR #18 merged the reconciled mobile stability baseline into `master`: https://github.com/Oreolion/e_story_dapp/pull/18
- `POST /api/journal/save` validates and normalizes the mobile contract, resolves the application user ID, and derives a deterministic story UUID from the resolved user plus `Idempotency-Key`.
- Duplicate-key retries return the original story only when its stored payload matches; conflicting key reuse returns HTTP 409. Existing `stories.id` primary-key uniqueness provides the atomic guard, so no database migration is required.
- Record drafts persist one request UUID. A failed offline save queues the normalized journal body under the active owner, clears the accepted draft, and replays with the same key and the current bearer token.
- Pending counts and sync results reset on account changes, stale async counts cannot overwrite the current owner, queued work syncs on online app startup/reconnection, and a global status pill exposes offline, syncing, waiting, and failed states.
- Expo SDK 54 dependencies are aligned and Expo Doctor passes 18/18 checks.

## Verification

- Mobile Vitest: 41/41 passing across 9 files.
- Mobile Jest components: 18/18 passing across 2 suites; the pre-existing PricingScreen timer `act(...)` warning remains.
- Mobile TypeScript: passing.
- Android Expo export: passing; 5,687 modules, 14 MB Hermes bundle.
- Root tests: 130/130 passing across 6 files.
- Root TypeScript: passing.
- Root Next.js production build: passing.

## Open Risks / Next Work

- `npm audit --omit=dev --audit-level=high` reports 60 production-tree advisories: 1 critical, 14 high, 44 moderate, 1 low. The critical package is indirect `shell-quote`; all high/critical findings are indirect. Do not run `npm audit fix --force` without a separate dependency-remediation branch because npm proposes a breaking Wagmi upgrade.
- Android export has transitive package export-map warnings from Viem/Noble, Multiformats, Ox, and Scure. The bundle still completes.
- Root build has an optional `pino-pretty` resolution warning through WalletConnect and an existing edge-runtime/static-generation warning.
- Device-level offline save/reconnect and account-switch behavior still needs Android and iOS smoke testing.
- The production build uploaded Sentry source maps under release `9465f4a`, because the existing Sentry configuration derives its release from the committed HEAD.

## Working Tree Notes

- User-owned untracked paths `docs/UI_UX_IMPLEMENTATION_GUIDE.md` and `docs/images/` predate this milestone and were left untouched.
- The offline-story-save milestone is committed and published on `feature/mobile-offline-story-save`.
