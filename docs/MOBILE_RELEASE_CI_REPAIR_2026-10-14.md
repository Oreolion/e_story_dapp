# Mobile release CI repair - 2026-10-14

PR: https://github.com/Oreolion/e_story_dapp/pull/20

The analysis suite failed because its mocks no longer represented the route's
profile-ID resolution, nullable ownership lookup, and durable quota boundary.
The repair updates those fixtures and adds six authorization/quota regressions;
it does not remove production ownership or quota checks.

Android CI stopped in Expo Doctor before export because five SDK 54 packages
needed patch updates. Expo's compatibility installer updated their locked
versions without upgrading the SDK or React Native release line.

The candidate also includes the latest master dependency fixes, compatible
security patches for Next.js, proxy-addr and shell-quote, and deployment
verification that waits for the expected commit at `/api/health`. A healthy
response from an older production release no longer satisfies that check.

## Evidence at the implementation checkpoint

- Analysis tests: 44 passed, including all original 38 and six new regressions.
- Mobile: TypeScript passed; 36 Vitest and 12 Jest tests passed.
- Expo Doctor: 18/18 passed for the Google Play flavor.
- Root TypeScript and lint passed; existing lint warnings remain.
- Local full web test attempt: 135 tests passed, with one worker startup timeout;
  the remaining four content-safety tests are being checked separately.
- Workflow YAML and package/lockfile consistency checks passed.
- Windows web build hit restricted font-download networking and was stopped;
  a successful Linux CI build remains required.
- Android export, final dependency audits and remote CI are pending here;
  consult the later verification entry before approving a release.

## Required production prerequisite

The new APIs depend on
`supabase/migrations/019_create_content_safety_and_account_deletion.sql`.
Its absence causes quota checks to fail closed with HTTP 503 and prevents
moderation, account deletion and avatar operations from working as intended.
Applying or verifying that migration requires access to the intended production
Supabase project. Neither database access nor execution was performed by this
CI repair. Do not merge this API release solely because tests are green.

A production operator can run these read-only checks in the Supabase SQL editor:

```sql
SELECT
  to_regclass('public.content_reports') AS content_reports,
  to_regclass('public.user_blocks') AS user_blocks,
  to_regclass('public.api_rate_limits') AS api_rate_limits,
  to_regprocedure('public.consume_api_quota(uuid,text,integer,integer)') AS quota_rpc,
  to_regprocedure('public.block_user(uuid,uuid)') AS block_rpc,
  to_regprocedure('public.delete_user_account_data(uuid)') AS deletion_rpc;

SELECT relname, relrowsecurity
FROM pg_class
WHERE oid IN (
  to_regclass('public.content_reports'),
  to_regclass('public.user_blocks'),
  to_regclass('public.api_rate_limits')
);

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'avatars';
```

All six relations/functions must resolve; all three tables must have RLS on.
The avatars bucket must match the reviewed migration. These checks establish
presence/configuration only: review the applied migration definition and test
quota, reporting/blocking and deletion behavior with controlled fixtures.
Do not invoke deletion against a real customer as a smoke test.

The Android binary also requires the release prerequisites already documented
in `GOOGLE_PLAY_RELEASE_READINESS.md`: production artwork, EAS public config,
reset-password redirect, signing fingerprints, a signed AAB, physical-device
tests and Play Console preparation. A Hermes export is not a signed Play build.

## Pre-deploy security audit

All ten project audit categories were examined. This is a repository/static
review with test evidence; it is not a verification of live Supabase policies,
provider configuration or a signed mobile binary.

| # | Check | Status | Evidence or remaining limitation |
|---|---|---|---|
| 1 | Rate limits | PARTIAL | Middleware limits all API paths; new cost-bearing routes use durable quotas. Middleware memory limits reset across instances; live quota RPC is unverified. |
| 2 | RLS / database access | PARTIAL | New tables enable RLS and RPCs restrict execution to service_role; live migration and existing production schema/policies are unverified. |
| 3 | Auth guards | PARTIAL | New private routes validate auth and resolve ownership; analysis denial tests pass. Public/auth/retired routes are distinguished; live end-to-end sessions remain a release gate. |
| 4 | Input validation | PARTIAL | Report/block IDs, reasons, avatar/audio bytes and sizes are checked. Local route fixtures do not prove maximum payloads work on Vercel. |
| 5 | Outbound requests | PARTIAL | Changed AI routes use provider SDKs and bounded retries. Existing authenticated email endpoint accepts a caller-provided recipient with an in-memory limit; further abuse hardening remains. |
| 6 | Secrets | PARTIAL | No secret files/values were read. Scanned client code has no service-role usage; env exclusions and file-name-only history checks found no tracked .env/.env.local history. This is not a complete historical secret scan. |
| 7 | CORS | PASS | Middleware uses an explicit origin allowlist, with no wildcard credential policy introduced by this PR. |
| 8 | CSP / headers | PARTIAL | Security headers exist; existing script-src unsafe-inline/unsafe-eval exceptions remain. |
| 9 | Dependencies | PARTIAL | Newly identified critical packages are patched in the candidate; final audits and remaining high transitive advisories must be recorded/reviewed. No forced major upgrades were used. |
| 10 | Callbacks / redirects | PARTIAL | OAuth redirects are restricted; cron/CRE use verified service secrets. Existing payment webhook compares HMAC strings before its timing-safe fallback and merits separate hardening. |

Deploy decision at this checkpoint: **HOLD** pending production database
verification, clean Linux CI and remaining release-risk review. Keep production
at its current healthy release while those prerequisites are unresolved.

Security patch references:

- [Next.js image-optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)
- [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
- [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)
