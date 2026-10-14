# iStory DApp Memory

Last updated: 2026-10-14

## Current State

- PR #20 is open on `feature/mobile-google-play-readiness`; it is not deployed to production. Production `/api/health` reports commit `5e0047e`.
- Release CI repair is isolated in `C:\Users\HP 240 G9\AppData\Local\Temp\istory-pr20-20261014` on `feature/fix-mobile-release-ci`. The main workspace's existing `.gitignore` edit and migration guide remain untouched.
- Synced the PR with `origin/master` at `5e0047e`, including the dependency fixes from PR #19.
- Updated analysis test mocks for `resolveUserId`, ownership `maybeSingle()`, and durable quotas. Added six regressions for linked-profile resolution, ownership denial/missing/error results, quota exhaustion, and quota outage. All 44 analysis tests passed locally.
- Expo SDK 54 patch alignment resolves the Android CI blocker: Expo 54.0.37, constants 18.0.14, file system 19.0.24, updates 29.0.20, and jest-expo 54.0.18. Mobile types, 36 Vitest tests, 12 Jest tests, and Expo Doctor 18/18 passed.
- Deployment verification now checks out the successful CI commit and waits for the production health endpoint to report that commit before smoke tests or a Sentry release.
- Release dependency security patches: Next.js/ESLint 15.5.27, mobile `shell-quote` override 1.11.0, and root `proxy-addr` override 2.0.8. Final production audits report zero critical findings, with 15 root and 41 mobile high advisories still requiring risk review.
- Code-fix commit `b4f184749124fb67657d6c90b056a78d1d6b9d5b` is pushed to PR #20. All 11 remote checks passed, including 139 web tests, Linux Next.js build, mobile types/tests/Android bundle, Playwright, and Vercel preview. Local Google Play Android export also passed: 4,010 modules, 9.04 MB Hermes bundle. The successful Linux build supersedes the restricted-network Windows attempt.
- Authenticated Supabase CLI 2.120.0 is available. Read-only production checks confirmed project `qfwhtsmqndnocfidhdhy`; its hostname was independently found in the live public web bundle. The migration's three new tables and three RPCs are all absent. The avatars bucket already exists and is public, with no size/MIME restrictions.
- P0: Do not apply migration 019 unchanged. Live `stories.author_id` is TEXT; its UUID comparison at migration line 158 fails with PostgreSQL 42883 (`operator does not exist: text = uuid`), confirmed using EXPLAIN without reading customer rows. Live `verification_logs` has no `triggered_by` column, so line 169 is also incompatible. Story cascades use `author_wallet`, not `author_id`; account deletion must explicitly cover email/Google stories without a wallet.
- User explicitly authorized repairing, rehearsing and applying feature migration 019 on 2026-10-14, followed by the already requested production release. The separate Cloudflare migration remains documentation-only.
- Repaired 019 preserves TEXT/UUID IDs, explicitly deletes owned stories/comments and polymorphic reports, removes the invalid verification_logs column reference, cleans legacy wallet activity/achievements, preserves surviving social counters and revokes RPC execution from anon/authenticated explicitly. Exact PostgreSQL 17 rehearsals passed for TEXT/UUID author IDs, including wrapper/history verification and 12 concurrent quota requests allowing exactly five. Eight deletion API regressions and 44 analysis/four quota tests passed; root tsc and focused lint passed.
- Code commit `5b7cad38b7f9d397755410300a41c6dd0ac955be` contains the repair, rehearsal scripts, eight API tests and a PostgreSQL CI gate. Production 019 was applied atomically to `qfwhtsmqndnocfidhdhy`, without applying older migration gaps. Read-only verification passed all five checks: exact SQL history, RPC bodies, three RLS tables, service-only RPC grants and avatar configuration. No customer-deletion smoke tests were run. Latest PR checks/production merge are pending.
- No merge, signed EAS build, or Play submission occurred. Final documentation records the passing code commit and the production blockers in `docs/MOBILE_RELEASE_CI_REPAIR_2026-10-14.md`. Generated Android output and Supabase CLI link cache remain local and are not staged.

## Prior implementation checkpoint (2026-07-31)

