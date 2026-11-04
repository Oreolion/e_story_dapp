# Production checkpoint — 2026-11-04

Web/API decision: **NO_GO**. This records verified evidence and its limits; it is not release approval. Older notes remain historical. Branch `feature/production-audit-repairs` is based on `d0cb70220b3ab1b2c48261578205758d0d1db51e`. Checkpoint `9bd7873b1ce8eca7327b60a80e480b684a8f77d5` was committed and pushed to the feature branch for CI validation; no master push, production deployment or production migration has occurred.

The user now authorizes direct master push at the next reasonable verified production checkpoint. Staging is explicitly deferred until after the production update: do not treat staging provisioning itself as the current critical path. Actual production prerequisites, dependency remediation, exact-candidate CI and the required pre-publication/delivery audit still have to clear. Wallets are preserved. Mobile is unreleased; no native or OTA publication is planned.

The dependency-updated build/browser run `IkdtM1` passed, but it is **PRE-profile-fix**, not the current candidate. The subsequent profile/grant repair changed runtime code. `MbP72U` passed all 162 web tests, then its evaluation worker crashed inside Windows V8 JIT teardown; types did not run. The evaluation pool now uses isolated processes, with one worker. The fresh full run in TEMP `G8fUGJ` passed 164 web tests, 223 evaluations, 22 dependency regressions and both TypeScript checks. No current post-profile-fix build/browser or exact-candidate CI pass is claimed. Earlier artifacts remain historical evidence; these local results do not clear the full release gate.

## Verification evidence

TEMP identifiers below name existing evidence snapshots, not the current dirty tree or deployed artifacts. Times are UTC.

| Check | Recorded result and binding | Limit |
| --- | --- | --- |
| Production web build | PASS; TEMP `istory-verify-nRU8hT`; source `f491d49ac6771389eb6b386d1a2fd361ff639668a8ce8960a98989a2dde0750a`; BUILD_ID `FerV1krCvhm7tx3DdBlmJ`; Nov2 10:09:45–10:35:32 | Historical: superseded by dependency/configuration and subsequent profile changes |
| Chromium/Firefox acceptance | Same built artifact; exit 0; Nov 2 10:37:08–10:38:28 | Historical local artifact acceptance; not current-candidate or production delivery evidence |
| Web tests | 133 PASS; TEMP `YHCx2v` | Separate snapshot |
| Earlier app/evaluation snapshot | 133 app tests PASS and evaluations PASS; TEMP `loBdiB`; source `4a212452064802bf9992f28ae38cc09cb9c9547022bbcb1b5f64add4014ac0b0` | PRE-profile-fix snapshot |
| Earlier root/evaluation types | BOTH exit 0; TEMP `loBdiB`, same source; Nov 4 14:58:45–15:01:04 UTC | PRE-profile-fix local types, not production delivery |
| Dependency-updated web build | PASS; TEMP `IkdtM1`, same source; Nov 4 15:02:45–15:18:20 UTC; BUILD_ID `hYCQFdefSUFlfuU7NuzVj` | PRE-profile-fix; not current runtime evidence |
| Chromium/Firefox acceptance | PASS; same `IkdtM1` artifact; Nov 4 15:19:13–15:20:26 UTC | PRE-profile-fix local artifact acceptance |
| Profile/grant reproduction | RED; TEMP `fjoN1m`; 13 failed / 10 passed of 23 | Reproduced the mismatch before the repair |
| Focused profile repair | GREEN; TEMP `IHquR6`; 25 tests; source `63792665dd134bc0de1d329a29c81996285df745368aa60088d94910d6902888` | Before four additional hook tests |
| Interrupted full verification | TEMP `MbP72U`; source `392435e59f9e23e200382965e11a552ecab978b7b12f3d318ea292339c16c4b2`; 162 web tests PASS; evaluation process exited `2147483651` with a V8 JIT allocation assertion | Native process crash, not a passing evaluation run; types did not run |
| Final targeted profile verification | TEMP `Du6bLe`; source `f6d0ca520802fb76d181a30499a984663f536234450dc6ebc84878cf9c75b02f`; 31 API/hook tests PASS; Nov4 19:33:14–19:33:53 UTC | Includes actual 32 KB stream limit despite a false Content-Length; precedes evaluation-pool configuration change |
| Current complete local verification | TEMP `G8fUGJ`; source `9f5f8477c1d46f102a67d6d8ce260a1928bfedde77ab88e5ac9b2cc08d203da4`; Node 24.22.1; dependency regressions 22 PASS, web 164 PASS, evaluations 223 PASS; root and evaluation types exit 0; Nov4 19:36:41–19:42:07 UTC | Local synthetic services; build/browser and Linux/Node 22 CI still required for this runtime |
| Evaluations | 221 PASS; TEMP `OLHjtG` | Before two new live-schema cases |
| Types | PASS; TEMP `Ghqh09` | Before media-isolation additions |
| Lint | Exit 0, 180 warnings; TEMP `WKvq86` | Warnings remain |
| Fixture/product CLI | PASS; TEMP `jcY83A` | Fixture/product evidence, not live-provider quality approval |
| Mobile unit/component/types | Exit 0; Nov 3 TEMP `x82Mgi`; snapshot `fac78b4edcb780c33d1b229453ae03e6e3f54ee958531cf68423070ba5dba821` | No native release or OTA evidence |
| Live-schema compatibility | 12 GREEN; TEMP `2hgzHq`; snapshot `6d1d06e0e6c9a93ad0c14e6db7046b50d1b25673ba16b4db163ca771337ba01e` | Local reproduction/rehearsal, not applied production schema |

