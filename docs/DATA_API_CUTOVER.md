# Data API maintenance fence and release order

Prepared Nov 10, 2026. The SQL files are reviewed preparation, **not an installed production control**. They do not execute automatically in the application, migration runner or deployment workflow. Migrations 020–023 remain unchanged.

## What the fence covers

[Supabase documents](https://supabase.com/docs/guides/api/securing-your-api) `pgrst.db_pre_request` as a function run before Data API database requests. The proposed guard raises a constant HTTP 503 error before application SQL. It covers anonymous, authenticated and service-role PostgREST callers, including cached browser SDK writes and old API handlers making new REST requests. It denies reads as well as writes during maintenance.

It does **not** cancel a transaction already admitted, terminate an old handler waiting on an external provider, fence direct SQL connections, or apply to Supabase Auth, Storage or Realtime. Public schema/identity/payment changes do not by themselves establish a storage migration. Inventory other SQL writers and stop applicable consumers separately. Keep the fence installed until old execution has drained; a count of zero current database transactions cannot prove that a handler will not issue a later write.

The guard returns a constant error code and `Cache-Control: no-store`, without customer values. Real PostgREST 14.18 tests found that it adds `Retry-After: 0` on database 503 errors; adding a custom 60-second value produced `0, 60`. The SQL therefore does not add a conflicting retry header. The application's front-door maintenance response still supplies its own 60-second retry value. No claim is made that old SDKs will automatically recover or wait a minute.

## Prepared operations

| File | Effect |
| --- | --- |
| [install.sql](../ops/release/cutover/install.sql) | Creates a fixed, invoker-security guard; does not pause requests. Fails rather than replacing an existing function. |
| [pause.sql](../ops/release/cutover/pause.sql) | Installs the guard as the authenticator pre-request control, notifies config reload; refuses a conflicting or database-specific control. |
| [readback.sql](../ops/release/cutover/readback.sql) | Reads only guard/config presence and active Data API transaction count. Catalog state alone cannot prove API reload. |
| [resume.sql](../ops/release/cutover/resume.sql) | Removes only this exact global pre-request setting; refuses absent, changed or database-specific settings and notifies reload. Leaves the inert guard available for a later reviewed pause. |

Every mutating file has its own transaction, a five-second lock timeout and a thirty-second statement timeout. Pause/resume acquire a shared release-operation advisory lock and fail on a concurrent operation. They cannot serialize an entire maintenance window: one named operator must own execution throughout. No existing pre-request function is chained, replaced or silently cleared; a conflict needs a separately reviewed integration.

Nov10 SELECT-only production inspection found no authenticator `pgrst.db_pre_request` setting. Recheck immediately before installation. This observation does not authorize changing it now or establish hosted role permissions.

## Required coordinated sequence

1. Verify the exact source SHA, all CI prerequisites, intended provider targets, recovery freshness and data-preserving recovery strategy. Prepare a retained, protected paused application artifact. Do not deploy the dirty local worktree. A CI recovery report is not a hosted artifact.
2. Agree the maintenance window, operator and stop conditions. Preserve callback delivery: Blockradar's documented retry duration is finite. Do not send payments, emails or paid inference as probes, acknowledge unprocessed events, or blindly replay historical completed payments.
3. Keep new dispatcher consumers off. Install the inert guard only after its scoped production audit/authority clears; verify its actual definition, owner and grants. Capture existing pre-request configuration without secret-bearing role settings.
4. Route every public production alias to the reviewed maintenance artifact, verify its SHA and paused responses, and establish protection for historical/branch/generated URLs. This is a production promotion with its own final audit. The application setting cannot fence an old artifact or a direct SDK by itself.
5. Activate the Data API fence, then verify actual HTTP denials for anonymous, authenticated and service-role callers using fixed, record-free probes through approved credential handling. Do not mark this verified from SQL catalog readback or local tests alone. Stop if any API instance remains unfenced.
6. Drain in-flight database transactions **and** old external-provider handlers before migrations. Vercel's [June2026 changelog](https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes), checked Nov10, permits Node/Python Functions up to 1,800 seconds in the relevant beta; older 800/900-second assumptions are insufficient. Establish the applicable deployed runtimes and upper bound, then wait that bound plus a reviewed margin measured from the last admitted old request. Do not infer the deployed duration from a source default or zero current SQL transactions.
7. Apply only hash-bound 020–023 with the existing recovery/rehearsal evidence and bounded execution/history handling. The offline batch preparation below provides one transaction; its isolated proof does not authorize hosted execution. Read back effective schema, grants and function identities. Do not replay missing historical migrations or relax the new profile/payment grants for cached clients.
8. Deliver the compatible candidate while front-door traffic remains held. Hosted authenticated acceptance belongs **after** schema prerequisites exist and **before** general reopening. It needs a controlled fixture/cohort path; requiring the active candidate to pass against migration019 before installing its required RPCs would be a circular gate. Do not expose an untested release or call a paused 503 a functional pass.
9. Resume only the reviewed Data API configuration after old execution and compatibility checks clear; verify HTTP behavior. Complete controlled Google/wallet/link/Firefox and owner-isolation acceptance, including a cached-client refresh/recovery path. Hold front-door admission if those checks fail. The required Computer Use runtime is currently unavailable in this session; CLI results do not replace this acceptance.
10. Reopen public traffic only after final release audit, then enable consumers individually within confirmed allowances and observe the declared watch window. To pause again, use the existing guard and reviewed pause operation. Do not restore the incompatible legacy application or roll back the database over post-cutover data.

This sequence still needs an effective controlled-cohort front door, hosted verification, deployed-handler drain evidence and a retained recovery artifact. It is not a completed production cutover or a waiver of those requirements.

## Offline migration batch preparation

[prepare-cutover.mjs](../scripts/prepare-cutover.mjs) prepares the four reviewed migrations as one transaction. It has no network, credential input or execute mode. These commands only prepare and check a local artifact in an existing private directory:

```powershell
node scripts/prepare-cutover.mjs --output "$env:TEMP\istory-reviewed-cutover.sql"
node scripts/prepare-cutover.mjs --check "$env:TEMP\istory-reviewed-cutover.sql"
```

Output creation is exclusive: an existing file is not overwritten. Checking requires exact bytes matching a fresh compilation of the hash-verified migration sources. The JSON result records the intended project, migration hashes and emitted SQL SHA256; keep that manifest with the release evidence. The project reference is an intended target, **not proof of the connected database identity**. This tool does not connect to Supabase, apply SQL, install the fence or grant execution authority. Do not paste the generated batch into production now.

The batch requires PostgreSQL17, the exact configured guard source/security settings and executable grants, no conflicting database-specific pre-request control, no currently active authenticator transaction, and the release-operation advisory lock. It locks migration history, requires 019 with no versions outside 000–019, and refuses pre-existing release tables. Existing historical gaps are preserved. The batch sets five-second lock, thirty-second statement and 120-second transaction timeouts. All four schema changes, their 020–023 history records, effective permission checks and the schema-cache notification share one commit. A failure rolls back schema and history together. A successful batch cannot be silently replayed. The external manifest binds hashes; Supabase history rows themselves do not store or verify those hashes.

PostgreSQL can hide another session's state from a role without statistics access. The batch treats NULL/unknown state as non-idle and refuses execution; readback reports `unknown_data_api_sessions` separately from observed transactions. A nonzero unknown count is a stop condition, not a confirmed drain. Use an appropriately authorized operator rather than inferring safety from missing statistics or granting broad privileges incidentally. The isolated test reproduces this restricted-visibility boundary with a real active authenticator connection.

Catalog checks still cannot establish that hosted PostgREST reloaded, that old provider handlers drained, or that direct writers stopped. Verify the actual connection/project, hosted role privileges, HTTP fence, fresh recovery, controlled acceptance path and maintenance ownership before choosing a protected execution mechanism. Do not use blind `supabase db push` or mark older gaps applied. After a lost connection or timeout, inspect committed history and effective schema before any retry; do not assume that a missing client success message proves rollback.

[prepare-cutover.test.mjs](../scripts/prepare-cutover.test.mjs) tests artifact determinism/tamper refusal and opts into real isolated PostgreSQL with `TEST_RECOVERY_DOCKER=1`. The database cases exercise UUID and TEXT story owners, a missing or altered guard, concurrent operators, a pre-admitted Data API transaction, late-failure rollback, atomic history recording, effective grants, functional RPC probes and replay refusal. They use synthetic data and the recovery helper's pinned PostgreSQL17 image, no network, published port, production target or persistent volume. Only test-owned databases are stopped afterward. CI runs the real database case on Linux and artifact preparation on Windows; a skipped database case is not proof.

## Isolated proof

[The test](../scripts/cutover-fence.test.mjs) starts pinned PostgreSQL17 and PostgREST14.18 images with synthetic data and fresh synthetic signing material. Only the test API is published on a random host loopback port. PostgreSQL listens on its shared container namespace's loopback; no database port or persistent volume is published. These containers use Docker's bridge network, not a claim of complete network isolation. No production address, credential or database is accepted as test input.

It verifies 21 denied role/method probes, RLS-bypassing service-role denial, unchanged fixture values, a request admitted before pause still committing, conflicting/global/database-specific control refusal, and resumed writes. Cleanup inspects full container ID, image, unique ownership label and nonpersistent mounts before removing only that run's containers. No Docker network, image, backup or user volume is deleted. CI requires the real Docker test explicitly; a locally skipped test is not evidence.

Images are pinned by the official registries' Nov10 manifest digests: PostgreSQL17 `ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f`; PostgREST14.18 `c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf`. The hosted PostgREST version/reload/privileges still need their own verification. No upgrade of the hosted database or API server is proposed.
