# Authenticated worker dispatch and release controls

Prepared Nov 10, 2026. This scheduler serves the existing durable AI and payment-notice workers. It does not move inference, payments or the application to Cloudflare. Implementation is authorized by the production-readiness work; activation remains conditional on the cutover gates.

## Scheduler decision

Supabase's Nov 4 [pg_net advisory](https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357), checked Nov 10, says database roles can read queued request headers and individual projects cannot change the queue grants/RLS. Do not install the proposed Vault → pg_net bearer-token dispatcher. Vault would not protect the dispatched token.

The candidate [Worker](../ops/worker-dispatch/worker.mjs) holds only two scoped tokens and a source commit binding. It has no database/service-role credential, provider key, journal content or application response storage. Its [configuration](../ops/worker-dispatch/wrangler.jsonc) disables public/preview URLs, registers no cron and holds both consumers by default.

Account discovery found one connected Cloudflare account and one existing unrelated Worker. The owner subsequently confirmed the Workers Free plan; Nov10 API readback found zero existing Cron Triggers, and the bounded account analytics query returned no reported invocations for its recorded window. Billing subscription access returned 403: the OAuth connector cannot access that endpoint. In separately authorized Nov11 held preparation, `istory-worker-dispatch` was installed with source/settings readback: version `29cbf2dc-1661-4d6a-b5e9-705e2aa47b5c`, deployment `3a4a7a0f-c3a4-447c-bbc6-90b44a56a0ac`, all dispatch flags false, expected SHA `1aaaf30d215ea94b2206ec4901a176bbce11a251`, no secrets, cron, public/preview URL, custom domain or app-domain route. No plan changed. Source preparation below is therefore complete for that held artifact; token provisioning and activation remain pending. Preserve the unrelated Worker, monitor shared account usage and do not upgrade or purchase capacity. See [the confirmation and AI hold decision](AI_PROVIDER_ROUTING.md).

## Dispatch contract

1. Flags accept only literal `true` or `false`; missing flags hold work. `DISPATCH_ENABLED` is the global hold; `AI_DISPATCH_ENABLED` and `PAYMENT_DISPATCH_ENABLED` select consumers independently.
2. Before sending tokens, require a full `EXPECTED_COMMIT_SHA`, valid scoped tokens and a fresh event from the reviewed `* * * * *` schedule. Events over 30 seconds late, in the future or from another schedule do no work. Two enabled consumers must have different credentials.
3. A credential-free GET to fixed `https://estories.app/api/health` must report that commit, production environment, active mode and accepting traffic. Read at most 4 KiB within the five-second request timeout. Unavailable/mismatched health stops dispatch.
4. Send at most one empty POST to each enabled fixed endpoint per invocation, in parallel, using its matching token and a 50-second timeout. Use manual redirect handling and reject redirects. Native Worker tests caught that `redirect: error` is unsupported by this runtime; Node tests alone missed it.
5. Do not parse, retain or log application bodies. Logs contain fixed consumer names, HTTP status and outcome categories. `http_completed` means HTTP 200, not proof a job existed or analysis/notice delivery succeeded. Inspect approved aggregate queue metrics separately.
6. Do not retry HTTP calls inside the scheduler. A timeout is ambiguous: work may have completed. Database leases, attempt limits, receipt atomicity and outbox idempotency govern recovery. Duplicate/overlapping invocations remain possible; this is not exactly-once delivery.

One trigger/minute means a planned baseline of 1,440 scheduler invocations/day, 1,440 health GETs and up to 2,880 internal POSTs/day. Calls may consume Vercel capacity even with an empty queue. Verify both providers' included allowances and queue-age targets before registration. This is not a zero-cost or measured live-latency claim. Capacity above one job per consumer per minute needs a measured change rather than an unbounded loop.

The latest emulator returned by the queried npm registry was Miniflare `4.20260730.0`, supporting compatibility dates through `2026-08-06`. Config is bound to that tested date; advance it only with matching runtime proof. CI installs this pinned test tool in a temporary directory with lifecycle scripts disabled, outside application dependencies. Tests intercept every outgoing request with synthetic fixtures.

