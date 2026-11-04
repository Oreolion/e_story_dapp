# Production hardening implementation — 2026-10-28

Local candidate on `feature/ai-workflow-cre-park`, based on `d0cb70220b3ab1b2c48261578205758d0d1db51e` plus uncommitted changes. Existing unrelated user edits were retained. Nothing was committed, pushed, deployed, migrated to an external database, sent as a real notification, published to LangSmith, or submitted on-chain. No paid inference was run.

The implemented workflow and rollout instructions are in [AI runtime and operations](AI_RUNTIME_AND_OPERATIONS.md). Evaluation commands and limitations are in [the executable README](../evals/README.md). This supersedes the intermediate [2026-10-27 status](IMPLEMENTATION_STATUS_2026-10-27.md); it does not replace the historical production audit.

## Implemented locally

- **CRE containment:** active trigger/callback are inert 410 endpoints; check reports unverified/coming soon. Removed runtime triggers and polling. Web/mobile cards, homepage, pricing and terms no longer promise CRE consensus, proof of authorship or attested quality. Former handlers are archived in `cre/parked-api/`.
- **Privacy and publication:** private cloud saves skip public IPFS/audio publication. Public endpoints require explicit intent and reject private metadata; book compilation requires publication confirmation. Private cloud audio is deliberately held. Record screens explain provider processing and cloud versus local storage. This cannot erase historical public publication or prove deployed storage grants.
- **Durable analysis:** migration 020 atomically enqueues eligible saved revisions. Fenced leases, canonical owner/revision checks, atomic result commits, bounded recovery and shared provider-attempt accounting replace fire-and-forget self-HTTP. No automatic repair/model fallback loop was introduced. Quotas fail closed.
- **Shared AI runtime:** production LangGraph input/generate/output nodes, shared prompt builders, strict analysis/reflection schemas and explicit editing/tracker tasks. Reflection persists before success. Ambient tracing/verbose/OTEL configuration fails closed before private inference. Production journals are not LangSmith datasets.
- **Client contracts:** owner-scoped status/metadata reads, bounded web/mobile polling, mobile tracker `{text}` handling, story aliases, stable paginated reads and stale-result rejection after account switches. Refreshing existing insights reads status rather than generating again. Queued requests are not presented as completed analysis.
- **Payment reliability:** migration 021 atomically records receipts, entitlement and an outbox entry. Receipt binding checks asset/network/wallet/address; replays retain recorded expiry. Lower-plan late receipts become deferred credit. Notification retries use leases, frozen payloads and a stable provider idempotency key. Removed the unused unsafe subscription helper after verifying callers and preserving its original bytes.
- **Privilege reduction:** migration 022 restricts legacy counter RPC execution to service role. Payment/notification write grants are restricted in migration 021. Effective target grants still need verification.
- **Evaluation and CI:** deterministic task, handler, HTTP, embedded PostgreSQL, payment, publication and client tests; fixture and product-mock CLI modes; opt-in synthetic live call/spend admission; optional explicit LangSmith publication; a separate GitHub regression workflow with a synthetic-config web build step. The workflow has not been executed remotely or installed as required deployment protection.
- **Dependency work:** Next 15.5.28, Sentry 10.75.2, sharp 0.35.5, LangChain core 1.3.0, LangGraph 1.5.2 and LangSmith 0.11.1. Added PGlite for actual local PostgreSQL execution. Final targeted security patches pin root Vitest/coverage to 4.1.11 and override Handlebars to 4.7.10; all three reported critical findings are cleared. These updates do not resolve all advisories.

## Verification actually performed

| Check | Result | Evidence under `output/evaluations/` |
| --- | --- | --- |
| Full web unit suite | 117 tests / 10 files passed again on Vitest 4.1.11 | `web-unit-final.log` |
| Deterministic evaluation suite | 78 tests / 11 files passed again on Vitest 4.1.11 | `deterministic-patched.log` |
| Mobile unit suite | 39 tests / 8 files passed | `mobile-unit.log` |
| Mobile component suite | 12 tests / 2 suites passed | `mobile-components.log` |
| Web, evaluation, mobile TypeScript | All three passed; web/evaluation repeated after tooling patches, exit 0 | `types-web-final.log`, `types-eval-final.log`, `types-mobile.log` |
| Focused changed-code ESLint | Exit 0; seven warnings, zero errors | `lint-final.log` |
| Fixture runner | Six cases; ADVISORY; zero provider/judge calls | `fixture.json` |
| Product-mock runner | Six cases; ADVISORY; zero provider/judge calls | `product.json`, `product.md` |
| Strict quality gate | Expected exit 1 for uncalibrated corpus | `strict.json`, `cli-exits.json` |
| Invalid live configuration | Expected exit 1 before inference; INCONCLUSIVE report | `invalid-live.json`, `cli-exits.json` |
| Diff whitespace check | Exit 0; Git reported line-ending conversion warnings | Command output |
| Isolated production build | Failed its ten-minute bound; no `BUILD_ID` | `build.log`, `audit-snapshot.json` |
| Browser/native/artifact delivery | No current passing evidence | Remains a release gate |

