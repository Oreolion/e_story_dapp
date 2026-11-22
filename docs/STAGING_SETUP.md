# Staging setup and repeatable verification

## Current state — 2026-11-21

Production was released separately at commit `a2cb94cd51142df65e2879ba67c54fbfc00abfb6`. Staging preparation does not require another production database migration, payment change, or production pause.

There is **no provisioned hosted staging environment**. The Supabase CLI lists iStory (`qfwhtsmqndnocfidhdhy`) and eBrain (`lgwdyntmtkwmpgenecrf`) as active. The signed-in RA organization billing page confirms the Free plan. Supabase allows two active free projects across organizations; paused projects do not consume a slot. No project was paused, restored, repurposed, or purchased during this work. See [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

The owner must choose between retaining both projects and using isolated local/CI checks for now, or explicitly authorizing eBrain to be paused so a new dedicated staging project can be created. Pausing eBrain would make its database unavailable. Do not try to evade the account limit by creating another organization.

This branch strengthens the future hosted check. It does not provision resources or establish hosted acceptance. Its tests use synthetic HTTP responses and no external services.

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
2. Rehearse a fresh-schema bootstrap in isolation before applying it to staging. Do not blindly run the historical migration directory: it contains legacy assumptions, including migration 016 referencing `books` without a corresponding creation migration. Existing production-upgrade fixtures do not establish a fresh-project bootstrap. Record migration hashes and verify required tables, RPC permissions, RLS, private audio storage and synthetic CRUD before admitting the staging application.
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
