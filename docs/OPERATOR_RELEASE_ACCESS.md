# Controlled browser acceptance during cutover

This control lets a release operator test the candidate on `https://estories.app`, preserving the real OAuth callback/cookie origin, while ordinary visitors receive the existing maintenance response. It is implemented in source and tested with synthetic inputs; it is **not activated in production**. No secret, provider setting, domain, database fence or migration is provisioned by this guide.

## Admission contract

| Configuration | Result |
| --- | --- |
| `APP_RELEASE_MODE=paused` or malformed | Existing global denial wins, including the operator entry. No access code overrides it. |
| Release active; `APP_FRONTDOOR_MODE` absent or `open` | Existing public behavior. The operator entry returns 404. |
| Release active; front door `operator`, valid configuration | Only the operator entry and record-free health/readiness GET/HEAD are public. Other dynamic requests require a valid operator cookie. |
| Invalid front-door setting or incomplete operator configuration | Dynamic traffic and the canonical account-auth guard fail closed. Health remains liveness only; readiness is 503. |

Operator configuration requires an independent `RELEASE_COHORT_SECRET`: a freshly generated, cryptographically random 32-byte value encoded as 43 canonical base64url characters. It is server-only, not a Supabase password, backup passphrase, wallet key or worker token. Never put it in chat, a URL, logs, source, browser storage or a local env file. Provision it privately through the normal protected provider interface only as part of the reviewed cutover. Do not set it now merely to make a test pass.

`RELEASE_COHORT_ID` is a fresh public UUIDv4 identifying the approved window. The runtime also requires the actual full `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID` and canonical `NEXT_PUBLIC_APP_URL`. Missing system metadata denies entry; do not invent production values. [Vercel documents system-variable exposure](https://vercel.com/docs/environment-variables/system-environment-variables); verify availability on the exact hosted artifact. New provider settings require a deployment; they are not a global live kill switch.

The mode requires `AI_PROVIDER_MODE=disabled`, `PAYMENT_PROVIDER_MODE=disabled`, and both worker flags false/absent. Application email and external-media helpers also refuse operations. This deliberately supports sign-in, identity/profile checks and private text saves without enabling inference, payments, notices, public pinning or uploads. Do not substitute this limited acceptance for later provider/worker acceptance. Supabase Auth/Storage and other direct SDK traffic remain outside this application gate.

## Operator workflow

1. Complete exact-source CI, target/recovery review, enforced legacy-writer fencing/drain and schema prerequisites. Bind the intended artifact/configuration and maintenance window in the production audit. Preserve the current production deployment until that scoped audit clears. Code preparation does not authorize an outage.
2. During the reviewed cutover, deliver the candidate in operator mode on the canonical domain, with consumers/providers held. Verify exact SHA/deployment, public profile denial, `frontdoorMode=operator`, `acceptingTraffic=false`, and readiness HTTP503. Verify every production alias and old execution separately.
3. In a dedicated private Firefox window, visit `https://estories.app/api/release/access`. Enter the separately provisioned access code in its password field. It is posted in a bounded same-origin form body, never a URL. Successful entry redirects only to `/` and sets an opaque `__Host-` cookie with Secure, HttpOnly, SameSite=Lax and Path=/; the access code itself is not stored in the cookie.
4. The proof expires after 30 minutes, with at most five seconds of Node/Edge clock skew. Its signature binds the release window, source SHA, deployment ID and origin. A rebuilt deployment, changed ID/key or different origin invalidates it. Renew through the same form if acceptance takes longer. Changing a Vercel setting alone does not invalidate an already-running artifact.
5. Use approved synthetic Google/wallet accounts only. The operator proof admits the browser; it does not replace account authentication, fresh dual-identity linking proofs, ownership checks or quotas. Check private save/read, cross-owner denial, profile/preferences, Google/wallet/link recovery and Firefox same-origin refresh. Verify that another browser without the proof remains held. Do not send test emails, upload media, transfer funds or enable inference as probes.
6. Use **End operator access** on the entry page or close the private window. Exit expires that browser's cookie; copied proofs remain usable until their server-checked expiry or an effectively deployed window/key/artifact change. Do not describe browser cookie deletion as server revocation.
7. Only after recorded hosted acceptance and the final release audit clears, deliver the reviewed open configuration. Keep AI disabled per the owner's decision. Payment and consumer activation require their own acceptance and allowance checks. Recheck delivered identity, public behavior and the observation window before claiming production success.

The entry is an intentionally public, low-cost gate with a 512-byte actual body limit, a two-second read deadline, a five-second handler duration declaration and the existing five-attempt/minute middleware bucket. That bucket is per instance and is not a durable distributed brute-force guarantee; security relies on a separately generated 256-bit access code and native HMAC verification. Application account authorization remains independent. Input failures never reflect the submitted code. The form has no scripts, no third-party assets, no referrer and a restrictive CSP.

## Evidence and limits

Unit/integration cases cover invalid configuration, cryptographic tampering, expiry, artifact/window/origin changes, global-pause precedence, canonical auth denial without the proof, secure cookie/exit behavior, origin and body boundaries, unfinished streams, readiness, disabled consumers and cost-bearing operations. The CI recovery runner uses the same compiled build for public/paused/invalid/operator cases, invents only synthetic loopback credentials, enumerates every API method and checks that operator entry does not admit other browsers or bypass account authentication. It also checks no-store/noindex behavior on a rendered page.

These tests do not prove hosted environment exposure, CDN caching, callback configuration, browser login/refresh, hosted RLS or provider behavior. Computer Use is still needed for the actual user-facing acceptance; the currently exposed toolset has no Computer Use runtime. Do not mark hosted acceptance passed from source, a paused 503, an HTTP-only fixture or an old artifact. The database pre-request fence, old-handler drain, callback retention and compatible recovery remain separate required controls.
