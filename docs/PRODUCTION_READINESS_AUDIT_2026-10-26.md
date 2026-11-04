# Production readiness audit: web and mobile

Audit date: 2026-10-26. Phase: read-only production preflight, alongside separately authorized local evaluation implementation. Source: `master`, full commit `d0cb70220b3ab1b2c48261578205758d0d1db51e`, plus uncommitted evaluation/test/dependency changes. Existing user changes were preserved. This is a workspace assessment, not certification of a deployed artifact.

| Target | Decision | Environment/artifact binding | Actual publication state |
| --- | --- | --- | --- |
| Web/API | **NO_GO** | Local source; intended origin `https://estories.app`; no provider deployment ID established | No deployment performed; public health lookup unavailable through the web tool |
| Android | **NO_GO** | Expo source; `app.estories.mobile`; production Play profile in source; no signed AAB/build ID or installed artifact established | No build purchase, submission or rollout performed |
| iOS | **BLOCKED** | Expo source; `app.estories.mobile`; no signed IPA, installed build or distribution target established | No submission or rollout performed |
| OTA, Android/iOS | **BLOCKED** | Source uses Expo Updates and app-version runtime policy; no update group/channel-to-binary evidence | No update published |

Web findings also affect the shared backend used by native clients. A passing TypeScript/unit check does not override private-content publication, delivery defects, dependency advisories, or absent device evidence. No risk acceptance was supplied or inferred.

## Evidence and scope

Applied the installed `web-mobile-production-audit` skill, its web/security, data/operations, native, workflow, reporting and self-critique references, plus security-review and web-interface review guidance. The scope includes AI routes and callers, CRE, private save/IPFS, metadata/pattern delivery, selected payment and social paths, shared auth/quota controls, deployment workflows, mobile configuration/offline policy, and representative pages/design foundations.

This is not a line-by-line audit of every repository file. Live effective RLS/RPC/storage grants, provider configuration, production logs/customer records, signed devices, store account state and load tests were unavailable. Secret files were not inspected. No production mutations, paid model calls or chain transactions were made.

Local synthetic evidence lives in `evals/`, with `output/evaluations/latest.json` containing source fingerprints and explicit fixture/advisory status. A new CI definition exists at `.github/workflows/ai-evaluations.yml`; it has not been run on GitHub or installed as a required check.

## Gate matrix

| Gate | Web | Native | Evidence and limitation |
| --- | --- | --- | --- |
| Source identity | PASS for local workspace only | PASS for inspected source only | Full SHA above; uncommitted changes prevent equating HEAD with final artifact |
| Security/privacy | FAIL | BLOCKED/FAIL for shared affected paths | Private-IPFS publication and open dependency findings; native effective runtime unverified |
| Configuration | BLOCKED | BLOCKED | Synthetic local configuration only; no production presence/region/provider validation |
| Database/storage | BLOCKED | BLOCKED | Committed SQL and query doubles inspected; effective production roles/policies not inspected |
| Compatibility | BLOCKED | FAIL/BLOCKED | Confirmed mobile tracker/metadata mismatches; no supported-installed-client matrix |
| Types | PASS locally | PASS locally | Root and mobile `tsc --noEmit --incremental false` completed successfully |
| Tests | PASS for new deterministic checks | PASS for mobile unit tests; component result recorded below | Synthetic boundaries do not prove production JWT/RLS/device behavior |
| Build | BLOCKED | BLOCKED for signed binaries | Corrected isolated web build did not complete within the bounded local verification window and was stopped; no signed release requested |
| Browser/device acceptance | FAIL in local test environment | BLOCKED | Two Chromium navigation timeouts on both attempts; authenticated journeys and physical devices unavailable |
| Rollback/restore | BLOCKED | BLOCKED | Workflow source reviewed; no exact known-good artifact/restore rehearsal |
| Observability | BLOCKED | BLOCKED | Source integrations exist; release-bound alerts, dashboards, destinations and watch window unverified |
| Workflow enforcement | BLOCKED | BLOCKED | Post-deploy checks cannot establish pre-deploy provider gating; native/OTA manual paths remain |
| Final self-critique | GAP, see below | GAP, see below | Missing artifact/device/provider evidence cannot be marked PASS |

