# Staging setup and repeatable verification

## Current state — 2026-11-21

Production was released separately at commit `a2cb94cd51142df65e2879ba67c54fbfc00abfb6`. Staging preparation does not require another production database migration, payment change, or production pause.

There is **no provisioned hosted staging environment**. The Supabase CLI lists iStory (`qfwhtsmqndnocfidhdhy`) and eBrain (`lgwdyntmtkwmpgenecrf`) as active. The signed-in RA organization billing page confirms the Free plan. Supabase allows two active free projects across organizations; paused projects do not consume a slot. No project was paused, restored, repurposed, or purchased during this work. See [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

The owner must choose between retaining both projects and using isolated local/CI checks for now, or explicitly authorizing eBrain to be paused so a new dedicated staging project can be created. Pausing eBrain would make its database unavailable. Do not try to evade the account limit by creating another organization.

This branch strengthens the future hosted check. It does not provision resources or establish hosted acceptance. Its tests use synthetic HTTP responses and no external services.

Fresh-bootstrap implementation added on 2026-11-22: the commands below now rehearse the complete fresh schema locally and on PostgreSQL 17 in CI. This does not allocate hosted resources or authorize applying SQL to an existing project.

## Fresh-database rehearsal

With the committed dependencies installed and a supported Node executable:

```powershell
node --test scripts/staging-bootstrap.test.mjs
node scripts/rehearse-staging-bootstrap.mjs
```

The default rehearsal creates a new in-memory PostgreSQL instance. It needs no Docker, Supabase login, database password, environment files or model credentials. It accepts no connection URL or remote-project argument. There are no paid provider calls, emails, mainnet operations or customer records.

CI also runs `node scripts/rehearse-staging-bootstrap.mjs --postgres17`. That mode requires the CI context and its exact pinned, labelled, network-isolated PostgreSQL test container. It creates a unique synthetic database, rather than selecting an existing application database. It performs no database/container deletion; the job-owned container expires with its runner. This mode is for CI, not an instruction to set CI flags on a production machine.

The bootstrap refuses pre-existing public app objects, migration history, auth users, buckets/media or unsafe database roles. The lock and catalog checks use a controlled search path. It applies migrations 000–023 and missing-schema additions in **one transaction**, then records source/applied SQL hashes and a private bootstrap manifest. A second invocation is rejected. Tests inject a failure after the final migration to verify that tables, history and bucket metadata all roll back.

Historical migration files remain unchanged. The builder omits only migration 014's hash-pinned legacy follows-table deletion block, which is unnecessary on an empty database. It removes the reviewed outer transaction wrappers from 020–023 so that they participate in the single bootstrap transaction. Both adaptations are visible in the manifest and applied migration statements. Unknown migration inventory or a changed deletion block fails closed.

`ops/staging/fresh-schema-gaps.sql` supplies the books table/FK/index used by the application, profile location/website fields, numeric story IDs and nullable wallet references for OAuth-only reflections. Final hardening enables RLS on all 28 app tables and restricts direct client privileges; existing Auth/Storage and extension-object ownership/ACLs are preserved. Future functions created by the bootstrap owner have their global PUBLIC default execution privilege removed as well: a schema-scoped revoke alone cannot cancel PostgreSQL's global default. Review that creator-role default policy during any future hosted adapter implementation.

Synthetic probes exercise OAuth-profile creation, journal save and generated ID, automatic queueing, worker claim/completion, persisted metadata, counters, book creation, a walletless reflection and account deletion. Their records and call-budget rows are rolled back. Separate real-role tests cover direct access denial, existing-state preservation, future default privileges, private audio upload/overwrite restrictions and unchanged extension/Auth function ACLs.

The runner writes `output/staging/fresh-bootstrap-embedded.json`; CI also writes `fresh-bootstrap-postgres17.json` and uploads both as a commit-bound workflow artifact. Each attempt first replaces any prior receipt with `IN_PROGRESS`; failure records `FAILED` and exits nonzero. Only `FRESH_BOOTSTRAP_REHEARSED` from the successful current run is rehearsal evidence. The receipt includes SQL/probe hashes, source migration hashes, engine version and counts, with `hostedSetupVerified: false`.

These fixtures model the Auth/Storage database contracts; they do not run Supabase's managed Auth or Storage services. Bucket metadata is installed only in these fresh synthetic databases. Hosted bucket creation must use supported provider setup and separately verified permissions. No hosted installer or SQL-editor command is shipped by this step.

Before hosted application acceptance, audit the remaining direct SDK book/chapter/parent queries in `lib/queries/hooks.ts` and the direct book write in `app/profile/ProfilePageClient.tsx`. The bootstrap uses server-only private app-data permissions; those legacy browser paths must not be made to pass by reopening private tables. Database CRUD/probe success is not evidence that those UI journeys work. Route them through appropriately authorized APIs or explicitly limit the accepted hosted scope in the next application iteration.

## Available now: synthetic local/CI acceptance

Use a clean feature worktree based on current `origin/master`. Install the committed dependencies with the supported Node version (CI uses Node 22); do not copy local environment files. The existing isolated verifier excludes environment and credential files and supplies synthetic configuration.

```powershell
node scripts/verify-isolated.mjs --types
node scripts/verify-isolated.mjs --evaluations
node scripts/verify-isolated.mjs --build
```

Run these sequentially on a memory-constrained machine. The build mode compiles a new local artifact, fingerprints it, starts its own localhost server, runs Chromium and Firefox acceptance, and stops that server. These checks do not prove a hosted login, deployed storage permissions, or real payment/inference behavior.

For hosted runners, push a short-lived `feature/*` branch to trigger existing CI. CI runs the deterministic AI evaluations, route/database tests, PostgreSQL concurrency/migration rehearsals, build and local browser acceptance. Review every required job for the **same full SHA**. The reusable `AI correctness evaluations` workflow can also be dispatched independently. No live inference or LangSmith publication is required. Existing CI usage allowances still apply.

## Provision hosted staging once a free slot is confirmed

1. Create a **new** Supabase staging project. Record its ref and organization. Never reuse production, eBrain, a paused unrelated project, or a production backup. Start with no customer records, media, or auth users.
2. Run the fresh-bootstrap rehearsals above for the exact candidate, then prepare a separately target-bound hosted adapter. Do not blindly run the historical migration directory: it contains legacy assumptions, including migration 016 referencing `books` without a corresponding creation migration. The builder supplies that schema gap for fresh fixtures. Embedded/PostgreSQL 17 passes still do not establish managed Supabase setup, target identity or hosted Auth/Storage behavior.
3. Create a **dedicated Vercel staging project**, with a separate `*.vercel.app` origin and Vercel Authentication enabled for its deployments and project alias. Confirm the provider's effective protection settings. Keep its Git project identity and database ref separate from production. Do not promote the staging build to production: public environment values are compiled into it.
4. Configure the values below through the providers' protected interfaces. Use only keys created for staging. Do not copy production API keys, bypass credentials, signing secrets, cookies or worker credentials.
5. Configure Supabase Auth callback URLs only for the staging origin. If OAuth provider configuration is unavailable, record that authenticated browser acceptance remains pending; do not loosen redirects or use a production database to make login pass.
6. Use dedicated synthetic test accounts and bounded fixtures. Verify sign-in, save, reload, privacy between accounts, mock job completion/failure/retry behavior, logout and denial after logout. Keep payments disabled. External transcription, TTS and publication are intentionally unavailable outside production; test the explicit unavailable behavior.
7. Record the Vercel project/deployment IDs, full commit SHA, database ref, deployment protection and non-secret configuration readback. Run the hosted binding check below, then the actual authenticated browser journeys. A green binding check alone is not application acceptance.

### Initial staging configuration

| Setting | Value or rule |
| --- | --- |
| `APP_ENV` | `staging` |
| `APP_RELEASE_MODE` | `active`, after staging bootstrap checks |
| `APP_FRONTDOOR_MODE` | `open`, after staging bootstrap checks |
| `NEXT_PUBLIC_APP_URL` | Dedicated staging HTTPS origin |
| `NEXT_PUBLIC_SUPABASE_URL` | New staging Supabase origin |
| `EXPECTED_SUPABASE_PROJECT_REF` | New staging project ref |
| `PRODUCTION_SUPABASE_PROJECT_REF` | `qfwhtsmqndnocfidhdhy` (denial guard only) |
| `PRODUCTION_APP_ORIGIN` | `https://estories.app` |
| `EXPECTED_VERCEL_PROJECT_ID` | New staging project ID; Vercel system variables enabled |
| `AI_PROVIDER_MODE` | `mock` |
| `AI_WORKER_ENABLED` | `false` initially; enable only after isolated queue/schema/authentication checks |
| `AI_DAILY_CALL_LIMIT` | At most `4`; existing staging lifetime cap is `8` |
| `PAYMENT_PROVIDER_MODE` | `disabled` |
| `PAYMENT_NOTICE_WORKER_ENABLED` | `false` |
| `STAGING_EMAIL_ALLOWLIST` | Empty; deny sends |
| `STAGING_FREE_AI_CONFIRMED` | Unset; no live inference |

The runtime contracts in `lib/runtime/config.ts` and `lib/runtime/cohort.ts` remain authoritative. Do not reset budgets to bypass the existing limits. Mock budgets currently limit repeated hosted evaluations too; use independent local/CI fixtures for large regression suites, and design a separately reviewed budget change if sustained hosted mock testing is needed.

Credentials required by authentication/database clients must be staging-only and entered without printing them. Configure the normal application signing/database keys after inventorying their required names from source. A settings table is not proof that these credentials have been provisioned.

## Protected hosted binding check

The manual workflow `Verify exact staging candidate` runs only from protected `master`. It checks out the exact **trusted workflow commit** (`github.sha`), never the candidate input, and installs no application dependencies. Its sole request target is `/api/health` at a configured HTTPS `*.vercel.app` origin. Known production aliases, credentials in URLs, ports, paths and queries are rejected before sending requests.

In the GitHub **staging** environment set:

| Name | Kind | Value |
| --- | --- | --- |
| `STAGING_ORIGIN` | Variable | Dedicated staging `https://…vercel.app` origin |
| `STAGING_PROTECTION_BYPASS` | Secret | Automation bypass generated for the **staging Vercel project only** |

Use [Vercel's supported automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation). Keep protection enabled. Send the credential only as a header, never in URLs, artifacts, repository files or chat. Provider provisioning and secret registration remain operator setup, not actions performed by this read-only workflow.

Dispatch from `master` with the candidate's full 40-character lowercase commit SHA. The verifier:

- First sends an anonymous request and requires HTTP 401/403 or the recognized Vercel SSO redirect. This establishes denial at the sampled path; provider configuration and other aliases require separate verification.
- Then sends the staging-scoped automation header to the same origin. Redirects are never followed, including authenticated redirects.
- Requires HTTP 200, `estories-web`, the exact SHA, environment `staging`, active/open traffic admission, JSON, `no-store`, and `noindex,nofollow,noarchive`.
- Bounds each request to 15 seconds and the health body to 16 KiB. There are no retries or inference calls.
- Emits only allowlisted binding metadata. Failures print fixed error codes rather than response bodies, transport details or credentials. The workflow uploads a receipt only after success.

Run deterministic verifier regression tests with:

```powershell
node --test scripts/verify-staging.test.mjs
```

The test transport is synthetic. A passing test suite does not mean hosted staging exists or that the GitHub environment secret is configured. The workflow must be merged through normal source checks before it can execute from `master`. Do not change production merely to enable this staging check.

## Next production iteration

Develop on a feature branch, add a regression for the intended behavior, and pass the exact-SHA CI checks. When hosted staging is available, deploy a separate staging build and verify it as above. Build production with production configuration, run the required production audit against that exact artifact and environment, promote only after the gates pass, and verify actual delivery and critical journeys afterward. Retain compatible recovery and backups. Staging reduces uncertainty; it cannot promise that no production defect will ever occur.
