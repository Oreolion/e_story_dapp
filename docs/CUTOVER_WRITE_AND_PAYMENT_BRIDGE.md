# Persistent write fence and payment callback inbox

Source preparation only: no production object, credential, setting or routing has been changed. These new operational objects go beyond migrations 020–023 and need inclusion in the production change scope and recovery plan before execution. Existing deployments retain their behavior when the new settings are absent.

## Protection and limits

Removing a temporary Data API fence would admit old server handlers again. The bridge leaves a pre-request guard installed after reopening. Service-role requests require a new server-only release epoch and random key; older builds lack that credential. Rotate both for a later cutover to fence the preceding generation again.

This protects PostgREST only. It cannot cancel admitted SQL or provider operations, fence direct SQL or cover Supabase Auth, Storage or Realtime. Drain and inventory those separately. Anonymous/authenticated requests resume under normal grants and RLS. This credential never replaces account authorization or ownership checks.

| Database state | Anonymous/authenticated | Legacy service role | Current server credential |
| --- | --- | --- | --- |
| `paused` | 503 | 503 | Only POST `/rpc/istory_retain_payment_callback`; other operations 503 |
| `candidate` | Normal grants/RLS | 503 | Normal service-role access |

Control and receipt rows live in the unexposed `istory_release` schema. Application roles have no direct schema/table access. The guard has a fixed search path and constant denial. A missing control row denies access. The application reads credentials only from server configuration, never incoming headers. Partial or malformed credentials fail.

## Settings

| Setting | Contract |
| --- | --- |
| `DATA_API_RELEASE_EPOCH` | Fresh UUID v4 identifying this server generation; matches the private control row. |
| `DATA_API_RELEASE_KEY` | Fresh 32 random bytes encoded as 64 lowercase hex characters. Store only SHA256 of that ASCII hex string in the database. |
| `PAYMENT_CALLBACK_MODE=retain` | Exact opt-in to signed retention, including during explicitly paused admission. Absent preserves inline processing; other supplied values reject the webhook. |
| `PAYMENT_CALLBACK_REPLAY_ENABLED=true` | Default off. At most one receipt per authenticated payment-notice dispatch, before normal notice handling. Requires retain mode, active application admission, enabled payments and the existing worker enabled. |

Never reuse database passwords, backup passphrases, worker credentials, operator codes or API keys. Never send the key in chat, URLs, printed SQL, screenshots, source control or logs. Never use a `NEXT_PUBLIC_` variable. Provision through approved private handling. The outbound `x-istory-release-key` header is a credential: infrastructure/HTTP tracing redaction must cover it before activation. No key has been generated or provisioned by these edits.

## Callback lifecycle

Only the exact webhook POST has a maintenance exception. It still requires HMAC-SHA512 verification, at most 128 KiB of actual streamed bytes and a two-second read deadline; retention transport times out at eight seconds. It validates confirmed deposit structure and accepted wallet/network/asset while entitlement processing remains disabled.

A 200 means the normalized receipt was durably stored, not that the plan is active. The transaction UUID deduplicates identical redelivery. Conflicting normalized contents for one ID fail for reconciliation. Missing storage/RPC, authentication failure and invalid configuration cannot successfully acknowledge a deposit. Other signed event types remain ignored as before.

After explicit reopening/activation, `FOR UPDATE SKIP LOCKED` claims one receipt with a random lease token and 120-second expiry. The existing atomic entitlement RPC activates or defers it; unmatched receipts stay retryable. Lost completion acknowledgments can safely repeat entitlement attempts. Only the current unexpired lease can finish. Backoff stops after five failures; records remain for reconciliation. No automatic deletion or blind historical replay occurs. Notifications use the existing outbox. Activating the worker can send real notifications and is not a production probe.

Blockradar documents five retries over about 2 hours 35 minutes and warns manual resend can repeat completed transactions. A maintenance 503 alone is insufficient retention. [Provider documentation](https://docs.blockradar.co/en/utilities/webhooks), checked Nov12, 2026. No resend or mainnet test payment was performed.

## Prepared sequence — do not execute yet

1. Bind source, compiled artifact, configuration and operation hashes. The offline batch manifest includes operational SQL hashes. Confirm authority for new objects, maintenance ownership, provider allowance, compatible recovery and complete recovery scope/freshness.
2. Include `istory_release` in encrypted recovery coverage. The existing public-schema export must not be assumed to capture it. Define retention, reconciliation ownership, failed/backlog alert thresholds and response time. `readback-bridge.sql` returns only presence and aggregate counts/oldest timestamps.
3. Review/install the original inert guard and `install-bridge.sql` under a separately cleared production audit. Installation refuses existing names. Provision epoch/digest privately; verify actual definitions, ownership, grants and existing pre-request settings.
4. Deliver the reviewed paused artifact with retention configured; establish historical URL/provider protections. Activate original maintenance, then `activate-bridge.sql`. Verify actual HTTP denials and the narrowly authorized callback RPC; catalog state does not prove reload.
5. Drain admitted SQL and old provider work. Unknown authenticator state blocks migrations. The permanent fence stops late legacy REST writes after opening, but does not prove email or payment-address work finished.
6. Prepare a fresh batch with `scripts/prepare-cutover.mjs`; prior batches are obsolete. It requires the exact paused bridge source/security configuration, active hook, configured credentials and safe control grants. It locks the control table before checking mode, alongside existing bounded transaction/history/permission checks. Apply only through the reviewed target-bound mechanism.
7. `open-candidate.sql` requires history 020–023, the exact active hook, configured paused control and database drain. It changes mode without removing the fence. Keep public admission operator-only and providers/consumers held for hosted acceptance; prove account-owned candidate operations and legacy denial.
8. Complete Firefox/OAuth/wallet/private-save acceptance and final audit before public promotion. Activate payments/replay separately. `hold-candidate.sql` re-holds the database while preserving signed intake. It cannot cancel admitted work or repair a missing hook.

Never use original `resume.sql` after bridge activation: it refuses the changed hook. Do not bypass that refusal or restore the incompatible legacy app. Inspect schema/history/control after ambiguous results before retrying.

## Tests and remaining evidence

Synthetic evaluations execute PostgreSQL-compatible SQL for signatures, body limits, durable deduplication, conflicts, private-table denial, epoch binding, leases, exhaustion and ambiguous completion. Their adapter does not prove hosted JWT/HTTP behavior.

Pinned PostgreSQL17/PostgREST14.18 rehearsal verifies actual headers/method/path handling, callback exception, legacy denial after reopening, hook conflicts and emergency hold. The real PostgreSQL batch rehearsal covers UUID/TEXT owners, atomic late-failure rollback, acknowledged inbox preservation, schema/history installation and re-hold. A skipped rehearsal is not a pass.

Hosted versions, permissions, reload, tracing redaction, recovery and browser acceptance still need verification. [PostgREST transaction settings](https://docs.postgrest.org/en/v14/references/transactions.html), [PostgreSQL17 SHA256 functions](https://www.postgresql.org/docs/17/functions-binarystring.html), checked Nov12, 2026.