## Production prerequisites observed Nov3

The actual catalog for Supabase project `qfwhtsmqndnocfidhdhy` was read through the CLI Management API. No production data/schema mutation occurred.

| Catalog observation | Consequence for the candidate |
| --- | --- |
| `stories.author_id` is nullable TEXT; title/content are nullable; `numeric_id` has a sequence default | Preserve these live shapes in compatibility and migration checks |
| `users.updated_at` is absent | Reproduced payment and identity failures in TEMP `ISu86t`; both failed while 10 other compatibility checks passed |
| Migration history includes 000–012 and 019 | Runtime 020–023 tables/RPCs are absent; local definitions are not deployed evidence |
| All four counter RPCs exist and allow authenticated execution | The intended grant restriction is not installed |
| Notification check already includes `subscription` | Preserve the observed constraint rather than assume the value is missing |

Nov 4 catalog readback also confirms the existing `users` profile fields `location`, `website` and `notification_preferences`, while `updated_at` remains absent. The scheduler-extension check found Vault present; `pg_cron` and `pg_net` are absent. These are read-only observations, not installed migration or scheduler evidence.

Migration 020 now includes the shared additive prerequisite `ADD COLUMN IF NOT EXISTS users.updated_at timestamptz NOT NULL DEFAULT now()`. The 12-case compatibility pass above followed that repair. It has not been applied to production.

**Historical supplied name-presence record — corrected below:** production Vercel inspection checked names only, without reading secret values. The recorded absent names were `APP_ENV`, `EXPECTED_SUPABASE_PROJECT_REF`, `PRODUCTION_SUPABASE_PROJECT_REF`, `PRODUCTION_APP_ORIGIN`, `AI_PROVIDER_MODE`, both worker flags/secrets, `BLOCKRADAR_ACCEPTED_ASSETS` and `BLOCKRADAR_PAYMENT_NETWORK`. Existing public app/Supabase URL configuration and the Google provider key were present.

