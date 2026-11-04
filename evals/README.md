# AI evaluations

Current local implementation: 2026-10-29. Runbooks and workflow details: [AI runtime and operations](../docs/AI_RUNTIME_AND_OPERATIONS.md). No live database changes, paid inference, remote publication, or release is part of these checks.

## Commands

```powershell
npm.cmd run eval:ai:check
npm.cmd run eval:ai
npm.cmd run eval:ai -- --product
npx.cmd tsc --project evals/tsconfig.json --noEmit
```

The default runner scores 42 authored synthetic regression cases using fixture outputs. `--product` executes the shared production prompt builders, LangGraph and parsers with controlled provider responses. Both make zero paid calls and return **ADVISORY**, because the corpus has not been human calibrated. The CLI writes `output/evaluations/latest.json` and `latest.md`; copy them before the next run if you need to compare modes. The manifest records mode, selected case IDs, versions via source hashes, HEAD, dirty status, call counts and budget configuration. A successful process does not establish model quality.

The corpus contains 9 analysis, 9 enhancement, 7 tracker, 7 reflection, 5 transcription and 5 pattern-count cases. Scenarios cover negation, uncertainty, quantities/units, quotations, Unicode names, redacted details, embedded instructions, sparse evidence, planned versus completed actions and prototype-shaped theme keys. These references were authored for deterministic regression checks; independent human review and model-quality calibration remain outstanding. Text placeholders test content preservation, not authorization or tenant isolation. Transcription cases exercise the text adapter and grading only; no acoustic fixtures or speech-recognition quality are claimed.

`corpus.test.ts` checks every case against its own controlled product target and tests that corrupted claims/entities fail. Separate negative cases verify empty/oversized input rejection, malformed output, provider failures without retries, strict schemas, excessive reflection sources and empty-source behavior. Intentional rejection cases are kept out of the successful-output CLI dataset. Book compilation is covered by publication/API tests because it is not a supported AI evaluation task.

The isolated verifier supplies its complete source-snapshot fingerprint. Such reports explicitly record `sourceKind: isolated-snapshot`, a null Git SHA and `sourceCommitted: false`; no synthetic Git history is created. Outside that mode, Git metadata is required before execution. A quality-pass request also requires committed source. Neither a source fingerprint nor a clean commit establishes release readiness.

```powershell
npm.cmd run eval:ai -- --require-quality-pass
```

This must exit nonzero for the current unreviewed corpus. Errors, missing results and invalid configuration produce INCONCLUSIVE evidence, never an old passing report.

## What the suites establish

| Suite | Coverage | Limits |
| --- | --- | --- |
| `tasks`, `production-workflow` | Actual shared prompts, strict output schemas, bounds, no implicit retries, tracing configuration fails closed before inference | Controlled generator; no live quality measurement |
| `postgres/durability` | Real PostgreSQL SQL through PGlite: atomic enqueue, fencing, stale revisions, annotations, quota and call budgets, grants, payment activation/replay/credit | Single exclusive embedded connection; not deployed RLS or multi-connection load proof |
| `postgres/compatibility`, `legacy-clients` | UUID/TEXT owners, grandfathered fields, prior pending/completed payments, legacy upload/save/analyze flows with actual wallet JWT verification | Supabase transport and external providers substituted; no live customer rows |
| `routes` | Actual HTTP handlers and PostgreSQL: save, worker execution, metadata readback, cookie/bearer callers, reflection, mobile DTO | Auth principal and external provider substituted; no production JWT/middleware/device proof |
| `payment` | Actual HMAC handler, strict receipt validation, transactional entitlement, outbox replay, frozen email body/idempotency key | Synthetic receipt, mocked provider; no charge or email delivery |
| `publication`, `cre` | Reject private/unconfirmed public uploads; explicit public publication; parked CRE endpoints make no provider/storage/chain calls | Mock publication provider; no remote storage permissions proof |
| `metrics`, `graph`, `judge`, `live-budget` | Code-based checks, references excluded from target, deadlines/concurrency, coverage failures, selective judge budget, conservative live-call admission | Judge remains uncalibrated; lexical checks do not prove semantic faithfulness |

