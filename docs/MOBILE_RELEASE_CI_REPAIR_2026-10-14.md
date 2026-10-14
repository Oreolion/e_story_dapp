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
Supabase project. The final read-only verification below found that the
migration is absent and needs compatibility repairs. No application migration
was applied. Do not merge this API release solely because tests are green.

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
| 1 | Rate limits | PARTIAL | New durable quota SQL passed PostgreSQL 17 concurrency/reset tests and its exact production definition is verified. Middleware memory limits still reset across instances; authenticated live API acceptance remains separate. |
| 2 | RLS / database access | PASS for 019 | Production-compatible 019 was rehearsed/applied; exact history/body checks, RLS and service-only RPC grants passed. This is not a complete audit of all existing database policies. |
| 3 | Auth guards | PARTIAL | New private routes validate auth and resolve ownership; analysis denial tests pass. Public/auth/retired routes are distinguished; live end-to-end sessions remain a release gate. |
| 4 | Input validation | PARTIAL | Report/block IDs, reasons, avatar/audio bytes and sizes are checked. Local route fixtures do not prove maximum payloads work on Vercel. |
| 5 | Outbound requests | PARTIAL | Changed AI routes use provider SDKs and bounded retries. Existing authenticated email endpoint accepts a caller-provided recipient with an in-memory limit; further abuse hardening remains. |
| 6 | Secrets | PARTIAL | No secret files/values were read. Scanned client code has no service-role usage; env exclusions and file-name-only history checks found no tracked .env/.env.local history. This is not a complete historical secret scan. |
| 7 | CORS | PASS | Middleware uses an explicit origin allowlist, with no wildcard credential policy introduced by this PR. |
| 8 | CSP / headers | PARTIAL | Security headers exist; existing script-src unsafe-inline/unsafe-eval exceptions remain. |
| 9 | Dependencies | PARTIAL | Final production audits: zero criticals in root/mobile, with 15 root and 41 mobile high advisories remaining for risk review. No forced major upgrades were used. |
| 10 | Callbacks / redirects | PARTIAL | OAuth redirects are restricted; cron/CRE use verified service secrets. Existing payment webhook compares HMAC strings before its timing-safe fallback and merits separate hardening. |

Deploy decision: the verified schema blocker is resolved by the authorized
execution recorded below. Merge/deploy remains gated on all final-head checks
passing. Existing partial audit findings remain documented; do not describe
this as vulnerability-free or as approval for a public mobile-store launch.

## Final verification and concrete release blocker

Verified code commit: `b4f184749124fb67657d6c90b056a78d1d6b9d5b`.
All 11 GitHub/Vercel checks passed on that commit:

