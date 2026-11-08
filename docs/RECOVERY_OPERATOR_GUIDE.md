# Encrypted recovery export and restore

The owner selected OneDrive for the encrypted off-site backup on Nov5 and confirmed all six files online. On Nov8, the owner downloaded a separate ZIP; the agent independently verified its inventory and all five ciphertext hashes against the original snapshot. Folder permissions remain unverified. Private cloud-folder links are kept out of this public repository. The local restore tool now passes synthetic tests; a real owner-run restore is still pending. Production remains held.

The operator export uses the existing database password entered **locally**, then streams each SQL export directly into GnuPG AES256 encryption. No plaintext SQL file is created. The password is not placed in command arguments, source, env files or the manifest. PowerShell privately prompts for and confirms the separate backup passphrase, delivering it to Node/GPG through anonymous pipes, never command arguments, environment variables or files. Do not send either value through chat or put the recovery passphrase in the cloud backup folder.

## What is implemented and tested

- `scripts/recovery-export.ps1` first verifies the local CLI and a synthetic encryption/decryption round trip, without connecting to production or asking for passwords. It then privately prompts for the backup passphrase twice and the existing database password, restores its process environment afterward and starts the reviewed exporter. Do not reset the production password for this task.
- `scripts/recovery-export.mjs` pins Supabase CLI **2.120.0**, project `qfwhtsmqndnocfidhdhy` and PostgreSQL major **17**. It uses a clean temporary CLI workdir, avoiding implicit reads of the app's env files. Supplying the existing password avoids temporary-login setup and its retry-side effects.
- SQL stdout goes directly to GPG, whose output is written to exclusive `.partial` files outside the repository. Only successful producer/encryption exits publish a final encrypted file. A manifest records ciphertext lengths/hashes and explicit completion limits. Failures, timeouts and existing outputs cannot become a successful backup.
- Ten synthetic Node tests passed on Windows: UTF-8 encryption/decryption, wrong-passphrase/tamper rejection, producer/encryption failure, timeout/non-overwrite behavior, export inventory, repository destination protection, the real isolated GPG setup, missing-GPG rejection, safe failure classification and all five stages through the PowerShell wrapper with a Unicode passphrase. Windows CI runs the wrapper test; Linux runs the portable cases. The PowerShell script parsed successfully.

These are backup-pipeline tests, not evidence of a recoverable production snapshot. Historically, the first owner-run attempt failed during encryption because Windows' default GPG home was unavailable. The repaired live path initializes an isolated GPG home using a relative path, matching the tested MSYS setup, and does not require a GPG popup. The later Nov5 export succeeded, with owner-confirmed online visibility and independently verified Nov8 download integrity as recorded below; restore remains unverified. Do not enter real secrets in an agent tool.

The second owner-run attempt passed encryption preflight but the roles export failed. The owner subsequently identified that the Supabase account-login password had been used instead of the database password, reset the database password and completed the Nov5 export. The updated pipeline examines at most 64 KiB of CLI stderr internally and emits only a fixed error category, safe explanation and numeric exit code. It never saves or echoes raw diagnostics. A category is a troubleshooting hint, not proof that a password or provider configuration is correct.

The installed CLI's flags, saved management login and running Docker engine were checked separately. A real CLI 2.120.0 rehearsal exported all five stages from a disposable PostgreSQL 17 fixture through GPG successfully. That fixture used its private Docker bridge address and synthetic tables; it exercised `--db-url` with local-only authentication rather than the production `--linked` connection. The owned fixture was stopped. This demonstrates the actual local CLI/tool-image/encryption path, not production authentication, hosted recovery or a full Supabase restore. Local evidence is retained under TEMP `istory-real-cli-rehearsal-IlR0zD`.

## Operator step: export and test the restore privately

Use a normal local PowerShell window. Docker must be running; the installed Node 24, Supabase CLI and GPG paths below have been discovered on this machine. The destination contains encrypted output only and is outside Git. Keep the earlier OneDrive backup. This creates a fresh format-2 backup with explicit managed-schema coverage and encrypted catalog metadata; the old format-1 ZIP is deliberately rejected by the restore tool.

