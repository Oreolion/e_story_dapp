# Production audit repair plan

## Accepted plan and release boundary — 2026-10-30

Objective: repair the application and produce evidence sufficient for a production review while preserving supported wallet flows, existing user data and private inference. This is the implementation plan accepted by the user. On 2026-11-02 the user authorized a direct push to master after the required verification, replacing the proposed external PR-approval requirement. Production safety gates still apply because a master push can trigger Vercel. No production database migration or manual release promotion is authorized by that reply.

The current phases below are **pending verification**. Existing code, previous test results and the historical milestone record do not by themselves satisfy these acceptance conditions. Mark a step complete only when its evidence identifies the source, environment and artifact actually tested.

### Decisions and constraints

- Use free tiers and existing included allowances only. Do not add charges, purchase capacity, run paid inference or transfer mainnet funds. If a required capability is unavailable at zero cost, record the blocker and the evidence needed to resolve it.
- Preserve supported wallets. Prefer compatible dependency upgrades. A narrowly scoped, reviewed and verified temporary security backport is permitted when required to preserve compatibility; retain the raw advisory report and gate the backport on integrity checks and exploit regression tests.
- Legacy account recovery requires both a fresh wallet proof and a server-verified Google proof. Do not auto-link by email or user-editable metadata, and do not merge account data automatically.
- Complete the production review checkpoint before the authorized direct master push. Do not bypass required checks; production migrations and manual rollout expansion remain separate actions.
- Mobile has not been released. CRE remains parked; onchain verification remains coming soon.

### Phase 1 — Establish isolated staging within available allowances

- [ ] Discover and record the actual provider entitlements, quotas and included capabilities without exposing credentials.
- [ ] Establish separate Vercel and Supabase staging resources within those allowances. Use synthetic accounts and content only, with staging-owned Auth, storage, worker and provider configuration.
- [ ] Validate origin, project and network guards so a staging test cannot silently target production or mainnet.
- [ ] Keep provider integrations mocked by default. Require an explicit synthetic-recipient allowlist for any permitted staging email path.
- [ ] Record any zero-cost provisioning or capability blocker instead of purchasing a substitute.

Acceptance: staging identity and isolation are verified against the actual resources; configuration inventory contains names and presence checks rather than secret values; default runs cannot send production messages, spend money or mutate production data. Expected test volume fits the confirmed allowances before execution.

### Phase 2 — Resolve dependency security findings without dropping wallets

- [ ] Apply compatible dependency and parent-package upgrades first, retaining the supported wallet matrix.
- [ ] Review each remaining high/critical advisory for affected installed copies and reachable behavior; preserve the original audit findings.
- [ ] Where an upgrade cannot preserve compatibility, prepare a narrow temporary backport for explicit review, covering every affected installed copy.
- [ ] Record the dependency inventory/SBOM, original versions, patched hashes, patch provenance and removal/upgrade path for each backport.
- [ ] Gate the installed result on patch-integrity checks, exploit regression tests and wallet behavior tests.

Acceptance: zero **unremediated** high or critical findings remain. A raw scanner finding is not silently erased or treated as waived; any verified backport has reviewable evidence explaining the remaining version-based alert. Supported wallets still function under the tested dependency graph.

### Phase 3 — Make identity binding and legacy recovery explicit

- [ ] Resolve authenticated principals to canonical accounts through server-owned identity mappings.
- [ ] Add a single-use challenge with a five-minute lifetime for the approved recovery/binding flow.
- [ ] Verify Google authentication server-side and require a fresh wallet proof bound to the challenge and intended account operation.
- [ ] Enforce uniqueness and challenge consumption atomically, including concurrent/replayed requests.
- [ ] Remove browser-side email linking and identity writes; do not trust user-editable metadata as an account binding.
- [ ] Preserve the same-origin Firefox refresh proxy and existing browser-auth compatibility requirements.
- [ ] Route conflicting or legacy mappings through explicit recovery; do not merge data or infer ownership automatically.

Acceptance: valid direct and linked identities retain access; missing, expired, replayed, mismatched and concurrent proofs fail safely. An attacker-controlled email or metadata field cannot select another account. Browser and API tests cover the real principal types and the Firefox refresh path.

### Phase 4 — Rehearse database, storage and payment transitions

- [ ] Inspect the actual database catalog through read-only preflight checks, including owner-column types, relevant grants, policies, functions and migration state.
- [ ] Rehearse migrations 020–022 and any new SQL on both a fresh schema and a synthetic production-shaped schema.
- [ ] Run real PostgreSQL tests with multiple independent connections for concurrency, uniqueness, quotas, leases, fencing and replay behavior.
- [ ] Exercise database roles and storage access boundaries with synthetic principals, including denial cases.
- [ ] Verify historical payment reconciliation against authoritative provider evidence and the approved receipt/entitlement rules before considering a rollout.