**Current correction, 2026-11-04T14:57:48.826Z:** the actual payment allowlist name in `lib/payments/receipts.ts` is `BLOCKRADAR_ACCEPTED_ASSET_IDS`; the earlier `BLOCKRADAR_ACCEPTED_ASSETS` shorthand was incorrect. Fresh Vercel name-only metadata confirms `BLOCKRADAR_ACCEPTED_ASSET_IDS` and `BLOCKRADAR_PAYMENT_NETWORK` are absent, while `BLOCKRADAR_WALLET_ID` is present. Previously listed runtime project references, modes and worker flags/secrets remain absent. Values were not read; presence alone does not verify values, target binding or provider behavior.

### Profile/grant repair — Nov 4

After `IkdtM1` passed, the profile/grant mismatch was reproduced by the 13-failure/10-pass `fjoN1m` run. The repair routes owner edits/preferences through the owner API, guards stale-owner responses, reads the canonical self-profile and uses the existing handler for the AuthProvider fallback. The final focused run passed 31 API/hook tests, and the current `G8fUGJ` full run passed web tests, evaluations and both type checks. The earlier build cannot certify these runtime changes.

## PostgreSQL rehearsal and dependency state

Real PostgreSQL 17 rehearsal used independent connections and passed both UUID and TEXT author shapes, overlapping-request proof, eight global/two per-owner active leases, attempt accounting, payment replay, single-use nonce/challenge behavior and privilege denial. Evidence: TEMP `istory-runtime-postgres-20261103.log`. Only an owned local Docker container was created and stopped; no production mutation occurred.

**Historical — Nov3, before the dependency repairs below:** raw runtime audit TEMP `istory-runtime-audit-20261103.json` reported **0 critical / 20 high / 20 moderate / 6 low**. At that snapshot the Zod3 wallet chain remained unresolved, and new decode-uri-component advisories were `GHSA-vcc3-ghjq-m6fr` and `GHSA-qr28-fpjm-wq7f`. No waiver or backport had been implemented; no clean dependency or wallet-compatibility claim was made.

### Dependency repair update — 2026-11-04

- Implemented the official decode-uri-component **0.5.1** override with a hash-pinned CJS adapter preserving legacy `+` semantics. The upstream ESM implementation is unchanged.
- Added a temporary, version-preserving Zod upper-size-bound backport across **13 parser implementation files**. The guard checks **37 parser/wrapper files**, three lock package/version/integrity/exports identities, and Next **15.5.28**. It follows the [upstream size-bound fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd). Unconstrained schemas still need caller limits; this is not a claim that arbitrary unbounded validation is safe.
- RED evidence: **12 legacy module entrypoints traversed 20,000 elements despite a maximum bound**; already-fixed root V4 controls passed. After the repair, **22 dependency regressions** and then **three policy tests** passed.
- `npm run audit:runtime` independently reruns all **25 tests** and now returns **`PASS_WITH_VERIFIED_BACKPORT`**. Evidence files are `output/dependency-security/assessment.json` and `output/dependency-security/raw-npm-audit.json`; do not commit raw audit output.
- Raw npm findings remain **0 critical / 18 high / 20 moderate / 6 low**. All 18 high findings are the exact Zod advisory `GHSA-mrhx-c7xc-m3w5` and its propagation. This is a verified-backport assessment, not zero audit findings. New or changed high/critical findings, extra Zod copies, missing/tampered backport files or failing regressions block the guard.

The dependency/configuration build/browser pass `IkdtM1` predates the profile fix; the successful `G8fUGJ` retry establishes current local test/type results, with no current build/browser or exact-candidate CI pass yet. Database/configuration prerequisites and exact-candidate CI keep web/API **NO_GO**. Staging provisioning remains deferred, while authenticated cutover/provider acceptance evidence remains required before claiming the affected features ready. No production side effect or native/OTA publication is authorized by these local guard results.

### Profile compatibility and payment metadata update

Profile edits and preference toggles now use the authenticated owner-scoped API, matching migration 023's browser write revocation. Strict input validation rejects identity/entitlement fields; an optional owner header rejects stale-account reads/writes. Self-profile loading uses the same API and rejects mismatched response IDs. The wallet-connection fallback reuses the existing canonical session handler rather than looking up the OAuth subject directly. Firefox refresh transport and auth subscription dependencies are unchanged. These are local implementation/results, not hosted OAuth acceptance.