- Active branch: `feature/mobile-google-play-readiness` from `origin/master` at `2bddb6a`.
- Active milestone: Google Play production-readiness implementation and release gate.
- Dependency remediation is isolated in `C:\tmp\istory-dependency-remediation-20260731` on `feature/dependency-remediation`; commit `534ed8d` is pushed to `origin/feature/dependency-remediation`, and the Play working tree was not modified by dependency work.
- The dependency branch changes only root/mobile manifests and lockfiles: Next/ESLint 15.5.22, PostCSS 8.5.25, Sharp 0.35.3, `shell-quote` 1.10.0, and an exact React test-renderer 19.1.0 pin.
- Mobile development remains rooted in `mobile/`; repository-wide Git and web verification run from the monorepo root.
- Play builds are fail-closed consumption-only: Web3, wallet, crypto, tips, paywall purchases, external purchase steering, and Google sign-in are disabled.
- The Play Metro flavor replaces disabled Reown/Wagmi/Viem modules with local no-op shims; the verified Hermes bundle dropped from 5,703 modules/11.6 MB to 4,010 modules/9.03 MB.
- UGC reporting/blocking, server-side block filtering, explicit policy consent, community guidelines, account deletion, avatar upload validation, notification consent, password reset, App Links, and durable AI/audio quotas are implemented.
- Production Expo config uses SDK 54/API 36, AAB, EAS production environment, draft/internal submission, runtime-version policy, updates URL, and least-privilege Android permissions.
- The operational release gate is `docs/GOOGLE_PLAY_RELEASE_READINESS.md`.

## Verification

- Mobile tests: 48/48 passing (36 Vitest + 12 Jest).
- Mobile TypeScript: passing.
- Expo Doctor: 18/18 checks passed; Sentry organization/project must be supplied through the production build environment.
- Google Play Android Hermes export: passing; 4,010 modules, 9.03 MB.
- Root focused tests: 10/10 passing for quotas, content safety, and App Link fingerprints.
- Root TypeScript: passing.
- Root Next.js build produced server/static manifests, then its internal type-check worker hung with no CPU progress and no `BUILD_ID`; the separately run root TypeScript check passed. A clean Linux CI build remains required.
- Dependency branch root tests: 5 files/123 tests passed with one Vitest fork; root TypeScript passed.
- Dependency branch mobile tests: 6 Vitest files/32 tests and 2 Jest suites/18 tests passed; mobile TypeScript, Expo dependency check, and Expo Doctor 18/18 passed.
- Sharp 0.35.3/libvips 8.18.3 completed an in-memory image resize/PNG encode smoke test.
- Root production audit is now 0 critical/7 high with no direct high packages; mobile production audit is now 0 critical/46 high. Remaining highs require Web3 or Expo/React Native compatibility work rather than forced audit fixes.
- A clean-master Android export timed out silently after 10 minutes on Windows; the separate Play-flavor Hermes export remains the successful bundle gate. The dependency-branch Next build also reproduced the 15-minute Windows worker hang and produced no `BUILD_ID`.

## Open Risks / Next Work

- P0: Review and merge pushed branch `feature/dependency-remediation` (`534ed8d`) to `master` first, then sync it into the Play branch. Audits now have zero criticals, but root retains 7 transitive highs and mobile retains 46 highs across Expo/React Native tooling and Web3 chains. Do not run `npm audit fix --force`; broad non-forced audit fixes were also rejected because they rewrote 200+ unrelated package versions.
- P0: Expo launcher/adaptive/splash assets are still placeholder grids and the notification icon is not an approved white-on-transparent Android small icon.
- P0: Apply `supabase/migrations/019_create_content_safety_and_account_deletion.sql` before deploying the new APIs. Local migration verification is blocked because Docker/Supabase is not running.
- P0: Deploy the web/API changes, configure App Link signing fingerprints, add the Supabase password-reset redirect, and complete a signed EAS AAB/internal-track build plus Play pre-launch/16 KB checks.
- P0: Root Next.js production build must pass in clean Linux CI; local Windows Next internal type checking hung even though standalone TypeScript passed.
- P1: Complete Play Console Data safety, IARC, target audience, reviewer access, listing copy/assets/screenshots, and staged testing requirements.

## Working Tree Notes

- User-owned untracked paths `docs/UI_UX_IMPLEMENTATION_GUIDE.md` and `docs/images/` predate this milestone and were left untouched.
- Dependency worktree is clean and tracks `origin/feature/dependency-remediation` at `534ed8d18ff1475c364dd3c1e71fd0b63ebd1e6c`.
- No PR or merge was created; the next repository action is review/merge into `master`.
- No migration, deployment, EAS build, or Play upload was performed.