## Prioritized findings

### PRIV-01 — Private web entries are pinned as plaintext (High, confirmed source path)

- Location: `app/record/RecordPageClient.tsx:375`, `:378`, `:389`; `app/api/ipfs/upload/route.ts`; `app/utils/ipfsService.ts`.
- Preconditions: authenticated web recording save, including the default private setting, with IPFS provider configured.
- Evidence: the metadata includes raw `content: transcribedText` and `is_public: isPublic`, and is uploaded before the cloud insert and optional local encryption. The uploader sends that JSON to the public IPFS pinning endpoint; a visibility field is not encryption/access control.
- Impact: private text can leave the intended private storage boundary and gain a durable content address. Removing a DB row cannot guarantee removal of distributed copies.
- Mitigation/fix proposal: stop plaintext private pinning; separate public publication from private save, and define private storage/encryption semantics before making changes. Reconcile existing published data with the release/privacy owner.
- Owner: backend/privacy owner. Verification: a private-save test must observe zero plaintext pinning calls; explicitly public publication must remain deliberate. No private test entry was actually uploaded during this audit.

### SEC-02 — Current runtime dependency advisories require remediation (Critical scanner findings; exploitability not fully established)

The current lock/install runtime audit (`npm audit --omit=dev --json`, npm 11/Node 25 local toolchain) reports **75 affected dependency entries: 2 critical, 32 high, 40 moderate, 1 low**. These are dependency entries, not 75 independently reachable exploits.

