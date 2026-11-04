# Production repair verification — 2026-10-29

**Web/API: NO_GO for production. Android and iOS: BLOCKED for release; both remain unreleased. No production push, deployment, migration, scheduler registration, payment, email, model call or LangSmith publication was performed.** These decisions do not imply that a release was attempted. OTA publication is outside the requested release scope.

Candidate: uncommitted work on `feature/production-audit-repairs`, based on `d0cb70220b3ab1b2c48261578205758d0d1db51e`. HEAD alone does not identify this candidate. Verification snapshots below identify their actual source through SHA256 manifests. Existing unrelated worktree edits were preserved. The target production domain is `estories.app`; live provider configuration and schema have not been established for this candidate. No risk acceptance was inferred from instructions to proceed.

## Latest verification checkpoint (supersedes pending results/counts below)

Final root snapshot: `aacb5c844500e726425a674736ac42d92afeae733a22e047b93779f1ef1289e7`. `istory-verify-K3hw2X` passed 131 web tests, 103 evaluations and web/evaluation types. `istory-verify-nsaKCt` passed the production build in 15m32s, BUILD_ID `7WF6j2A7m2Ua2qqYjkaRC`. Its initial 30-second server-readiness attempt failed. A bounded retry verified captured source hashes and the served build manifest, became ready in 23.3s, and passed the Chromium/Firefox suite (exit 0). The first transient startup failure's precise cause is unproven. Both fixture and product-mock CLIs passed in `istory-verify-kM0Uxn` with this same source fingerprint. Mobile: 51 unit + 12 component tests and types passed in `istory-verify-o9MdMN`.

An updated Coinbase SDK caused missing optional x402 modules; restoring previously working CDP SDK 1.38.6 through an explicit override repaired compilation. Final post-pin runtime audit: **0 critical, 15 high, 19 moderate, 6 low** (`istory-runtime-audit-after-cdp-pin.json`); full audit: **0 critical, 21 high, 41 moderate, 26 low** (`istory-full-audit-after-cdp-pin.json`). These supersede earlier counts. Mobile source/dependencies were unaffected by the root pin. No finding was waived.

Browser-provider access was unavailable and native Firefox activation failed. Automatic permission-review capacity/deadline failures also delayed local commands and evidence updates; permitted retries succeeded for verification. No live provider configuration was established. Web/API remains **NO_GO**, native **BLOCKED**, for the unresolved identity lifecycle, dependency, staging/database/provider/protection and exact committed-delivery gaps below. No push or deployment occurred.

## Repairs and regression evidence

| Finding | Local repair | Verification and remaining boundary |
| --- | --- | --- |
| R1: migration assumed UUID story owners | Compare historical TEXT and UUID owners at compatible boundaries; preserve UUID job/quota identity | Both layouts exercise save, deduplication, owner denial, claim, retry and completion using actual PostgreSQL SQL |
| R2: new limits rejected unrelated legacy updates | Validate only inserted/changed fields; preserve unchanged grandfathered content; skip analysis enqueue for oversized legacy content | Counter updates and correction of one field pass; newly introduced oversized text/title still fails |
| R3: old metadata upload blocked story saves | Accept explicit legacy public intent; private metadata returns an unpublished result without a provider call; reject ambiguous/contradictory publication | Legacy upload → actual save sequence passes with actual wallet JWT verification and TEXT-owner SQL |
| R4: old inline callers interpreted 202 as completed insights | Legacy pending calls receive non-success pending status; completed calls receive persisted current-revision metadata; new callers retain 202 | Pending, stale/missing metadata, completion and denial cases pass; no inline inference fallback |
| R5: editable metadata selected another account | Remove `user_metadata.wallet_address` as an authority; preserve direct IDs and require a verified server-owned cross-ID binding | Regression reproduced the old cross-account resolution, then passed with the repair. Existing linked-account lifecycle is a release blocker below |
| Mobile notification contract | Match server envelope/read flag and mutation DTOs; preserve state on failure; discard late responses after logout; present unavailable remote push honestly | Twelve focused unit cases pass; no retired registration POST, token collection or new OS permission request |
| Release shortcuts and stale identity | Aggregate AI/SQL/browser/security checks; read-only exact revert preparation; compare complete delivered commit with no-store health response | YAML/references/dependency graph checked locally. Remote CI/provider enforcement is not established |
| Verification tooling | Canonical Windows paths, synthetic environment, excluded secrets, bounded child processes, source manifests, explicit isolated CLI provenance | Real parser/template failure and missing-Git failure were found and corrected; isolated reports never fabricate committed source |