- [Web CI](https://github.com/Oreolion/e_story_dapp/actions/runs/38577426172):
  139 tests, TypeScript, lint, contracts and the Linux production build passed.
- [Mobile CI](https://github.com/Oreolion/e_story_dapp/actions/runs/38577426276):
  types, both test suites, Expo Doctor and Android export passed.
- [Playwright](https://github.com/Oreolion/e_story_dapp/actions/runs/38577426121)
  and Vercel preview passed.
- Local Android export passed: 4,010 modules and a 9.04 MB Hermes bundle.
  The separate retry passed the four local content-safety tests whose worker
  had failed to start. Linux CI passed the whole web suite in a single run.

Authenticated read-only Supabase queries verified project
`qfwhtsmqndnocfidhdhy`, which also appears in the deployed public web bundle.
The following are confirmed absent:

- `content_reports`, `user_blocks`, `api_rate_limits`
- `consume_api_quota(uuid,text,integer,integer)`, `block_user(uuid,uuid)`,
  `delete_user_account_data(uuid)`

Additional live-schema findings mean the committed migration is not safe to
apply unchanged:

1. `stories.author_id` is TEXT while `users.id` is UUID. Migration line 158
   compares `author_id = p_user_id` with a UUID parameter. A read-only EXPLAIN
   reproduced PostgreSQL error 42883: `operator does not exist: text = uuid`.
2. `verification_logs` exists, but its columns are `id`, `story_id`,
   `workflow_run_id`, `status`, `error_message`, `created_at`, and `updated_at`.
   Migration line 169 references nonexistent `triggered_by`.
3. Stories cascade from `users.wallet_address` through `author_wallet`.
   There is no `stories.author_id -> users.id` FK. Deleting only the users row
   does not establish deletion of email/Google-authored stories without a wallet.
4. The avatars bucket is already public, with NULL size and MIME restrictions.
   Applying 019 would add the intended 5 MiB and JPEG/PNG/WebP restrictions.

The required next change is therefore **repair and rehearse 019**, rather than
blindly apply it: preserve existing IDs/types, use compatible ownership
comparisons, explicitly delete owned stories inside the account-data transaction,
and let their verified story FKs cascade verification logs and other children.
Validate moderation-report cleanup and email/wallet/linked-account deletion with
controlled fixtures before production execution. The current deletion route
removes storage before invoking its database RPC, so an incompatible RPC would
also risk partial deletion; include that failure path in the release tests.

The earlier migration hold was respected. No application schema or customer
data changes, PR merge, production deployment, signed EAS build or Play upload
were performed during this repair. The pending decision is authorization to
prepare the production-compatible feature migration and its execution.

## Authorized production prerequisite repair

The user authorized repairing, testing and applying feature migration 019 on
2026-10-14, then completing the production release. Earlier hold statements above
describe the previous checkpoint, not the current authorization. The Cloudflare
migration is still documentation-only.

The repaired migration preserves production IDs and column types, explicitly
deletes email/wallet-owned stories, removes orphaned polymorphic reports and
legacy wallet activity/achievements, and maintains surviving social counters.
Verification logs are removed through their verified story FK, not an invented
user column. RPC execution is explicitly revoked from anon/authenticated as well
as PUBLIC, addressing Supabase default function grants. New tables are RLS-on
and writable through the service role only.

`scripts/test-migration019.mjs` exercises PostgreSQL 17 fixtures in an isolated
Docker container without network access or published ports. It covers TEXT and
UUID author IDs, reruns, exact history/body verification, concurrent quota grants,
window reset, invalid limits, idempotent blocking/deletion, transaction rollback,
email/wallet ownership, child cleanup and unrelated account preservation. CI now
runs this rehearsal as well as the application tests. Eight deletion API tests
cover linked IDs, pagination, failures, wallet-only identities and cookie cleanup.

`scripts/apply-migration019.mjs` applies ONLY 019 to the already verified project,
inside a transaction with lock/statement timeouts and an advisory lock, recording
the exact SQL in migration history. It refuses an already recorded migration or
unexpected deletion RPC. Its `--verify` mode checks history, RPC bodies/privileges,
RLS and the avatar bucket. It does not run `db push`, apply older migrations or
delete customer fixtures. This additive schema can coexist with the old release;
on an application rollback leave the new tables/RPCs in place. Existing bucket
limits before this change were NULL; restore those separately only if needed.

Storage, relational data and Supabase Auth cannot share one atomic transaction.
The existing deletion API stops before DB/auth deletion on media failure and
does not report success on DB/auth failure, but earlier stages can have completed.
The new failure tests verify that limitation rather than claiming cross-service
atomicity. Operators must reconcile a reported partial deletion; automatic
durable retry orchestration is outside this narrow CI/schema repair.

Application dependencies still have the previously documented high advisories.
A signed AAB, physical-device checks, account-deletion acceptance testing and
Play Console readiness remain gates for a mobile-store launch, independently
of publishing the web/API release. No public Play submission is authorized by
this migration approval.

### Production schema execution evidence

Repaired code commit: `5b7cad38b7f9d397755410300a41c6dd0ac955be`.
The exact production wrapper passed a fresh PostgreSQL 17 rehearsal for both
author types. Twelve simultaneous service-role quota calls allowed exactly five,
and deletion preserved unrelated accounts/content. The eight API regressions,
44 analysis tests, four quota tests, root TypeScript and focused lint passed.

Migration 019 was then committed atomically on production project
`qfwhtsmqndnocfidhdhy`, with its exact SQL recorded in migration history and
PostgREST schema reload notified. No historical migration gaps were applied and
no customer deletion was invoked. Read-only verification returned true for:

- exact migration-history SQL;
- all three RPC bodies matching the reviewed file;
- all three tables present with RLS enabled;
- service-role RPC access with anon/authenticated execution denied;
- avatar bucket public/5 MiB/JPEG-PNG-WebP configuration.

The old web/API release remained available during this additive schema change.
Final-head CI and application production deployment are pending at this entry.

Security patch references:

- [Next.js image-optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)
- [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
- [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)