Acceptance: the migration sequence is compatible with the observed catalog; concurrent requests cannot duplicate jobs, entitlements or challenge consumption; unauthorized role/storage access fails; historical receipt treatment is verified rather than inferred. No production migration is applied during this phase.

### Phase 5 — Validate bounded background work and free inference

- [ ] Verify that the selected free/included environment supports Supabase Cron, pg_net and Vault for the planned scheduler.
- [ ] Configure a ten-second scheduling cadence that dispatches only due work. Keep independently controlled workers disabled by default until their checks pass.
- [ ] Enforce a 25-second provider timeout, 45-second lease, 90-second overall limit and at most two attempts.
- [ ] Preserve the existing global limit of eight and per-owner limit of two; charge every attempt against its admission budget.
- [ ] Permit at most eight total and four-per-day staging AI calls only where the provider quota is guaranteed free. Otherwise mark live inference verification blocked and retain mocked execution.
- [ ] Exercise timeout, stale lease, retry exhaustion, duplicate dispatch and worker pause/resume behavior without uncontrolled external calls.

Acceptance: workers process eligible jobs, stop at their configured limits, account for every attempt and recover without duplicate effects. Scheduling and provider capabilities are evidenced in staging; missing free quota is not an authorization to spend.

### Phase 6 — Bind CI and staging execution to the reviewed source

- [ ] Add a trusted, manually invoked staging workflow bound to a full commit SHA.
- [ ] Run the verification pipeline on Node 22/Linux and include SQL concurrency, backport integrity/exploit checks and staging acceptance in the aggregate gate.
- [ ] Prevent secrets from reaching untrusted pull-request jobs.
- [ ] Install and verify master/Vercel protections and bypass controls using authorized access, retaining evidence of the effective settings.
- [ ] If a required protection feature is unavailable, implement and verify an equivalent controlled release path; otherwise record a blocker.

Acceptance: the aggregate result covers the exact source and required jobs, and an alternate entry point cannot silently bypass the release checks. A workflow file alone is not evidence that remote branch or provider protection is effective.

### Phase 7 — Complete evaluation and staging acceptance

- [x] Review a corpus of at least 42 synthetic cases and its deterministic assertions. Keep independently calibrated model-quality claims separate from fixture coverage. Local corpus assertions passed; hosted acceptance remains pending.
- [x] Use deterministic checks first; no LLM judge is required for this acceptance run. Local evaluation runs made no live model calls.
- [ ] Exercise actual sandbox integration contracts where free/included access is available, distinguishing them from mocks.
- [ ] Measure warm API p95 latency below two seconds at one request per second with at most five clients, within confirmed allowances.
- [ ] Measure queued-work p95 completion below two minutes and observe staging for two hours with the planned fault scenarios.
- [ ] Reuse the same staged artifact for acceptance and observation, recording its identity and configuration binding.

Acceptance: functional, security, concurrency, failure-path and latency checks pass with source-bound evidence. Paid/live calls are not substituted for missing free capabilities. Fixture success does not establish acoustic transcription quality, calibrated semantic quality or a production integration that was not exercised.

### Production review package and stop conditions

- [ ] Assemble the exact source SHA, CI results, artifact identifiers, migration manifests, environment inventory and unresolved evidence gaps.
- [ ] Document safe retained-schema rollback for authentication and receipt processing, including compatibility with data written during the candidate's operation.
- [ ] Define cutover sequencing, in-flight work draining, independent worker pauses, rollback triggers and explicit stop conditions.
- [ ] Complete the required final production-readiness audit and adversarial self-critique with a decision for each requested target.
- [ ] Complete the production review checkpoint before the user's subsequently authorized direct master push. Apply the production audit gate before that side effect and verify actual delivery afterward; no database migration is implied.

Missing evidence, failed safety/compatibility checks, unexpected provider charges, broken identity/storage boundaries or inability to enforce the release path are stop conditions. Do not waive them because local fixture tests pass.

If production is subsequently approved, create and verify a production-specific build with its production environment binding. Do not promote a staging build that compiled staging environment values. Production migrations, deployment and post-release delivery verification are later authorized actions, not completed steps in this plan.

---

## Prior milestone record — historical evidence, not current acceptance