R5 follows [Supabase's authorization guidance](https://supabase.com/docs/guides/auth/users), checked on 2026-10-29: user metadata is editable. No production account was used to reproduce the issue.

## Checks actually performed

All paths below are under `C:/Users/HP 240 G9/AppData/Local/Temp/`. Logs and `*-result.json` files record UTC times, process outcomes and source fingerprints. Local checks use Node **24.22.1**; CI specifies Node 22, whose clean Linux execution remains unverified.

| Check | Result | Evidence directory |
| --- | --- | --- |
| Web tests | 131 tests / 12 files PASS | `istory-verify-Egnflq` |
| Deterministic evaluations before added provenance cases | 95 tests / 13 files PASS | `istory-verify-Egnflq` |
| Web and evaluation TypeScript | PASS, exit 0 | `istory-verify-Egnflq` |
| Expanded evaluations including provenance | 103 tests / 14 files PASS | `istory-verify-x3FW4B` |
| Fixture and product-mock CLI | Both exit 0; ADVISORY; six cases each, zero provider/judge calls | `istory-verify-RD13fr` |
| Mobile unit/components/types | 51 unit + 12 component tests PASS; typecheck exit 0 | `istory-verify-o9MdMN` |
| Broad root lint | PASS; zero errors, 179 warnings | `istory-verify-8Ctb9n` |
| Final tooling types/lint | Web and evaluation types exit 0; lint exit 0 | `istory-verify-EVTI5D`, `istory-verify-E4yxPY` |
| Final production build and browser acceptance | Running/pending; no current pass claimed | Final sequential verification run |
| Runtime dependency audit | FAIL release threshold: 0 critical, 14 high, 16 moderate, 6 low | `istory-runtime-audit-final.json` |
| Full dependency audit including development tooling | 0 critical, 20 high, 38 moderate, 26 low | `istory-full-audit-20261029.json` |

Key fingerprints: root `Egnflq` = `45882632590cc1a7ab7d6a4ea4bea73adcfb66f679b580aaf1d80e7dab694492`; mobile `o9MdMN` = `bdc0ecacdb26903e719ceb18bd112b5493dc855e5688f553478dcecccbea7858`; expanded evaluations/CLI = `6874c9b98830d0a5f7a71065c9851d075ae180ccfb50b1876908077118f73822`. Later script/workflow-only edits require their own validation or an explicit source-equivalence comparison; they do not retroactively change these fingerprints.

The earlier production build `ZfUOTcqPyf570CnXqBN0A` and four Chromium/Firefox public tests passed in `istory-verify-iVNUr6`. Dependency and identity changes superseded that artifact. A subsequent overlapping build timed out at 20 minutes without a BUILD_ID (`istory-verify-gIIAuS`). Web/lint/mobile-type attempts also timed out during low-memory contention; successful sequential retries are listed above. Failed/timed-out evidence is retained and is never counted as a pass.

The source fixtures replace Supabase transport and external providers. JWT tests verify real wallet signatures/expiry, but do not establish live OAuth refresh, effective production RLS/storage grants or native-device behavior. PGlite executes real SQL through one exclusive connection; competing real PostgreSQL connections remain untested. Synthetic semantics and mock timings are not model-quality, inference-cost or production-latency measurements.

## Remaining release blockers and owner actions

1. **Wallet dependencies:** removal of unused Chainlink MCP, root Zod4.6.7, compatible leaf patches and wallet updates reduced runtime high entries from 30 to 14. Remaining entries include transitive/meta findings through wallet libraries requiring Zod3. Do not force incompatible Zod4 into their contracts, or equate scanner counts with demonstrated exploitation. Remediate/replace through tested upstream-compatible changes; no reachability exemption or owner acceptance exists. The new CI runtime audit intentionally holds the aggregate check red.
2. **Linked identities:** current linking handlers do not create `app_metadata.istory_user_id`. Inventory direct/cross-ID accounts, design and verify the complete authenticated linking/recovery lifecycle, and reconcile existing links with independent proof of both identities. Never promote editable wallet metadata or client-supplied Google IDs into authority. The resolver fix prevents the reproduced attack but does not prove compatibility for every existing linked account.
3. **Database and providers:** inspect effective schema/grants with `supabase/preflight_runtime.sql`; rehearse 020–022 against a matching isolated target, actual roles and concurrent connections. Verify provider receipt contracts, old completed payments and deferred-credit recovery in a sandbox. No production migration is installed by this task.
4. **Staging and workers:** no staging environment exists. Provision an isolated database/provider test target; exercise authenticated saves, OAuth/session refresh, queue delivery, opt-out, failures and payment notices there. Register authenticated POST schedulers, set budgets/secrets through protected interfaces, and prove old handlers drained before enabling new consumers.
5. **Protection and delivery:** configure/verify Vercel Deployment Checks and master rules requiring **Release checks**, including bypass permissions. Bind a clean candidate commit and successful remote run to the actual Vercel deployment, migrations and scheduler. Prepare a compatible rollback artifact, observation window and release owner before promotion. A healthy old deployment cannot validate this candidate.
6. **Quality and native acceptance:** calibrate reviewed holdouts and selective judges, validate representative audio, signed native builds/devices, offline/account-switch journeys, accessibility and feature acceptance. Mobile tests establish code behavior only. Broader platform improvements in the original audit remain partially implemented.

## Production entry-point coverage

| Entry point | Actual local coverage | Unresolved enforcement |
| --- | --- | --- |
| Vercel Git auto-deploy from master | CI now has aggregate runtime security, lint/types/tests, AI/SQL, build/browser and contract prerequisites | Vercel domain-assignment checks/master protection and bypasses not verified |
| GitHub post-CI production verification | Full expected SHA and no-store health signal; public smoke probes; no active deploy step | Has not run for this candidate; observes delivery after independent Git deployment |
| Manual GitHub rollback dispatch | Read-only preparation of explicit commit revert patch; no push or Vercel promotion | Patch is untested until reviewed/validated through normal release flow |
| Manual Vercel CLI/dashboard promotion/retry/rollback | Covered by standing audit instructions and runbook | Provider access and actual protection unavailable; cannot claim automated enforcement |
| Native/EAS/store/OTA commands | Standing audit gate; mobile CI type/tests/export coverage | No signed artifact, store submission, OTA rollout or installed release verification |

Computer-use preference was added to the global agent instructions. Firefox access was approved, but automatic review rejected a screenshot of an unrelated LangSmith window because it could expose private content outside the deployment inspection. No bypass was attempted. A dedicated Vercel/Supabase window was requested; neither appeared in the last inventory. Provider inspection remains blocked on the intended dashboard/access.

## Final challenge review

This is a self-review, not an independent security audit.

| Challenge | Evidence and conclusion | Result |
| --- | --- | --- |
| Coverage: could an old caller/account/payment be omitted? | Old public/private save and inline analysis, both owner layouts and prior payment rows were exercised. Cross-ID identity lifecycle and authenticated provider journeys remain unproven | GAP |
| Evidence: could stale mocks/builds look green? | Recorded separate snapshots, failed runs and superseded build; added full SHA/no-store delivery identity and explicit uncommitted snapshot provenance. Final build still pending | GAP |
| Security: does passing code compensate for an authorization/dependency issue? | Reproduced and repaired editable-metadata takeover path; runtime advisories and effective deployed grants remain unresolved | GAP |
| Compatibility/rollback: could old server writes or receipts break cutover? | Legacy regression coverage and exact rollback preparation help; old-handler drain, linked-account reconciliation and real provider receipts require staging | GAP |
| Workflow bypass: can a skipped check or independent promotion still ship? | Aggregate rejects skipped/cancelled/failed prerequisites and includes runtime audit; direct workflow rollback shortcuts removed. External Vercel/manual bypass controls remain unknown | GAP |
| Decision: does local success justify production/native readiness? | No release artifact/environment/provider/device binding or risk acceptance exists. Keep web NO_GO and native BLOCKED | GAP |

These gaps are explicit release blockers. The full plan and required operational proof are in [the repair plan](PRODUCTION_AUDIT_REPAIR_PLAN.md) and [release gate setup](RELEASE_GATE_SETUP.md).