## Provision and enable after the release gate

Use normal authenticated provider tools without printing values. Never deploy this dirty working tree or local secret files.

1. Bind reviewed source SHA, account and script name `istory-worker-dispatch`; ensure an existing script is not overwritten. Confirm included capacity and available cron slots. Preserve the unrelated existing Worker.
2. Generate two independent cryptographically random tokens privately. Store the AI token only as Vercel production `AI_WORKER_SECRET` and its matching Worker secret binding; likewise use `PAYMENT_WORKER_SECRET` for notices. Never put tokens in SQL, files, argv, public vars, traces or reports. Partial provisioning stays held; do not rotate unrelated credentials.
3. Upload the reviewed Worker and read back version/source digest, account, binding names, held flags, no public/preview routes and empty schedules. This production-resource operation needs the required audit even while held. Local tests do not establish a hosted artifact.
4. Bind `EXPECTED_COMMIT_SHA` to the delivered compatible web/API artifact. Leave application and dispatcher flags disabled until database/cutover and hosted acceptance gates pass. A new application release must update the binding through review; stale bindings intentionally stop dispatch.
5. Register the single cron after cost, compatible recovery, callback/provider acceptance and handler-drain evidence pass. Enable one consumer on both sides, observe aggregate queue/lease outcomes, then consider the second. Activation may invoke inference or send notices; do not activate merely to test credentials under the present no-paid-inference/no-test-email scope.
6. Hold dispatcher and application flags to stop new claims, and verify effective deployed versions. Trigger removal/config changes do not cancel in-flight requests.

## Vercel production check installed Nov 10

The reviewed [check definition](../ops/release/vercel-release-check.json) was installed in project `prj_flm8d8Q2WHZY4b8LW0scLZ5tD6Wq` as `chk_bccb3064-4a76-47bc-a285-f9fc54ba82d6`. Independent GET readback confirms production target, GitHub `Release checks` source, `deployment-alias` blocking and 2,700-second timeout. Production remained `dpl_EVTyJQfdTxsSnrzahQJY2vDFfnog`, source `d0cb70220b3ab1b2c48261578205758d0d1db51e`; no app deployment or promotion occurred.

This is installed CI-result gating, not a completed audit or proof of every release path. [Deployment Checks](https://vercel.com/docs/deployment-checks) block domain assignment; privileged Force Promote remains a bypass. No controlled promotion/negative-case rehearsal was performed. Keep agent preflight and exact-artifact post-delivery verification; do not claim universal enforcement.

Two unauthenticated, no-redirect GET probes to the current and preceding generated production URLs returned 302 to `vercel.com`. Alongside `all_except_custom_domains` readback, this proves public protection for those two URLs at observation time, not privileged bypass credentials, cached browsers, direct Supabase or every historical URL. Public production aliases include `estories.app`, its `www` redirect, `e-story-dapp.vercel.app` and its `i-story-dapp.vercel.app` redirect. Cover all four in cutover.

## Remaining decision

The owner has confirmed USDC mainnet enablement, Gemini 2.5 Flash model limits and the Workers Free plan. These are owner confirmations; see [the provider record](AI_PROVIDER_ROUTING.md) for their scope and the disabled DeepSeek fallback. API readback established zero existing Cron Triggers and no reported invocation rows in the recorded analytics window. Vercel team readback is active Hobby; current included Vercel usage and Gemini billing tier still need confirmation before enabling consumers.

Web/API remains NO_GO until production configuration, included provider allowances, hosted authenticated acceptance, compatible recovery and enforced old-handler/direct-SDK cutover are evidenced. Nov 10 SELECT-only Supabase readback still shows migration 019 and Vault only; 020–023 and scheduling extensions were not applied. The Computer Use skill was reread, but its required `node_repl` runtime is not exposed; CLI results cannot establish browser acceptance. Mobile is unreleased; no native/OTA release is in scope.
