# Production cutover — pending execution

Prepared 2026-11-04, evidence updated Nov9. Last completed code checkpoint: `a973f686f585371aac006a0301e6d8fbebeaabf6`, on `feature/production-audit-repairs`. [Exact CI run](https://github.com/Oreolion/e_story_dapp/actions/runs/42592553788) passed all nine jobs, including the required aggregate; its conclusion and source SHA were independently read back Nov9. The owner-run scoped database restore and real-snapshot migration rehearsal passed Nov9, with ciphertext/evidence/migration binding independently checked. Remaining operational gates below still hold production. This file does not execute production changes.

The user authorized a verified direct master push and deferred staging. On Nov5 the user additionally authorized the scoped Vercel configuration, authenticated worker provisioning and migrations 020–023 **after recovery, compatibility and release gates pass**. This supersedes the earlier migration exclusion in the accepted [execution boundary](PRODUCTION_AUDIT_REPAIR_PLAN.md); do not ask for that same authority again. No purchases, paid inference or mainnet test payments are authorized. Recovery work has now established the stated database-restore checks, but not complete recovery coverage or cutover compatibility. Do not turn approval into a risk waiver or bypass a failed safety gate.

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
2. Complete recovery scope and freshness review. The Nov8 format-2 backup `istory-db-backup-I9N414` passed the owner-run isolated restore on Nov9: **62 tables, 1,730 rows**, matching grants/RLS/catalog metadata and source integrity baseline. Evidence SHA-256 is `7baaaedce4222ac0a66e633c90c159a836607a11ef779b17717292539213a09a`; all six ciphertext parts were independently checked against that evidence and the manifest. Tool duration was 8.481 seconds, not full operational RTO. The owner subsequently supplied the requested OneDrive download: a 1,081,079-byte ZIP, SHA-256 `fa6f0595e6a9dcea4449b1ed62010d573ef9db802e593440188f1d12b7363ce2`. All seven archive files matched the restored original set, including a byte-identical manifest. This is verified downloaded-byte integrity with owner-reported cloud origin; browser provenance/access settings and cloud delivery of the separate evidence JSON were not independently observed. See the [recovery record](RECOVERY_OPERATOR_GUIDE.md) for exact intervals, pinned image and scope. Media, keys, external configuration, excluded objects, retention, acceptable backup freshness/RPO and full RTO still need applicable coverage. Historical Nov4 provider metadata (`backups=null`, `pitr_enabled=false`) does not override this evidence or prove absence of other backups. Do not buy PITR or capacity.
3. The [real-snapshot migration rehearsal](RECOVERY_OPERATOR_GUIDE.md#verified-migration-rehearsal) passed Nov9: hash-bound 020–023 preserved 73 original tables and 1,892 rows, with 18 privileged RPC signatures and synthetic service-role functional probes passing. Evidence SHA-256 is `dfa45f17052a1bcecbde1d0c48ad35b272700d8d76b85769c9c0dbe5b4d58ead`; all six ciphertext parts and four migration hashes were independently checked. The 11.980-second tool interval is not operational RTO. Source migration history was preserved and success evidence was published after disposal; production remains unchanged. Next establish a compatible recovery artifact and cutover window. The old application is **not** a demonstrated rollback target after receipt/identity changes. A revert patch is not a tested recovery artifact. Recovery must preserve post-cutover users, jobs, receipts, outbox entries and identity bindings.
4. Verify wallet-specific Base mainnet USDC enablement through provider metadata. The public catalog establishes asset identity only. Do not issue a mainnet test deposit, read API keys or infer enablement from the wallet UUID.
5. Confirm the existing provider/account allowances and the proposed scheduler volume fit zero additional cost. No paid inference or transaction is authorized. Preserve explicit daily/attempt/output limits; synthetic timing does not establish live cost, quality or latency.
6. Prepare authenticated browser acceptance using controlled synthetic accounts, including Google, wallet, linked-account recovery and Firefox refresh. On Nov9 the installed computer-use skill was reread, but its required `node_repl` tool is not exposed in this session; no browser behavior has been established. CLI metadata cannot establish these user journeys. Do not substitute a customer account or silently waive missing acceptance.

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
| 021 | `8bd2cb0c1c6c85c19411a202be77873fb137e38a4c6e0ae3f5c2c4884e00318c` | Atomic payment receipts/entitlements/outbox; removes browser payment/notification mutation authority, including TRUNCATE |
| 022 | `ce601335c836d7ece5c7dd71dd1a9f87eca89b9659791e26ffaf5bb66f695d47` | Restricts counter RPCs to the service role |
| 023 | `c3a90f2d5a9faaee0dc5426245ac00c82f4c57b2e717cff148a06b4ad6e2e18c` | Protected dual-proof identity linking and atomic nonce consumption; removes direct browser profile writes and TRUNCATE |

Recompute canonical hashes from the committed blobs. Each file has its own transaction; four files are not automatically one transaction. Before execution, choose the supported provider execution mechanism and explicitly set bounded lock/statement timeouts, migration-history recording and schema-cache reload behavior. These execution details have not yet been installed or proven on the target. A failed file must roll back; inspect installed identities before retrying. These migrations are not all rerunnable after successful installation.

Use [the read-only preflight](../supabase/preflight_runtime.sql) plus effective policy/function definitions, indexes, defaults and grants. Preserve observed nullable TEXT story owners, nullable legacy content and sequence-backed numeric IDs. Have the owner check duplicate payment addresses/receipts and historical completed-payment reconciliation without exposing customer records to the agent. Never delete rows to make an index succeed.

Local evidence includes 12 live-shape compatibility tests and real PostgreSQL 17 concurrent connections for UUID/TEXT owners, leases, replay, nonce/link single-use and privilege denial. It does not establish the effective hosted grants or target migration execution.

## Coordinate old and new execution

### Candidate traffic admission and recovery rehearsal

The candidate supports `APP_RELEASE_MODE=active|paused`. An absent setting preserves active behavior; any other value denies traffic. Paused requests return uncached HTTP 503 with `Retry-After: 60` before session refresh, API handlers or image optimization. Database-client factories, canonical auth, inference and privileged worker/payment entry points also deny work. `/api/health` remains a liveness signal with `acceptingTraffic: false`; `/api/ready` returns 503. Neither endpoint establishes database or provider health. Production verification requires the exact source SHA and active traffic admission.

This setting is deployment configuration, **not a live global kill switch**. An environment change must reach the relevant running artifact; changing Vercel settings alone does not establish that. Static assets may still be served. Already-running handlers, old deployment URLs, cached browser code and direct Supabase SDK calls are outside this gate.

CI rehearses every discovered API route method, automatic HEAD/OPTIONS, pages, image optimization and middleware-bypass attempts against the same compiled build in paused and malformed modes, then verifies active admission. It uses synthetic settings and loopback HTTP, strips inherited provider credentials, and refuses local env files. Its small `recovery-build-evidence` report binds the source SHA, compiled-file digest and probe counts. This is test evidence, **not a retained Vercel deployment or an application rollback artifact**. A green run must be recorded before claiming this rehearsal passed.

| Recovery or client state | Supported behavior and required evidence |
| --- | --- |
| Candidate active with migrations 020–023 | Complete exact-build CI and hosted acceptance before enabling consumers. |
| Same candidate paused with migrations 020–023 | Admission denied; retain data and queued work. Verify the delivered deployment ID, SHA and paused responses. |
| Old application after migrations 020–023 | Not an approved rollback: legacy write grants and identity/payment semantics changed. |
| Cached browser using direct SDK writes | Candidate middleware cannot intercept it. Establish database/provider fencing and a tested refresh/recovery path. |
| Already-running handler or old deployment URL | Establish effective blocking and measured drain separately; a timeout or new flag alone is insufficient. |

Before production cutover, retain and identify a schema-compatible application deployment and its configuration. Prove provider/database controls cover old URLs, direct writes and scheduled consumers, and observe in-flight completion before schema changes. Verify callback retry duration, retention and replay with the actual provider before returning 503 to payment callbacks; `Retry-After` does not itself guarantee delivery. Record how admission is restored and test cached-client refresh without widening grants. These controls remain prerequisites, not effects of the CI rehearsal or candidate flag.

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

Current decision: **NO_GO for master/production** until the unresolved prerequisites are evidenced. The scoped database restore and isolated real-snapshot migration rehearsal are now evidenced; complete operational recovery, compatible application recovery, provisioning, provider acceptance and coordinated migration cutover remain outstanding. The feature checkpoint is source publication only.

## Exact checkpoint evidence and final challenge review

The current `a973f686f585371aac006a0301e6d8fbebeaabf6` CI run passed all nine jobs: runtime dependency security, lint, types, unit/integration and PostgreSQL tests, deterministic AI/migration checks, contracts plus encrypted export/restore/migration rehearsal, Windows recovery checks, production build/browser acceptance and `Release checks`. The run was independently read back Nov9. Linux logs confirmed 21 recovery tests passed and three Windows-only cases skipped; Windows confirmed 22 passed and two Docker cases skipped. The affected six tests also passed locally with real GPG, PostgreSQL and the private PowerShell path. This establishes CI's public synthetic journeys and recovery-tool checks. The separately recorded owner-run real-snapshot rehearsal passed afterward; neither proves hosted OAuth, live-provider quality or production delivery.

Historical Nov4 runtime checkpoint `89db9406fc0740f0c82a36db4161fe643eff1f45` completed its eight-job CI run in 6 minutes 54 seconds. Its build ran 22:43:21–22:46:25 UTC; browser acceptance ran 22:46:47–22:47:02 UTC. The historical artifacts below are preserved separately from the current checkpoint and real Nov9 restore evidence.

Retained CI artifacts: runtime dependency security `13369961558`, digest `sha256:29ad2ba1339a46a83f49ffff3496a5023c031a61c0f187359782905bce678f4e`; synthetic evaluations `13368544022`, digest `sha256:b3df3910e5a18f20d5d15d0344e391b5eead776d0c4ac5c543e9e480f16cf4a9`. These are reports, not a deployable Vercel artifact.

Nov5 master readback remains `d0cb70220b3ab1b2c48261578205758d0d1db51e`. Strict `Release checks` from app 15368, administrator enforcement and no force/deletion remain installed. Vercel's official project-check API returned `checks: []` at `2026-11-05T13:47:07.723Z`; no deployment-check enforcement is demonstrated. Native computer-use discovery still reports an unavailable pipe and no browser surfaces.

This is a distinct self-review, not an independent audit:

| Challenge | Counterexample and evidence | Result |
| --- | --- | --- |
| Coverage | Public browser passes could hide broken authenticated Google/wallet/profile recovery or provider callbacks. CI covers synthetic contracts, while hosted authenticated/provider acceptance remains absent. | GAP |
| Evidence | An old passing run or skipped build could be mistaken for this candidate. The failed first run is retained; the corrected full SHA and every completed job were independently read back. No production artifact is claimed. | CLEAR for checkpoint CI; production identity remains pending |
| Security | A green runtime audit could hide unrelated tooling advisories or effective hosted privileges. Raw full/runtime findings remain separate, the exact backport is tested, and actual production schema/grants still need installation/readback. | GAP |
| Compatibility/recovery | The scoped database restore, downloaded-byte check and real-snapshot 020–023 rehearsal now pass with hash-bound evidence. Old handlers or the old app could still corrupt post-cutover receipt/identity state; coordinated cutover and compatible application recovery remain outstanding. | GAP for production; PASS for the recorded scoped restore/retrieved bytes/isolated migration rehearsal |
| Workflow bypass | Independent Vercel promotion could publish before GitHub's observer workflow. Master protection exists, but the project-check list is empty and no provider ordering proof clears manual/automatic paths. | GAP |
| Decision | Master-push/setup authority could be mistaken for acceptance of missing evidence. The new scope is conditional on gates; staging is deferred, while production remains NO_GO. No native/OTA release is requested. | CLEAR for bounded decision |

Unresolved gaps keep the production decision NO_GO. Re-run the final preflight after recovery/setup/acceptance evidence exists, then verify the actual delivered artifact before success reporting. There is no claim that a successful CI checkpoint clears these operational gates.
