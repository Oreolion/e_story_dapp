# Production cutover — pending execution

Prepared 2026-11-04, evidence updated Nov5. Runtime candidate: `89db9406fc0740f0c82a36db4161fe643eff1f45`, on `feature/production-audit-repairs`. [Exact CI run](https://github.com/Oreolion/e_story_dapp/actions/runs/41927294257) passed all eight jobs, including the required aggregate, at Nov4 22:47:10 UTC. This file does not execute production changes.

The user authorized a verified direct master push and deferred staging. On Nov5 the user additionally authorized the scoped Vercel configuration, authenticated worker provisioning and migrations 020–023 **after recovery, compatibility and release gates pass**. This supersedes the earlier migration exclusion in the accepted [execution boundary](PRODUCTION_AUDIT_REPAIR_PLAN.md); do not ask for that same authority again. No purchases, paid inference or mainnet test payments are authorized. The user confirmed that no verified restore exists, so recovery setup comes first. Do not turn that approval into a risk waiver or bypass a failed safety gate.

## Bind the targets

| Resource | Intended target |
| --- | --- |
| GitHub | `Oreolion/e_story_dapp`; production branch `master` |
| Vercel | `oreolions-projects` / `prj_flm8d8Q2WHZY4b8LW0scLZ5tD6Wq` |
| Public origin | `https://estories.app`; recheck current domain assignment before execution |
| Supabase | `qfwhtsmqndnocfidhdhy`, `istory_dapp`, `eu-west-1` |
| Blockradar | User-confirmed mainnet; existing wallet `7d9469d3-a7b6-466e-9eda-9e4c372ed15e` |
| Mobile | Unreleased; no native/OTA publication |

Re-read provider metadata and protection immediately before execution. Stop on identity, source, configuration or schema drift. Never print provider credentials or read local env files.

## Close these prerequisites before mutating production

1. Require successful `Release checks` for the exact candidate. Preserve its runtime-security assessment, SQL/evaluation reports and build/browser results. A feature preview is not an isolated staging environment or production acceptance.
2. Establish a recoverable backup and isolated restore evidence with the database owner. Record timestamp, covered database/auth/storage resources, encryption/access, retention, RPO and RTO. The Nov4 CLI backup metadata returned `backups=null`, `pitr_enabled=false` and empty physical-backup metadata. This does not prove that no separately managed backup exists; no restorable backup has been established by this task. Do not buy PITR or capacity.
3. Establish a compatible recovery artifact and cutover window. The old application is **not** a demonstrated rollback target after receipt/identity changes. A revert patch is not a tested recovery artifact. Recovery must preserve post-cutover users, jobs, receipts, outbox entries and identity bindings.
4. Verify wallet-specific Base mainnet USDC enablement through provider metadata. The public catalog establishes asset identity only. Do not issue a mainnet test deposit, read API keys or infer enablement from the wallet UUID.
5. Confirm the existing provider/account allowances and the proposed scheduler volume fit zero additional cost. No paid inference or transaction is authorized. Preserve explicit daily/attempt/output limits; synthetic timing does not establish live cost, quality or latency.
6. Prepare authenticated browser acceptance using controlled synthetic accounts, including Google, wallet, linked-account recovery and Firefox refresh. Computer use currently has no native pipe/browser surface; CLI metadata cannot establish these user journeys. Do not substitute a customer account or silently waive missing acceptance.

## Configure the reviewed production contract

Provision through the normal protected provider interface after authorization. Keep secret values out of commands recorded in shell history, documentation, CI logs and source control. Preserve existing production credentials; do not rotate wallet/session secrets as part of this release.

| Name | Required value or validation |
| --- | --- |
| `APP_ENV` | `production` |
| `EXPECTED_SUPABASE_PROJECT_REF` | `qfwhtsmqndnocfidhdhy` |
| `PRODUCTION_SUPABASE_PROJECT_REF` | `qfwhtsmqndnocfidhdhy` |
| `PRODUCTION_APP_ORIGIN` | `https://estories.app` |
| Existing public app/database origins | Must match the independently verified targets above |
| `AI_PROVIDER_MODE` | `live` only after the existing allowance is verified; never production mock |
| `AI_DAILY_CALL_LIMIT` | Explicit initial cap no greater than the verified included allowance; existing default 100 is not billing proof |
| `AI_WORKER_ENABLED` | Initially `false`; enable only after the new app is verified and old handlers have drained |
| `PAYMENT_NOTICE_WORKER_ENABLED` | Initially `false`; enable only after payment/outbox acceptance and handler drain |
| `AI_WORKER_SECRET`, `PAYMENT_WORKER_SECRET` | Separate random values, each at least 32 characters, delivered privately to its matching dispatcher |
| `BLOCKRADAR_PAYMENT_NETWORK` | `mainnet` |
| `BLOCKRADAR_ACCEPTED_ASSET_IDS` | Base USDC `3a18a31a-86ad-44a0-9b9c-cdb69d535c64`, **after wallet enablement is confirmed** |
| Existing Blockradar wallet/API/webhook configuration | Match the intended wallet and provider receipts; do not display values |
| Private-inference tracing flags | All supported LangSmith/LangChain ambient tracing flags disabled |

The asset comes from the [official public catalog](https://api.blockradar.co/v1/assets), checked Nov4: Base USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, six decimals. Existing credentials being present does not prove their correctness or provider allowance. Runtime configuration must validate during the actual Vercel build/start; a local synthetic build cannot validate production settings.

## Review and apply only the intended database changes

Do not run blind `supabase db push`: live migration history has gaps before 019. Apply only reviewed 020–023 after backup/recovery, compatibility, cutover and authority gates clear. Do not replay 013–018 or mark them applied to make histories match.

| Migration | Canonical LF SHA-256 | Relevant cutover effect |
| --- | --- | --- |
| 020 | `fed22f300fa65cc560a0fbc6f9876c3362728c004b961b94e6f96062b2d458be` | Adds missing `users.updated_at`, story revisions, durable jobs, triggers and bounded provider admission |
| 021 | `2dcf3858004214e0042138b48814acfd6299b5e3caadbcadf9d79dd024163aa8` | Atomic payment receipts/entitlements/outbox; removes browser payment/notification mutation authority |
| 022 | `ce601335c836d7ece5c7dd71dd1a9f87eca89b9659791e26ffaf5bb66f695d47` | Restricts counter RPCs to the service role |
| 023 | `0b6dfea1e529acd2632496f4df4668e088a8c54a2f7a8936d9732b07b1f47bb3` | Protected dual-proof identity linking and atomic nonce consumption; removes direct browser profile writes |

Recompute canonical hashes from the committed blobs. Each file has its own transaction; four files are not automatically one transaction. Before execution, choose the supported provider execution mechanism and explicitly set bounded lock/statement timeouts, migration-history recording and schema-cache reload behavior. These execution details have not yet been installed or proven on the target. A failed file must roll back; inspect installed identities before retrying. These migrations are not all rerunnable after successful installation.

Use [the read-only preflight](../supabase/preflight_runtime.sql) plus effective policy/function definitions, indexes, defaults and grants. Preserve observed nullable TEXT story owners, nullable legacy content and sequence-backed numeric IDs. Have the owner check duplicate payment addresses/receipts and historical completed-payment reconciliation without exposing customer records to the agent. Never delete rows to make an index succeed.

Local evidence includes 12 live-shape compatibility tests and real PostgreSQL 17 concurrent connections for UUID/TEXT owners, leases, replay, nonce/link single-use and privilege denial. It does not establish the effective hosted grants or target migration execution.

## Coordinate old and new execution

Do not independently apply grant revocations while assuming all cached browsers already use the new API. Migration 023 intentionally denies old direct-SDK profile writes; the new profile API is tested, and cached clients need a supported refresh/recovery path.

Keep new consumers disabled throughout cutover. Identify the current deployment's actual maximum lifetime for old inline-analysis/payment handlers and every external callback source. Establish a technically enforced write/payment cutover or a reviewed compatibility bridge, then prove old execution has drained before enabling new consumers. A declared maintenance window or a browser refresh alone does not prove this. This coordinated cutover remains unresolved; do not perform a piecemeal live switch.

Legacy Google/wallet links require fresh proof of both identities. Preserve existing data; reject conflicting populated profiles. Do not migrate email or editable metadata into link authority. Historical completed payments without receipt bindings require provider-backed reconciliation; do not grant another period from an old status flag.

## Install authenticated worker dispatch

There is currently no installed scheduler for the new workers. Vercel's existing daily re-engagement GET cron does not call these POST endpoints. Production cannot claim working asynchronous analysis with dispatch permanently disabled.

| Endpoint | Authentication | Bounded operation |
| --- | --- | --- |
| `POST /api/internal/ai-jobs` | AI-specific bearer token | Claims/processes at most one eligible job |
| `POST /api/internal/payment-notices` | Separate payment-specific bearer token | Activates at most one due credit and dispatches at most one notice |

Candidate scheduler: Supabase `pg_cron` plus `pg_net`, initially disabled, using separately protected Vault entries. The target currently has Vault but lacks `pg_cron`/`pg_net`. Installation and effective ACLs require explicit authorized provisioning; no scheduler SQL or extensions have been applied.

Choose cadence from measured queue age and included capacity. Ten-second polling means up to 8,640 requests/day **per endpoint**, or 17,280/day for both, before retries. Avoid unconditional HTTP polling when no eligible work exists. Bound network timeout, overlap and retries. Analysis has 45-second leases, a 90-second post-claim deadline, two total attempts and a 25-second provider timeout; scheduler delays must fit recovery behavior.

Supabase's [scheduling documentation](https://supabase.com/docs/guides/functions/schedule-functions), checked Nov4, warns that pg_net queues decrypted authorization headers. Vault alone does not protect a queued header. Before enabling dispatch, verify effective access to `net.http_request_queue`, Vault views, cron commands/history and operational logs for every relevant role; deny API/untrusted roles access and verify those denials. Never use a service-role database/API key as the worker bearer token. Keep public URL fixed and payload empty of journal/customer content. Stop if the available extension permissions cannot enforce this contract.

## Publish and verify

Only after prerequisites, authorized target changes and the final production audit clear:

1. Re-read `$web-mobile-production-audit` and run final preflight/self-critique bound to the exact commit, target settings, schema and expected artifact. Require all mandatory gates. Recheck strict master protection and actual Vercel promotion ordering; do not disable required checks or use Force Promote.
2. Fast-forward master to the **same validated commit**, without force or an unvalidated merge/squash commit. The Vercel master integration is the production side effect. Hold automatic/manual promotion if the bound audit is not ready.
3. Match the Vercel production deployment ID, full source SHA, project/environment and custom-domain assignment. Verify the no-store full-SHA signal and delivered build assets; a healthy old health endpoint is insufficient.
4. Confirm schema/configuration readback and run approved synthetic acceptance: private save without public pinning; queued analysis through persisted result; owner isolation; edit/opt-out fencing; profile/preferences; Google/wallet/link recovery; payment replay/outbox using the approved sandbox/contract evidence. Do not issue live money transfers, email, uploads or paid inference merely to obtain a smoke-test pass.
5. Enable one consumer only after its handler-drain and acceptance evidence clears. Observe it before enabling the other. Keep all attempt, owner, global and daily limits. Record exact flag/configuration changes and re-audit material changes.
6. Proposed observation window: at least 30 minutes, including authenticated refresh/recovery and meaningful synthetic samples. Record actual sample counts; zero traffic is unknown. Owner: the release operator with Oreolion's authority. Stop on failed saves/auth recovery, unintended publication, duplicate/missing entitlement, stale metadata, stuck jobs, unexpected spend, lock contention, failed checks or artifact mismatch. Freeze new dispatch and use the tested compatible recovery path; do not automatically delete records or restore an old application.
7. Complete the post-delivery audit/self-critique before claiming success. Staging setup follows this verified production checkpoint, as requested. No mobile release is included.

Current decision: **NO_GO for master/production** until the unresolved prerequisites are evidenced. The feature checkpoint is source publication only. This runbook is a concrete execution contract with visible gaps, not a statement that recovery, provisioning, provider acceptance or the migration cutover has already passed.

## Exact checkpoint evidence and final challenge review

The Nov4 CI run at the full candidate SHA above completed in 6 minutes 54 seconds. All eight jobs succeeded: root types, lint, web/PostgreSQL tests, deterministic evaluations/CLI reports, runtime dependency security, contracts, production build/browser acceptance and `Release checks`. The build ran 22:43:21–22:46:25 UTC; browser acceptance ran 22:46:47–22:47:02 UTC. This establishes the CI build's public synthetic journeys, not hosted OAuth, live-provider quality or production delivery.

Retained CI artifacts: runtime dependency security `13369961558`, digest `sha256:29ad2ba1339a46a83f49ffff3496a5023c031a61c0f187359782905bce678f4e`; synthetic evaluations `13368544022`, digest `sha256:b3df3910e5a18f20d5d15d0344e391b5eead776d0c4ac5c543e9e480f16cf4a9`. These are reports, not a deployable Vercel artifact.

Nov5 master readback remains `d0cb70220b3ab1b2c48261578205758d0d1db51e`. Strict `Release checks` from app 15368, administrator enforcement and no force/deletion remain installed. Vercel's official project-check API returned `checks: []` at `2026-11-05T13:47:07.723Z`; no deployment-check enforcement is demonstrated. Native computer-use discovery still reports an unavailable pipe and no browser surfaces.

This is a distinct self-review, not an independent audit:

| Challenge | Counterexample and evidence | Result |
| --- | --- | --- |
| Coverage | Public browser passes could hide broken authenticated Google/wallet/profile recovery or provider callbacks. CI covers synthetic contracts, while hosted authenticated/provider acceptance remains absent. | GAP |
| Evidence | An old passing run or skipped build could be mistaken for this candidate. The failed first run is retained; the corrected full SHA and every completed job were independently read back. No production artifact is claimed. | CLEAR for checkpoint CI; production identity remains pending |
| Security | A green runtime audit could hide unrelated tooling advisories or effective hosted privileges. Raw full/runtime findings remain separate, the exact backport is tested, and actual production schema/grants still need installation/readback. | GAP |
| Compatibility/recovery | Old handlers or a revert to the old app could corrupt state after new receipts/identity grants. The user confirmed no verified restore; coordinated cutover and compatible recovery proof are outstanding. | GAP |
| Workflow bypass | Independent Vercel promotion could publish before GitHub's observer workflow. Master protection exists, but the project-check list is empty and no provider ordering proof clears manual/automatic paths. | GAP |
| Decision | Master-push/setup authority could be mistaken for acceptance of missing evidence. The new scope is conditional on gates; staging is deferred, while production remains NO_GO. No native/OTA release is requested. | CLEAR for bounded decision |

Unresolved gaps keep the production decision NO_GO. Re-run the final preflight after recovery/setup/acceptance evidence exists, then verify the actual delivered artifact before success reporting. There is no claim that a successful CI checkpoint clears these operational gates.
