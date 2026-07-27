# iStory DApp Memory

Last updated: 2026-07-22T12:03:44.0199647-07:00

## Current State

- Active branch: `feature/mobile-stability-baseline`
- Active milestone: mobile authentication/session and offline-replay stability baseline
- Mobile development remains rooted in `mobile/`; repository-wide Git and web verification run from the monorepo root.
- Supabase token refreshes now update the mobile API token, and native foreground/background transitions start and stop automatic refresh.
- Offline replay is explicit, same-origin only, owner-scoped, idempotency-keyed, and never persists bearer tokens.
- Record drafts are keyed by user ID. Expired sessions preserve only that user's scoped draft; explicit logout/account deletion removes it.
- Expo SDK 54 dependencies are aligned and Expo Doctor passes 18/18 checks.

## Verification

- Mobile tests: 32/32 passing across 6 files.
- Mobile TypeScript: passing.
- Android Expo export: passing; 5,685 modules, 14 MB Hermes bundle.
- Root tests: passing.
- Root TypeScript: passing.
- Root Next.js production build: passing on the cached retry.

## Open Risks / Next Work

- `npm audit --omit=dev --audit-level=high` reports 60 production-tree advisories: 1 critical, 14 high, 44 moderate, 1 low. The critical package is indirect `shell-quote`; all high/critical findings are indirect. Do not run `npm audit fix --force` without a separate dependency-remediation branch because npm proposes a breaking Wagmi upgrade.
- Android export has transitive package export-map warnings from Viem/Noble, Multiformats, Ox, and Scure. The bundle still completes.
- Root build has an optional `pino-pretty` resolution warning through WalletConnect and an existing edge-runtime/static-generation warning.
- No production API caller opts into offline mutation replay yet. Add it only after the corresponding backend endpoint guarantees idempotency for the supplied key.

## Working Tree Notes

- User-owned untracked paths `docs/UI_UX_IMPLEMENTATION_GUIDE.md` and `docs/images/` predate this milestone and were left untouched.
- No commit has been created yet.