Read-only Nov4 production catalog metadata confirms `users.location`, `website`, `email` and `notification_preferences` exist; `updated_at` remains absent. Only `supabase_vault` is installed among the inspected scheduler extensions: `pg_cron` and `pg_net` are absent, so automatic worker dispatch is not installed.

The user confirmed Blockradar **mainnet**. An unauthenticated read of the [official public asset catalog](https://api.blockradar.co/v1/assets), at 2026-11-04 15:16:30 UTC, identified Base mainnet USDC asset `3a18a31a-86ad-44a0-9b9c-cdb69d535c64`, contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, six decimals. Evidence: TEMP `istory-blockradar-public-hzoCNc`; catalog SHA-256 `dd2251a05cb5d3984447d01851507b2d2062acdf8981fb1944b9f85dfcb759dd`. Wallet-specific enablement remains unverified. No env file was read, provider setting changed or mainnet transaction issued.

Computer use was attempted through the current Windows plugin and browser inventory. The native pipe was unavailable and the browser inventory was empty. CLI metadata checks remain useful; interactive authenticated UI acceptance remains unavailable.

## External controls and remaining release gate

Nov 2 GitHub controls were installed and read back: master requires strict `Release checks` from app 15368, `enforce_admins=true`, force pushes/deletions disabled, and no PR approval requirement. The GitHub staging environment has master source policy, id 65204852; staging hosting resources are not provisioned. The Vercel gate remains unverified. GitHub control installation does not establish hosting enforcement or candidate delivery.

Fresh Nov 4 master-protection readback confirmed those settings unchanged; master remains `d0cb70220b3ab1b2c48261578205758d0d1db51e`. This is control metadata, not a candidate CI or delivery pass.

Independent Vercel metadata at `2026-11-04T15:33:59Z` confirms production branch `master`, Node 22, repository `Oreolion/e_story_dapp` and default install/build commands. This establishes configured source/build metadata, not deployment-check enforcement or current-candidate delivery; the Vercel gate remains unverified.

Next production checkpoint must resolve actual target schema/configuration/grants, obtain exact-candidate CI evidence, and complete the installed production audit before any production side effect. Delivery must then be verified against the exact commit/artifact/environment before claiming success. Staging remains deferred by the user's instruction. Feature-branch source validation does not publish this candidate to production.

## Feature checkpoint CI follow-up

CI run [41899758262](https://github.com/Oreolion/e_story_dapp/actions/runs/41899758262), bound to `9bd7873b1ce8eca7327b60a80e480b684a8f77d5`, passed root types, web tests/PostgreSQL rehearsal, contract compilation and runtime dependency security. It failed lint and the identity evaluation setup, so the build was skipped and the required aggregate correctly failed.

Three test-tooling corrections follow that evidence: name the React test provider as a component; exclude only hash-pinned upstream sources from application lint while retaining their executable integrity/regression tests; define the synthetic wallet signing key in evaluation configuration so lifecycle hooks do not depend on the local verifier's environment. The isolated lint command now matches CI's whole-tree scope. Local lint passed in TEMP `Ii9BRN`, source `83c6cf0667f96b10187193f1f98e6719e5151da9e643068cfaabc09fc19be130`. The subsequent isolated evaluation retry `xHpUh8` timed out without reporting test results; it is not a pass. Fresh CI must validate the follow-up commit.

The full development-inclusive audit at 2026-11-04 19:46:47 UTC reported 0 critical / 24 high / 47 moderate / 26 low; raw SHA-256 `3533321dcfdda1c8bd02b0ee3f3e23725c2eacdfd3059c73b94cfa72f3ecfc8c`, TEMP `istory-full-audit-ao8SN0`. This differs from the runtime-only audit. Additional development-tool findings remain recorded; the verified runtime backport assessment is not a blanket clean-audit claim.