The following 2026-10-28 plan and progress statements are retained from the earlier repair milestone. R1/R2 concern schema compatibility, R3 publication compatibility, R4 analysis compatibility, and the additional identity-resolution regression is the subsequent R5 finding. Historical checked boxes do not certify the current expanded scope, current source or a deployable artifact.

Date: 2026-10-28. Branch: `feature/production-audit-repairs`.

Objective: resolve the reproduced compatibility failures and establish reproducible verification before a master push can trigger production. Mobile is unreleased; no staging environment exists. The audit's original evidence is preserved in the temporary `istory-prepush-1ndsnT` directory. This plan authorizes implementation work through the user's request; production deployment remains subject to the release gate.

### Earlier work and acceptance criteria

1. **Database compatibility (R1/R2).** Exercise migration 020 on UUID and historical TEXT owners. Normalize UUID boundaries without rewriting existing columns. Grandfather unchanged legacy content/title on unrelated updates, while enforcing new limits on inserts and field changes. Test enqueue, claim, completion, retry, quota, ownership and counter updates on both layouts. Rehearse the complete 020–022 sequence with synthetic data and role-denial checks.
2. **Publication compatibility (R3).** Preserve explicit publication consent. Recognize legacy metadata's explicit `is_public:true`; return a truthful unpublished result for legacy private story metadata so its subsequent database save can proceed. Reject missing/ambiguous intent and contradictory nested private content. Keep unconfirmed audio private. Test old public/private request shapes and the actual save sequence, including no provider call for private content.
3. **Analysis compatibility (R4).** Distinguish legacy inline callers from queue-aware callers. Pending legacy requests must not receive a success response that their UI interprets as a completed insight. Completed legacy requests must receive persisted metadata. Test stale/missing results, ownership, repeated enqueue, pending/failure/completion and new-client polling.
4. **Verification tooling.** Canonicalize Windows paths in an isolated runner, use an explicitly selected supported Node executable, exclude secret-bearing files and inject synthetic configuration. Run web/evaluation/mobile tests and type checks, lint, a completed production build, deterministic PostgreSQL/HTTP integration and local browser journeys. Preserve outputs and source fingerprints. Fix failures rather than treating skipped/zero-test execution as success.
5. **Release workflow and operations.** Put deterministic evaluations and migration regression coverage in the actual CI dependency graph, cover operational changes, and require browser acceptance before its release job. Document and verify worker scheduling/configuration, mixed-version payment receipts, rollback and exact artifact identity. Repository configuration cannot establish inaccessible provider settings; record any external prerequisite with its required evidence.
6. **Final challenge review.** Re-run the production audit against the corrected source and artifact. Separate reproduced fixes from remaining production configuration/provider evidence. Push only if the release gate clears the exact candidate; do not waive unknowns or perform production mutations to manufacture evidence.
7. **Identity resolution and mobile notifications.** Reject user-editable wallet metadata as an account binding. Preserve direct authenticated IDs and accept a different ID only through a verified server-owned binding. Inventory legacy linked accounts before rollout. Repair mobile notification envelopes, read/delete DTOs, failure acknowledgement and account-switch isolation; present unavailable remote push delivery truthfully.

### Earlier scope and safety decisions

- No public publication without explicit intent. A legacy private save must not leak content just to preserve an obsolete UI success message.
- No inline model call added to emulate the old analysis endpoint. The durable job remains the execution authority; compatibility responses do not increase inference spend.
- No destructive migration, customer-content inspection, payment, email, chain transaction or production data mutation is needed for local repair tests.
- Keep changes on the short-lived feature branch, preserving unrelated existing work. Production migrations, provider settings and branch protection need normal authenticated access and release evidence; missing tools are recorded accurately.
- A successful fixture run establishes deterministic behavior under its stated boundaries. It does not establish live OAuth, provider delivery, production grants or semantic model quality.

### Earlier progress

- [x] Preserve audit evidence and create isolated repair branch.
- [x] Add failing compatibility regression tests.
- [x] Correct R1/R2 SQL and prove both schema layouts.
- [x] Correct R3/R4 contracts and prove legacy/new callers.
- [ ] Restore isolated verification and complete build/tests.
- [ ] Strengthen CI and operation/rollback regression coverage.
- [ ] Complete final release audit and record unresolved external prerequisites, if any.

The additional identity regression reproduced cross-account resolution through editable metadata before its fix. Direct-ID and server-bound-ID tests pass with the corrected resolver. Existing linked accounts without a direct ID or verified `app_metadata.istory_user_id` binding require controlled reconciliation; do not populate that binding from user-editable metadata. This is an explicit rollout prerequisite, not an assumed compatibility pass.