```powershell
$taskBackupRoot = Join-Path $env:LOCALAPPDATA 'iStoryRecovery'
New-Item -ItemType Directory -Force -Path $taskBackupRoot | Out-Null

& '.\scripts\recovery-export.ps1' `
  -OutputDirectory $taskBackupRoot `
  -NodeExecutable 'C:\Users\HP 240 G9\AppData\Roaming\nvm\v24.22.1\node.exe' `
  -SupabaseCli 'C:\Users\HP 240 G9\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\supabase\dist\supabase.js' `
  -GpgExecutable 'C:\Program Files\Git\usr\bin\gpg.exe' `
  -VerifyRestore
```

Run from the repository root. The output parent must already exist. Wait for **`Local encryption and CLI preflight passed`**. With `-VerifyRestore`, preflight also checks Docker and the cached pinned image before asking for passwords. Then enter your retained backup passphrase, confirm it, and enter the current Supabase **database password**, not the website login or service-role/API key. All prompts are in PowerShell; no GPG popup is expected. The script uses that passphrase for all six encrypted parts. Keep it separately from the cloud folder. Each retry creates a fresh backup directory; never upload an incomplete attempt's `.partial` files.

The export first reports **`EXPORTED_NOT_RESTORE_VERIFIED`**. The new folder contains **seven files**: five encrypted SQL parts (roles, schema, data and two migration-history parts), encrypted `catalog.json.gpg`, and metadata-only `manifest.json`. With `-VerifyRestore`, the tool then decrypts directly into its isolated temporary database and reports **`DATABASE_RESTORE_VERIFIED`** only after the checks below pass. It writes a separate `.restore-<id>.json` evidence file beside the backup folder; the export manifest remains unchanged. Send only final status/error and the evidence path through chat. Never send SQL, customer records, passwords or passphrases.

The script never installs or upgrades Docker and never pulls images automatically. If preflight reports `RESTORE_PINNED_IMAGE_MISSING`, the reviewed public image can be downloaded with `docker pull public.ecr.aws/supabase/postgres@sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`. This uses local Docker storage, not paid cloud recovery compute. An export-only run omits `-VerifyRestore` and makes no restore claim.

On another failure, report only the generated `error` category and `sourceExit` (for example `DATABASE_AUTHENTICATION`, exit 1), not raw CLI/debug output. Do not repeatedly guess passwords or reset the production password. Earlier failed owner-run directories are incomplete and must not be uploaded as backups.

## Successful owner-run export — Nov5 evidence

The owner reset the project database password after identifying that the previous attempts used the Supabase account-login password. The next export completed from **2026-11-05 17:18:31.041 UTC to 17:20:30.307 UTC**, targeting `qfwhtsmqndnocfidhdhy`, with status `EXPORTED_NOT_RESTORE_VERIFIED`. The completed directory is `istory-db-backup-X0tByN`. The private cloud destination is not recorded here.

The agent independently verified all five ciphertext file sizes and SHA-256 values against the manifest, the exact project/status/inventory, and the absence of unexpected files. No SQL or real passphrase was read or decrypted. This is ciphertext integrity evidence, not decryption, consistent-snapshot, restore or off-site-delivery evidence.

| File | Bytes | Ciphertext SHA-256 |
| --- | ---: | --- |
| `roles.sql.gpg` | 426 | `7c4274cc59b42d32ae339521259307ae702a5aeaa5f47fcd64b5bcaeb080e879` |
| `schema.sql.gpg` | 61417 | `b0dc8d8ff478602b7e11fcf76369544422d6d5121082dccea5350eaf4512d48a` |
| `data.sql.gpg` | 507004 | `2c5813c2d01cf43b58fa740a74485f7e8a2077b7aa27d86fe297e17cb0120a0b` |
| `migration-schema.sql.gpg` | 1184 | `7010c17ce1a19008c81b815e41970a3ce587017d78bff51f3cd9eb03ee9edec2` |
| `migration-data.sql.gpg` | 39420 | `70578a235e10d32a856ded7f339eb3782caf5a81546348e0cf418de3f9eb802e` |

Public homepage and health checks returned 200 after the password reset; an unauthenticated profile request returned 401. These are limited HTTP checks, not authenticated-flow acceptance. No direct database-password consumer was found in the searched application code or local `origin/master` tree, but the hosting-environment metadata read failed and external consumers remain unverified.

The owner subsequently reported moving the completed folder to OneDrive and retaining the passphrase separately. The task folder was located under the local OneDrive root, and the original recovery directory no longer exists. The agent verified all five moved ciphertext files against the original export sizes/hashes and confirmed all six expected files. The owner then confirmed all six files are visible on the OneDrive website. Cloud access settings remain unverified.

On Nov8, the owner downloaded `C:/Users/HP 240 G9/Desktop/istory-db-backup-X0tByN.zip` (611,928 bytes). The agent independently validated the ZIP inventory and all five ciphertext hashes against the original snapshot, then extracted only the ciphertext and manifest into TEMP `istory-recovery-download-e4f50931296a431aa29698b562095edf`. No SQL or passphrase was decrypted. This establishes integrity of the independently downloaded encrypted set, not restore success or cloud access controls.

## Current restore selection — local tool tested; real restore pending

The owner requested a local restore rather than a GitHub workflow. Nov8 checks reported approximately 2.52 GB available on Windows and 6.7 GiB available in the Docker VM, superseding the earlier host-memory observation. The pinned PostgreSQL 17.11 container started successfully with the limits below. Private owner passphrase entry remains necessary for the real backup; no real production snapshot has been decrypted or restored by the agent.

Format 2 selects explicit non-system schema names from a read-only catalog query, including matching Auth/Storage definitions, rather than guessing managed-service versions. The encrypted catalog records role attributes/memberships, extension versions, Auth/Storage migration history, table grants, owners, RLS flags/policies and source integrity counts. COPY counts are computed from the actual data and migration-history streams without retaining customer values. The production metadata query validated nine schemas, 15 roles, 66 policies and 75 tables; it made no database write. Six source constraints were already unvalidated, so the restore compares with that baseline rather than claiming a pristine source.

The restore runner uses the exact image digest above, a non-root user, no network, no published ports, no host mounts, a read-only root, dropped capabilities and no container logging. Limits are one CPU, 512 MiB memory with no additional swap, 64 processes, a 256 MiB temporary database and 32 MiB temporary socket directory. Decrypted SQL streams directly to fail-on-error `psql` inside one transaction; commit occurs only after every SQL part passes GPG integrity verification. SQL and database diagnostics are suppressed. Completed checks compare COPY row counts, role attributes/memberships, extension versions, migration history, table ownership/grants/RLS and source integrity counts. The tool stops only its own disposable database; its temporary plaintext state is discarded and encrypted backups are retained.

All **17 local tests passed** on Nov8 with real GPG, Windows private prompts and the pinned PostgreSQL engine. The combined PowerShell command was tested end to end with synthetic secrets; a separate Windows regression test ensures the restore flag remains one argument and a preflight failure stops before private prompts. The synthetic full restore covered custom/reserved roles, RLS, Unicode data, empty tables and migration history. Wrong passphrases, ciphertext/hash corruption, SQL errors, row-count mismatches and altered RLS policies produced no new success evidence. These tests do not establish recoverability of the real snapshot. Linux CI repeats the synthetic Docker rehearsal; Windows CI verifies the private prompt/export and format guards. No production data or passphrase goes to CI.

This work does not require a production write. `DATABASE_RESTORE_VERIFIED` means the stated database checks passed; media, keys, external configuration, hosted acceptance and migration/cutover gates remain separate. Keep production cutover held until those applicable gates clear. After a real restore passes, upload the **new seven-file encrypted set**, retain the passphrase separately, and repeat the independent download/hash check; the older ZIP does not verify off-site delivery of this newer snapshot.

## Historical alternative — private GitHub restore deferred

The current application repository is public. It is not an approved destination for a real production backup or restore passphrase. A separate private GitHub repository was previously considered as an alternative restore target and is now deferred in favor of the selected local approach. No cloud repository or transfer of production backup/data to GitHub has been authorized or created; no cloud recovery compute or secret has been created by this proposal.

If reconsidered, a private GitHub restore would require these concrete gates before execution:

1. Verify remaining included standard-runner usage and effective controls that prevent paid overage. Account quota and budget eligibility are not established by a passing public CI run. Stop if no-cost execution cannot be verified; do not start a paid runner or increase spending limits. [GitHub billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) distinguishes free public standard runners from private usage against an included allowance.
2. Prepare and review the complete workflow and restore scripts before requesting authorization for the private destination and data processing. Limit access to the owner, manual dispatch only, an exact reviewed source SHA, read-only job permissions and a bounded timeout. Do not assume protected environments are available on the owner's plan.
3. Obtain explicit authority to deliver the encrypted production snapshot to that exact private destination and process its decrypted data on GitHub's runner. Keep the passphrase out of workflow inputs, source, logs and artifacts. Any temporary secret must be entered by the owner through a protected local/provider prompt after review; never request its value in chat.
4. Verify the downloaded ciphertext against the original hashes before decryption. Prepare the matching Supabase PostgreSQL 17/extensions/managed-schema baseline. The current five-part export alone does not establish managed-schema customization or encryption-root coverage. A plain PostgreSQL import cannot clear the full recovery gate.
5. Restore only inside a disposable container with no network, public ports, host data mounts, Docker socket or production credentials. Bound CPU/memory/time. Drain and suppress SQL, database and GPG diagnostics; emit only fixed error categories and allowlisted aggregate evidence. Never upload decrypted dumps, database files or arbitrary debug logs.
6. Test integrity, grants and migration/application compatibility on that isolated target. Return only non-sensitive evidence bound to snapshot hashes, source/image identities, covered resources, restore duration and actual checks. Distinguish a decrypted/imported snapshot from complete recovery and successful off-site delivery.

The historical cloud proposal does not authorize transferring data, purchasing capacity, applying production migrations or promoting the web app. Staging remains deferred as previously requested.

## Coverage and recovery limits

The export follows the installed CLI's [reviewed dump implementation](https://github.com/supabase/cli/blob/v2.120.0/apps/cli-go/pkg/migration/dump.go), [SQL compatibility substitutions](https://github.com/supabase/cli/blob/v2.120.0/apps/cli-go/pkg/migration/scripts/dump_schema.sh) and Supabase's [backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). The exact CLI 2.120.0 source was checked Nov8; do not silently upgrade to v3 defaults.

Supabase's default schema export excludes platform-managed schemas; format 2 requests their explicit names and verifies table/RLS catalog metadata after import. Application migration history remains a separate part. CLI-excluded internal data, event triggers, some role settings/default privileges and publication configuration still need separate review. Database data and object metadata are different from Storage object bytes. Media objects, provider configuration/credentials, encryption-root recovery and custom-role passwords require separate coverage. Do not export or print a Vault root/signing/private key through the agent.

The five exports are separate CLI invocations, not one shared database snapshot. Keep schema/migration changes paused during export and record any writes that affect cross-resource consistency. A completed manifest does not prove that these exports and retained media/configuration represent the same recovery point; resolve that during the isolated restore before accepting the recovery gate.

Before accepting this release's recovery gate, record which of those resources the cutover changes, how retained resources remain available, and how the covered database/auth state is restored with the intended Supabase engine/extensions. Do not call a plain PostgreSQL import a full Supabase recovery. A failed restore must be diagnosed from redacted metadata, without pasting SQL or customer records into chat.

## Restore and off-site verification

1. Verify every ciphertext size and SHA-256 against the manifest. Decrypt only through GPG into the isolated restore process; do not display decrypted SQL or create an unprotected dump file.
2. Restore into an explicitly disposable local environment matching PostgreSQL 17 and required Supabase extensions/managed schema. Isolate network access; no production email, callbacks, AI requests, payments, public ports or host data mounts. Supply any required protected platform configuration through the owner's normal mechanism. No production restore is authorized as a test.
3. Use fail-on-error transactional restore, the CLI's documented role/schema/data ordering and the observed migration history. Preserve actual grants/defaults and restore trigger/publication settings deliberately. Compare aggregate integrity metadata without exposing records. Exercise controlled synthetic accounts and the reviewed migrations on that copy, including effective role denial and compatibility tests.
4. Record actual restore duration, artifact hashes, schema/grant identities, covered resources and the recovery point. The backup's timestamp is its recovery point; it does not preserve later writes. Application rollback should preserve new receipts/identities/jobs through a compatible artifact rather than automatically restoring an old snapshot.
5. Upload the completed encrypted set and manifest to the owner-selected **private** cloud folder (currently OneDrive). Keep passphrases and keys out of that folder. With current tool access, the owner must perform upload and any private download. Re-download the completed set into a separate directory and compare its hashes before claiming off-site delivery.
6. Keep the manifest at `EXPORTED_NOT_RESTORE_VERIFIED` until real restore evidence exists; keep off-site delivery separate. Record verified results in the cutover evidence instead of manually editing an incomplete export into a success claim.

Supabase explicitly recommends off-site CLI exports for free-tier projects and notes that database backups exclude Storage objects: [backup documentation](https://supabase.com/docs/guides/platform/backups). No paid backup service, new capacity or plaintext upload is part of this workflow.