The two critical direct entries are Next.js and `@sentry/nextjs`. The Sentry tunnel is configured in `next.config.mjs`; the reviewed [Sentry tunnel advisory](https://github.com/advisories/GHSA-mchm-gjx6-7h55) includes the installed range. The reviewed [Next image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) includes 15.5.27. Both sources checked 2026-10-26. An exploit was not attempted; the Next SVG preconditions and hosting mitigations must be assessed rather than claiming demonstrated RCE.

- Owner: dependency/platform owner.
- Fix proposal: select supported patched framework/Sentry releases, assess the pinned `sharp` override, and triage direct and transitive runtime paths. Move/remove developer-only MCP dependencies from runtime only after import/reachability review. Do not run a blind `npm audit fix --force`.
- Verification: updated lockfile audits, Next production build, SSR/headers/auth/recording browser regressions, supported mobile API compatibility, and targeted advisory negative checks.
- Evaluation dependencies were added as pinned dev dependencies for the authorized test implementation; they were not installed into product UI code. Full and mobile audit summaries are recorded in the final verification section.

### REL-03 — CRE completion and provenance are unreliable (High, reproduced locally)

- `app/api/cre/callback/route.ts:96`: callback updates pending logs to completed even after a failed metrics upsert. It returns HTTP 200 either way.
- `app/api/cre/callback/route.ts:64`: tier and threshold are accepted independently from quality score; inconsistent values are persisted.
- `app/api/cre/check/route.ts:73`: cache presence yields `verified: true`; direct fallback rows have null proof/transaction fields.
- Evidence: `evals/cre.test.ts`, including two explicitly named expected-failure tests and a direct-fallback proof check.
- Impact: false completed/verified state and inconsistent product trust signals. This does not prove an on-chain report was forged.
- Owner: CRE/backend owner. Proposed fix: explicit analysis/attestation/delivery states, validated derivations, content-revision binding, persisted failure/retry ownership, and independent receipt verification. See [the CRE assessment](CRE_LAYER_ASSESSMENT.md).

### REL-04 — Subscription activation can be lost after payment completion (High, confirmed failure path; not executed against payments)

- Location: `app/api/payment/webhook/route.ts:141`, `:162`.
- Preconditions: a valid deposit callback is claimed as completed, then `activateSubscription` fails.
- Evidence: a retry searches for a pending payment; the already-completed row is not selected and the retry is acknowledged as already processed. The handler contains no durable entitlement retry/reconciliation transition.
- Impact: a paid user can remain without an activated entitlement after an infrastructure failure.
- Owner: payments owner. Proposed fix: transactional entitlement transition or durable payment-event/outbox processing with a recoverable `activation_pending` state. Verify duplicate/concurrent/out-of-order events and fail after every persistence boundary. No payment was created or callback sent externally.

### API-05 — Mobile AI generation and metadata contracts disagree (Medium, confirmed source)

- `mobile/app/(tabs)/tracker.tsx:278` expects `enhanced`; `/api/ai/enhance` returns `text`. The save branch depends on the absent field.
- `mobile/hooks/usePatterns.ts:44` expects nested metadata; `app/api/stories/route.ts:19` selects only stories without a metadata join.
- Impact: tracker creation may silently fail to save and mobile patterns may appear empty despite successful analysis.
- Owner: mobile/API owner. Proposed fix: a shared runtime-validated DTO, compatibility-preserving response handling, and actual caller journey regressions. Existing mobile units do not cover these screens.

### REL-06 — Background AI dispatch is not durable (Medium, confirmed design gap)

`app/api/journal/save/route.ts` and `app/api/cre/trigger/route.ts` launch unawaited fetches without checking downstream HTTP errors or demonstrating a durable retry/deadline. Journal save forwards a bearer header but not a cookie session; cookie-only saves can persist a story while internal analysis is unauthorized and CRE is skipped. Analysis deduplication is process-local.

Owner: backend owner. Use a transactional outbox/durable job keyed by tenant, story revision, prompt/model/schema version; retain explicit pending/failed states. Test process termination, 401/429/500, duplication and recovery. The HTTP evaluation proves local successful orchestration, not serverless lifetime safety.

### DB-07 — Privileged social counter RPCs lack a caller decision (High if committed grants are effective; production verification required)

`supabase/migrations/018_atomic_counter_rpcs.sql:17` defines SECURITY DEFINER functions that update arbitrary supplied story/user IDs and grants execution to `authenticated` at lines 89-92, with no identity/relationship check in the function and no PUBLIC revoke shown in committed migrations. Direct callers could alter counters if these privileges are deployed.

This is a confirmed unsafe committed definition, **not a claim that production grants were inspected**. Owner: database/security owner. Inspect effective ACL/default privileges; restrict execution to the service role or enforce authorized relationship transitions atomically. Test anon/authenticated/service-role calls in isolated PostgreSQL with actual grants.

### UX-08 — Public product claims conflict with source behavior (Medium, confirmed copy mismatch)

`app/HomePageClient.tsx:48`, `:60`, `:72`, `:785`, `:797`, `:809` claim perfect transcription, unreadable private storage, no feeds, enclave-based CRE execution, and independence from platform infrastructure. Source uses third-party AI, cloud plaintext saves, optional local encryption, a social feed, and a CRE HTTPClient implementation with confidential-transport TODOs.

Owner: product/design/privacy. Replace unsupported absolutes and unsourced 74%/100%/51% figures with specific verifiable descriptions. Privacy disclosure and intended data flow must be reviewed together; copy changes alone cannot resolve PRIV-01. See [the improvement guide](PLATFORM_IMPROVEMENT_GUIDE.md).

### OPS-09 — Release checks do not establish universal production gating (Medium, confirmed workflow source; provider protections unknown)

`.github/workflows/deploy.yml` explicitly says Vercel auto-deploys from Git and then polls a seven-character health version. Independent auto-deploy can precede the audit. `rollback.yml` can revert unspecified HEAD or promote a previous Vercel deployment without an exact known-good artifact/schema binding or post-rollback identity verification. Its workflow-input interpolation also warrants a separate CI injection review before relying on emergency execution.

Owner: release/platform owner. Inventory and gate actual provider auto-deploy, promotion, dispatch/rerun, rollback, EAS build/submission and OTA publication paths. Bind full SHA, artifact ID, configuration/schema evidence and final self-critique before the publication side effect. A health 200 alone is liveness.

## Shared-domain review

| Domain | Evidence reviewed | Decision/remaining evidence |
| --- | --- | --- |
| Cost/abuse | Durable quota helper and analysis/enhance/transcribe routes; deny-before-provider tests | Partial controls confirmed; CRE and reflection concurrency/inference caps, distributed enforcement and load need work |
| Authorization | Owner/non-owner/anonymous analysis and non-author CRE projection tests | Specific tests pass; real JWT, direct metadata RLS and every read path remain BLOCKED |
| Identity lifecycle | Shared identity resolver, refresh architecture, mobile tests | Preserve Firefox same-origin refresh invariants; on-device refresh/reset/link acceptance remains BLOCKED |
| Inputs | Audio signature rejection, enhancement size/blank checks, output schema negative controls | Specific tests pass; limits after `formData()` do not prove bounded parsing at hosting edge |
| Events/outbound | CRE, journal dispatch, payment failure transitions, controlled provider URLs | Failures above; no arbitrary-user-URL SSRF conclusion from operator-configured destinations |
| Supply chain | Runtime audit plus separate tooling/mobile audit requests | Findings above; installed/production reachability must be triaged |
| Origin/CSRF | Middleware allowlist and cookie/bearer paths | CORS is not authorization; real cross-site cookie-mutation behavior untested |
| Rendering/headers | Next headers, React output, constant JSON-LD | No generic XSS claim from constant HTML; permissive script CSP and actual response behavior need targeted review |
| Database/storage | Committed migrations, service-role ownership checks, private IPFS flow | Effective live role/storage configuration and restore rehearsal BLOCKED |
| Privacy/finance | Private-save path, deletion source/tests, payment activation, Meta Pixel | Privacy and payment findings remain; base Meta PageView loads without consent when configured, so consent claims need review without declaring jurisdictional compliance |

## Native-specific acceptance

The source production profile is consumption-oriented for Google Play: web3 and Google sign-in flags are false, mobile purchases disabled, remote versioning enabled and submission configured for an internal draft. Source flags are not proof of the actual signed artifact's configuration or store compliance.

Existing mobile tests cover session synchronization, API handling, owner-scoped offline queues, release policy and selected profile/pricing behavior. They do not prove microphone permission, recording codecs, deep links, secure-store persistence after reinstall/upgrade, notification delivery, screen readers or signed binary behavior.

Required evidence remains: exact build/signing/version/runtime/channel; clean install and upgrade; owner switch/offline replay; expiry/refresh/reset; recording/upload/playback; app links/AASA with installed signing identity; account deletion; enabled-feature/policy review; representative Android and iOS device runs. App-version OTA compatibility needs a reviewed new-binary policy when native dependencies change.

## Workflow entry-point coverage

| Entry point | Existing source behavior | Audit/enforcement evidence |
| --- | --- | --- |
| Vercel Git auto-deploy | Described by deploy workflow | Provider ordering/protection BLOCKED; post-deploy workflow is not preflight enforcement |
| CI-completed verifier | Polls health and smoke pages | Full provider artifact binding and acceptance incomplete |
| Git revert rollback | Reverts HEAD and pushes master | Known-good selection, schema safety and verify step not established |
| Vercel previous rollback | Installs mutable CLI version and rolls back | Artifact selection and exact delivery unverified |
| EAS production build/submit | Profile and internal draft submission config | No signed build, store state, device or final audit evidence |
| OTA publication/expansion | Updates configuration exists | Actual channel/runtime/approval workflow not inspected |
| New AI evaluation CI | Deterministic PR/manual test job, no provider secrets | Local implementation only; not a required deployment check |

## Compatibility, recovery and observation plan

Maintain old mobile payload/response fields during fixes; use additive contracts before removal. Do not remove legacy CRE proof reads when changing new verification behavior. Introduce durable job/state/schema prerequisites before deploying consumers, and keep rollback compatible with already queued work and completed payments. Provider migrations in existing user notes are separate work and were not performed.

Before a future release, name an owner and set an observation window/sample minimum; monitor auth/refresh failures, save-to-analysis completion, stuck verification, payment-to-entitlement lag, crashes/ANRs, provider 429s, p95 latency, inference spend and queue age. Set stop/rollback triggers against measured baselines. Backup presence alone is insufficient: demonstrate isolated restore of database, auth identities and media. No exact RPO/RTO or restore proof was supplied.

## Final adversarial self-review

This is a distinct self-review, not an independent external audit.

| Challenge | Counterexample examined | Result |
| --- | --- | --- |
| Coverage | Could mobile caller differences survive green route tests? | GAP: tracker/metadata mismatches found; mobile units do not exercise those journeys |
| Evidence | Could fixture scores, a health response or an export clear a release? | CORRECTED in reporting: fixture CLI stays ADVISORY; artifact/device/provider evidence remains missing |
| Security | Could local vault encryption make the private IPFS upload safe? | GAP: encryption occurs on a separate local copy after plaintext upload; no mitigation verified |
| Compatibility/rollback | Could a completed payment or queued old-client job recover after partial failure? | GAP: entitlement retry and artifact/schema rollback proof incomplete |
| Workflow bypass | Could auto-deploy or manual OTA precede the audit? | GAP: provider/native publication protections not established |
| Decision | Could web typecheck or mobile unit passes justify another target? | CLEAR for decision discipline: per-target NO_GO/BLOCKED retained, no deployment authorized by audit |

No unresolved gap was converted into a pass or risk acceptance. The release decisions remain NO_GO/BLOCKED. Next owner action: address the confirmed privacy/delivery/dependency findings under a separate implementation scope, then provide exact provider/database/device evidence for a fresh audit.

## Verification log

- New deterministic evaluation suite: **38 passed**, including two expected-failure CRE defect regressions; zero paid provider/judge calls.
- Synthetic LangGraph fixture CLI: seven cases completed, **ADVISORY**; no LangSmith publication performed.
- Root and mobile TypeScript: **PASS** after evaluation typing fixes.
- Mobile existing unit suite: **36 passed / 7 files**.
- Root standard-thread regression suite: **147 passed / 9 files**. An earlier VM-pool attempt failed during concurrent dependency setup (Next import resolution and two RecordPage DOM assertions); the standard-thread rerun establishes the result used here. Existing React `act` warnings remain visible.
- Mobile native-mocked component suite: **12 passed / 2 files**; no physical-device acceptance implied.
- Evaluation lint: **PASS**, zero warnings/errors after correcting unused test parameters.
- Application-source lint: **204 files, zero errors, 160 warnings**. No automatic fixes applied; warnings remain a maintainability review backlog, not 160 demonstrated exploits.
- Project post-edit hook: attempted, but the existing `hooks/tsc.js` throws `__dirname is not defined` under this Node 25 ESM interpretation. Direct TypeScript checks were used instead; no hook or package module-mode rewrite was made.
- Strict CLI quality check: **expected exit 1** with `ADVISORY`; uncalibrated semantic evidence cannot produce a quality pass.
- Full root dependency audit: **127 affected entries** (5 critical, 41 high, 62 moderate, 19 low). Additional critical tooling entries include Vitest/coverage and Handlebars; assess their actual CI/UI/template exposure separately from production endpoints. No fixes applied.
- Mobile runtime dependency audit: **64 affected entries** (0 critical, 33 high, 30 moderate, 1 low), including direct high entries for viem and Zod. These are scanner findings requiring reachability/upgrade triage, not proof of 64 exploitable mobile flaws.
- Initial isolated build: failed because the snapshot allowlist omitted `types/background`; corrected the audit helper and reran. This was an audit-harness error, not an application defect.
- Chromium: **two navigation timeouts on each of two attempts**, first with 30-second and then 120-second test budgets, while the isolated server remained in route compilation. Trace archives are in `output/playwright/evaluation-results/`. No browser journey passed; Firefox/WebKit and authenticated browser acceptance were NOT_RUN.
- Corrected isolated web build: did not finish within a local verification window exceeding ten minutes; **terminated and BLOCKED**, not an application compile success or an established app compile defect. Both temporary build/server process trees were stopped. Development compilation timing is not a production latency measurement.
- Final direct root TypeScript and evaluation lint recheck: **PASS** after judge deadline and browser configuration changes.

Changes made in this task: evaluation code/tests, pinned dev dependencies/lockfile, separate evaluation CI, documentation and local synthetic artifacts. Product feature code, production workflows/providers/database, mobile app code and publication state were not changed.