One full evaluation attempt timed out in the ambiguous-email retry test during overlapping resource-heavy checks (77/78 passed). The subsequent complete suite passed 78/78 without increasing the assertion timeout; the email replay case passed in 730 ms. Both logs are retained. An earlier web run emitted React `act` warnings for resolving mocked requests; lint warnings are unused test/compatibility parameters and two record-page warnings. These are not claimed as warning-free checks. The isolated build reached compilation/lint/type validation before the deadline; no complete production artifact was produced. That attempt preceded the final development-tooling patch; there is no final-candidate build pass.

PGlite executes actual SQL but has a single exclusive connection. HTTP tests substitute the auth principal and external providers. These results do not prove deployed RLS, real JWT/middleware behavior, multi-connection contention, provider delivery or native-device acceptance. The six synthetic CLI cases are wiring/regression evidence, not a human-calibrated quality benchmark. Live model quality, real inference latency and dollar savings have not been measured.

Reports include HEAD, dirty status and hashes of selected runtime/evaluator/lockfile sources. HEAD alone does not identify this uncommitted candidate; these are local source observations, not exact deployable-artifact certification. Output reports are local generated artifacts. Original inline-analysis/component tests and the retired helper are preserved under `docs/test-history/` for review.

Local commands used Node 25.9.0. The CI definition selects Node 22; that clean installation/build has not executed remotely. The GitHub workflow YAML was checked locally; provider execution and required-check installation remain separate work.

## Dependency audit and remaining work

Fresh npm audit results on 2026-10-28 report vulnerable-package counts, including transitive/meta-vulnerabilities; they are not counts of distinct exploitable paths:

| Dependency tree | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Web runtime (`--omit=dev`) | 0 | 30 | 28 | 7 |
| Web full, after targeted patches | 0 | 40 | 52 | 26 |
| Mobile runtime (`--omit=dev`) | 0 | 33 | 30 | 11 |
| Mobile full | 0 | 34 | 32 | 19 |

Raw JSON reports and exit codes are retained under `output/evaluations/audit-*`; final root reports have a `-final` suffix. The initial web full scan found three critical package findings in Vitest/coverage and transitive Handlebars; targeted compatible patches cleared them. Direct runtime highs still include `@chainlink/mcp-server`, `viem` and `zod`; mobile direct highs include `viem`/`zod`. Investigate removal of the unused root MCP server package, compatible viem updates, and the Zod/Web3 dependency migrations with their own compatibility tests. Do not use `npm audit fix --force`. No reachability exemption or security acceptance is invented here. Remaining high findings require remediation or an explicit evidence-backed decision before readiness. A clean remote CI install/build has not run; local package tests and lockfile advisory scans are separate observations.

The larger plan remains **partially implemented**, with these boundaries:

| Workstream | Local state | Remaining acceptance |
| --- | --- | --- |
| P0 environment/dependencies | Dependencies installed, types/tests reproducible; audit triaged | Clean production build and dependency remediation |
| P1 privacy/CRE | Main containment and truthful copy implemented | Target storage/RLS and historical-publication review |
| P2 contracts/payments | Main known AI/story/payment contracts repaired | Real provider lookup/receipt contracts, legacy-payment reconciliation and broader feature journeys |
| P3 durable AI | Runtime, SQL, worker API and status UI implemented | Authorized migration, trusted scheduler, multi-connection load/recovery |
| P4 evaluations | Shared production target and deterministic suites implemented | Reviewed holdout corpus, representative audio, human calibration and optional budgeted live evidence |
| P5 platform hardening | Selected record/tracker/story/patterns/pricing/legal improvements | Full auth/CSRF/cache review, uploads/resource cost controls, remaining pages, accessibility/performance and native/offline journeys |
| P6 release | No release attempted | Exact artifact/environment, provider protection, rollback rehearsal and per-target delivery checks |

Additional source-review follow-up: mobile notification mutations use legacy field names while the server expects `notificationId`/`markAllAsRead`. That flow needs a focused contract repair and regression; it was not silently treated as validated by the payment-outbox work. Broader public/paywall enforcement, mobile icons/signing/store evidence, private audio storage, inference/storage retention and global upload budgets also remain outside the verified result.

## Adversarial review and decisions

The strongest counterargument to shipping is that good local transaction tests cannot compensate for an uninstalled schema/worker, unresolved advisories, uncalibrated model semantics or absent artifact/device evidence. Request-count quotas bound attempts but do not establish a dollar SLO or protect every upload/body parsing path. Lease fences stop stale commits but cannot cancel an already billed provider request. An outbox/provider acceptance does not prove inbox delivery. Privacy copy containment does not make cloud entries end-to-end encrypted. CRE parking does not validate testnet proofs.

No production recommendation is upgraded: **web/API NO_GO; Android NO_GO; iOS BLOCKED; OTA BLOCKED**. These are continued holds pending the missing evidence, not fresh exact-artifact production certifications. No scheduler, required branch check, provider gate, database migration, native release or deployment was installed by this local work. The next reviewable action is the staged migration/worker/provider rehearsal described in [the operations guide](AI_RUNTIME_AND_OPERATIONS.md), together with dependency remediation and the remaining feature/evaluation acceptance work.