Web component/API tests also exercise public/private save, queued-state messaging, metadata polling and account switches. Mobile tests include paginated pattern aggregation and rejection of a previous account's late result. CRE is excluded from model-quality scoring because it is parked, not treated as a passing verification workflow.

## Optional live synthetic experiment

Only run with explicit authorization to spend. Configure the server-side Google API key through an approved secret mechanism. Supply all four numeric flags with current prices from your provider contract:

```text
npm run eval:ai -- --live --budget-usd=YOUR_CAP --input-price=USD_PER_MILLION --output-price=USD_PER_MILLION --max-cases=COUNT
```

Replace the uppercase values; they are deliberately not executable defaults. Admission rejects missing/nonpositive prices or limits, caps the budget at USD 5 and calls at 20, reserves estimated input plus maximum output and thinking tokens before each generation, and runs one case at a time. There is no automatic retry. Actual selected fixtures may be fewer than the call cap. Usage is an estimate, not an invoice; absent usage stays unknown while the reservation remains spent. Token-count requests are tracked separately. Live mode covers analysis, enhancement, tracker and reflection; transcription/audio and patterns are excluded explicitly. It does not turn the unreviewed corpus into a benchmark. No live experiment was run during this implementation.

## Optional LangSmith publication

Configure `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, and the appropriate endpoint/workspace through approved server-side configuration, then explicitly add `--publish` to a runner command. This creates a content-versioned synthetic dataset and publishes precomputed deterministic scores. Example inputs contain case IDs/workflow names; trace inputs/outputs are hidden. No journal prose or audio is uploaded. Publication was not performed here; workspace permissions, destination and delivery still need verification.

Private production inference fails closed when ambient LangSmith/LangChain tracing, verbose mode or LangSmith OTEL is enabled. Run synthetic evaluations in a separate process. Do not enable production tracing to make evaluation publication work.

## Browser and CI

The root Playwright config loads local environment files. Use the separate evaluation config and an isolated synthetic server:

```text
node scripts/verify-isolated.mjs --tests
node scripts/verify-isolated.mjs --mobile
node scripts/verify-isolated.mjs --lint
node scripts/verify-isolated.mjs --cli
node scripts/verify-isolated.mjs --build
```

Run heavyweight modes sequentially with a supported Node executable. Each mode writes a separate temporary source snapshot, fingerprint, logs and exit reports; dependency directories are linked without installation. The snapshot excludes environment/credential/private-key files and supplies synthetic configuration. `--build` has a bounded compilation stage, then starts its own localhost server, verifies its served build manifest against the new artifact, runs Chromium/Firefox acceptance and stops its server. Existing browser engines must be installed separately. Resume only needed checks with `--evaluations`, `--types`, `--compat` or `--mobile-types`; timed-out stages never pass. Public browser checks do not establish authenticated flows, native-device behavior or real provider behavior. The older `audit-snapshot.mjs` remains historical tooling and is not the current verification entry point.

`.github/workflows/ci.yml` calls the reusable AI evaluation workflow before its production build and Chromium/Firefox acceptance job. The reusable workflow runs deterministic checks and the two zero-cost CLI modes, then uploads reports. The aggregate **Release checks** job rejects skipped, failed or cancelled prerequisites. Mobile CI remains separate for the unreleased app. Remote execution and provider/branch protection remain unverified; see [release gate setup](../docs/RELEASE_GATE_SETUP.md). Repository wiring cannot enforce an independent provider promotion by itself.

## Evaluation-driven changes

Add a failing regression for the concrete failure; change the shared production implementation; rerun that test and relevant journeys. Use schema/functions/transactions and ordinary assertions for correctness, privacy, authorization, quotas and persistence. Use reviewed holdout examples for semantic quality. A judge is appropriate only for criteria code cannot establish; calibrate against human labels, report disagreement, cap calls, and retain deterministic failures regardless of averaged scores. Never feed references into the target or claim mock latency is inference latency.
