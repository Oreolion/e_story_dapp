# Gemini quota, DeepSeek fallback and scheduler allowance

Prepared Nov 10, 2026. Fallback implementation is authorized by the owner's request; no live inference, purchase or production activation is authorized by this guide. Tests replace both transports with synthetic responses.

## Owner confirmations

The owner confirmed USDC mainnet enablement in response to the Base-mainnet wallet check for wallet `7d9469d3-a7b6-466e-9eda-9e4c372ed15e`. Record this as owner-confirmed, not independently retrieved provider metadata. Mainnet test payments remain excluded.

The owner supplied this AI Studio Gemini 2.5 Flash row: RPM `9 / 1K`, TPM `4.38K / 1M`, RPD `28 / 10K`. The page described usage peaks over the last 28 days. Therefore the reported model limits are 1,000 RPM, 1,000,000 TPM and 10,000 RPD; the other numbers are reported usage peaks, not present-day remaining balances. The earlier Antigravity row is unrelated to this app's text model. Free/paid billing tier was not supplied.

The app's conservative initial global cap is 100 reserved provider attempts/day across text tasks and analysis, including failures/retries. This is below the reported model RPD limit; it does not establish remaining project quota, token throughput, billing eligibility or performance. Other consumers of the same Google project share its limits. App counters use UTC dates; Google documents RPD resets at midnight Pacific. Do not assume those windows align.

## Routing behavior

Gemini `gemini-2.5-flash` remains primary. `AI_DEEPSEEK_FALLBACK_ENABLED` defaults off and accepts only literal `true` or `false`. Merely storing a DeepSeek key never enables fallback. When enabled, a missing/blank `DEEPSEEK_API_KEY` fails closed. Do not read local env/secret files or place a key in chat/source/logs.

- With no Gemini key and explicitly enabled/configured DeepSeek, one admitted request goes directly to DeepSeek.
- Enhancement/tracker/reflection may try DeepSeek after Gemini 429 or selected 5xx errors, or the installed SDK's transport/abort errors. The route must first obtain a **second durable reservation** through the same `admit_ai_text_call` policy. Denied/failed reservation stops the extra call. Failed attempts still count; the user quota may be consumed twice.
- Analysis never makes two provider calls inside one job claim. A transient first-attempt failure enters the existing bounded retry path. A separately claimed/reserved second attempt may select DeepSeek. Two total attempts remain the maximum. Persistence failures, invalid output and safety refusals do not trigger provider switching.
- Invalid requests, authentication/configuration errors and model refusals do not cause a blind provider retry. Schema/semantic validation remains in the existing LangGraph workflow; there is no model-based repair loop or new LLM judge.
- Synchronous routing shares one at-most-25-second provider deadline. With inline fallback enabled, Gemini gets at most 12 seconds (or half a smaller budget); DeepSeek receives only the time remaining after generation and admission. Each durable analysis attempt retains its own existing provider timeout and overall job deadline/lease fences.

DeepSeek uses only fixed `https://api.deepseek.com/chat/completions`, current documented `deepseek-flash`, non-streaming output, disabled thinking, at most 4,096 output tokens and no tools/search. Analysis/reflection request JSON output; editing requests plain text. Redirects are refused. Response streams are bounded to 256 KiB and validated for model, assistant text, successful completion and nonnegative token counts. Truncation, tool calls, malformed/oversized/blank responses and diagnostics cannot become a persisted successful analysis.

## Accounting and compatibility

Both providers use existing shared admission counters; fallback does not introduce a second independent allowance. No changes were made to rehearsed migrations 020–023. Provider errors are reported generically; prompts, provider error bodies and responses are not added to logs/tracing.

Completed analysis records actual `provider` and requested `model` in the existing job `usage` JSON, with successful-response token counts and reserved-call count for that attempt. A failed Gemini call may have incurred unknown token charges; do not infer zero charge from missing usage. The existing `ai_jobs.model_version=gemini-2.5-flash` remains the legacy planned-job identity for SQL compatibility; **it is not proof of the model that executed a fallback**. Use `usage.provider`/`usage.model` for execution attribution. DeepSeek aliases can change upstream; no immutable provider-model snapshot or live quality benchmark is claimed.

## Before enabling DeepSeek

DeepSeek's [API pricing](https://api-docs.deepseek.com/quick_start/pricing/) is token-based. A free chat account is not proof of free API inference. Activation requires an approved account/budget and private key provisioning, review of sending journal content to this additional provider, applicable privacy disclosures, and controlled quality/latency acceptance. Keep it off under the existing no-paid-inference constraint. Do not top up, spend credits or switch billing plans to obtain a passing test.

Required server-only configuration, when authorized:

| Name | Meaning |
| --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Existing primary credential; preserve it |
| `AI_DEEPSEEK_FALLBACK_ENABLED` | Initially `false`; explicit `true` only after activation prerequisites |
| `DEEPSEEK_API_KEY` | Privately provisioned fallback credential; never public/client configuration |
| `AI_DAILY_CALL_LIMIT` | Shared conservative attempt cap, initially 100 or less after billing review |

Operator flags are not billing proof. No DeepSeek credential was read, created or used against the provider in this work. No new production settings were applied.

## Cloudflare account check

There is no eStories Worker deployed yet. The app remains on Vercel; the held Worker only schedules existing internal endpoints. Do not create a domain or migrate hosting for this scheduler.

In the Cloudflare account dashboard, check the **Workers plan (Free/Paid)**, account usage and available Cron Trigger capacity. The [current Workers limits](https://developers.cloudflare.com/workers/platform/limits/), checked Nov10, list Free as 100,000 requests/day and five cron triggers/account; other Workers share those limits. The intended single one-minute trigger adds 1,440 scheduled invocations/day. It also makes up to 1,440 Vercel health GETs and 2,880 Vercel worker POSTs/day. Cloudflare allowance does not establish Vercel allowance. Confirm existing included capacity; do not upgrade.

The owner subsequently confirmed the **Workers Free plan**. Nov10 API readback found zero Cron Triggers across the one existing unrelated Worker. A read-only account analytics query for `2026-11-10T00:00:00Z` through `16:52:14.172Z` returned no invocation rows and no errors; record this as no reported invocations in that window, not guaranteed current quota or future peak traffic. One planned trigger is within the documented five-trigger limit; monitor shared usage before activation and preserve the unrelated Worker.

The connected API can read Workers metadata/analytics but cannot read billing subscriptions through OAuth. Default usage model `standard` is not billing proof; the Free-plan label above is owner confirmation. No dispatcher, cron or Worker secrets were provisioned. See [the dispatcher release guide](WORKER_DISPATCH_RELEASE_GUIDE.md) for held defaults and activation gates.

## Sources checked Nov10

- [Google API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits): per-model/project RPM, TPM, RPD and Pacific RPD reset.
- [DeepSeek API contract](https://api-docs.deepseek.com/api/create-chat-completion/), [errors](https://api-docs.deepseek.com/quick_start/error_codes/) and [pricing](https://api-docs.deepseek.com/quick_start/pricing/): fixed endpoint/model, bounded output, thinking/JSON options and billed usage.
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/): account request/cron limits, independent of actual account eligibility and current consumption.
