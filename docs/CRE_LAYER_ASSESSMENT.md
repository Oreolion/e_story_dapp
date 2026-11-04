# CRE layer: usefulness, correctness, and decision evidence

Decision update, 2026-10-28: the user chose to park CRE. Active endpoints are inert, client triggers/polling are removed, and current UI labels verification as coming soon. The former handlers are preserved under `cre/parked-api/`. The assessment below describes the historical implementation and does not describe an active workflow. Use [current runtime operations](AI_RUNTIME_AND_OPERATIONS.md) for the candidate; no deprecation or reactivation decision is implied.

Reviewed 2026-10-26 at source commit `d0cb70220b3ab1b2c48261578205758d0d1db51e`, with evaluation-only workspace changes. No CRE deployment, chain transaction, provider inference, or deprecation was performed.

**Recommendation: retain the implementation for investigation as an optional attestation capability; do not expand reliance on its current verification claims. Decide on deprecation after a bounded comparison with an ordinary durable background worker.** The local evidence proves several application behaviors and defects, not a working deployed DON workflow.

## What it does

1. `app/api/cre/trigger/route.ts` verifies story ownership and creates a pending log.
2. A configured workflow URL receives the title/content/wallet. Otherwise the route launches a direct Gemini fallback.
3. `cre/iStory_workflow/gemini.ts` asks Gemini for significance, emotional depth, quality, word count, and themes through the CRE HTTP capability and identical-result aggregation.
4. `httpCallback.ts` derives a metrics hash and author commitment, computes a quality tier and threshold, ABI-encodes a report, requests report signing, and writes through the EVM client.
5. It sends full metrics to `/api/cre/callback`, while the contract stores minimal derived information.
6. `/api/cre/check` reads cached metrics before falling back to the new or legacy contract.

The contract validates the configured forwarder; workflow identity checks are optional until the owner configures them. The effective deployed forwarder/workflow allowlist was not inspected. The source resolves a testnet and the check API uses Base Sepolia.

## Value it can add

CRE can coordinate execution and report provenance for consumers that need to verify a committed result independently of the app server. An on-chain hash can bind a disclosed set of metrics to a report. It can be useful for an actual external payment/rights/consumer workflow with a defined trust model.

Consensus does not prove a model's subjective score is true, fair, safe, or useful. It cannot substitute for evaluation, authorization, durable delivery, or evidence that a story is human-authored. Chainlink distinguishes consensus in simulation from deployed execution in its [consensus documentation](https://docs.chain.link/cre/concepts/consensus-computing), checked 2026-10-26.

For private journaling, transcription, text improvement, and personal reflections, an ordinary authenticated service plus durable worker generally meets the current application's functional needs with fewer trust boundaries. This is an architectural assessment; no production cost/latency measurements were available to quantify a saving.

## What local evaluations establish

| Check | Result | Evidence |
| --- | --- | --- |
| Invalid callback secret causes no write | PASS with isolated database | `evals/cre.test.ts` |
| Repeated authenticated callback uses a single metrics row | PASS with query double | `evals/cre.test.ts`; real DB uniqueness still needs rehearsal |
| Direct fallback persists metrics without an on-chain transaction | PASS as characterization | Actual trigger/check handlers, model response substituted |
| Direct fallback is returned as `verified: true` | Confirmed semantic/provenance defect | Actual check handler; proof evaluator rejects the missing hashes |
| Metrics write failure does not complete the pending log | FAIL, retained as expected-failure regression | Callback currently completes the log anyway |
| Tier/threshold are validated against quality score | FAIL, retained as expected-failure regression | Callback trusts independently supplied derived fields |
| Deployed DON execution and consensus | BLOCKED | No workflow ID/run evidence inspected |
| Transaction finality and deployed receiver roles | BLOCKED | No receipt, bytecode or effective role evidence inspected |
| Private/confidential provider transport | NOT ESTABLISHED | Source uses `HTTPClient` with TODOs for confidential transport |

The duplicate callback test proves query behavior against an isolated double, not distributed idempotency under conflicting DON payloads. The HTTP trigger's accepted response does not prove eventual completion. The callback returns success even for rejected authentication and storage failures, so HTTP status alone is not a success metric.

## Additional design concerns

- Direct fallback writes no explicit provenance field. Cache presence drives `verified: true`; distinguish `analyzed`, `attested`, `confirmed`, `failed`, and `unavailable` explicitly in a proposed versioned contract.
- Trigger dispatch is unawaited and does not inspect a failed HTTP status. There is no demonstrated durable retry, lease, completion deadline, or dead-letter reconciliation.
- Quality is computed separately from the main analysis, using different prompts, ranges, and potentially a different Gemini model. This creates extra inference work and possible disagreement.
- `consensusIdenticalAggregation` receives model-derived results. Low temperature is not a guarantee of identical model outputs across independent requests. Measure failure/consensus behavior in a deployed test workflow; do not claim that local simulation proves it.
- Word count is requested from the model even though a versioned deterministic counting function can calculate it.
- The metrics salt is deterministic from story ID; author commitment is recomputable for a candidate wallet and story ID. These provide commitments, not an anonymity guarantee or encryption of journal text.
- A signed/cached result needs binding to story content revision, prompt/model version, workflow execution, environment, and final chain receipt. A story ID alone does not prove what content was evaluated.
- Configuring the forwarder is necessary but may be insufficient without an expected workflow identity. Verify actual deployed settings before assigning exploitability.

## Bounded decision experiment

Use 30 reviewed synthetic stories and the same scoring contract for two paths: a direct durable worker and CRE. Run in a dedicated test environment only. Do not execute historical operational scripts or send private journal content.

Measure total completion p50/p95, model calls/attempts, provider tokens and cost, CRE execution charges, gas, consensus failure rate, callback loss, recovery duration, duplicate/out-of-order outcomes, and quality agreement. Include timeouts, provider 429s, callback 500/200-with-failed-write, chain failure, and a story edited during processing. Count all calls even when consensus or delivery fails.

Evidence required to keep and promote CRE:

- A named external consumer needs verifiable execution rather than a platform badge.
- A bound workflow run, receipt, contract/chain, content revision and proof can be independently checked.
- Correct recovery and truthful provenance survive fault injection.
- Incremental latency, cost and operational ownership fit agreed budgets.
- Privacy claims match the actual deployed transport and data flow.

If these conditions cannot be demonstrated, deprecate the **active dependency** behind a compatibility plan: stop new CRE work first, preserve historical proof reads and old-client response fields, observe backlog/retries, then remove unused runtime/developer dependencies separately. Do not delete historical proofs or legacy read support as part of a UI cleanup. No deprecation decision has been executed.

See [the production audit](PRODUCTION_READINESS_AUDIT_2026-10-26.md) and [the platform improvement guide](PLATFORM_IMPROVEMENT_GUIDE.md).
