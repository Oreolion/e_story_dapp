# Encrypted recovery export and restore

The user selected a private Google Drive folder on Nov5. Its link is kept out of this public repository. Folder permissions and upload have not been verified: there is no Drive connector, and computer use currently has no native pipe or browser surface.

The operator export uses the existing database password entered **locally**, then streams each SQL export directly into GnuPG AES256 encryption. No plaintext SQL file is created. The password is not placed in command arguments, source, env files or the manifest. PowerShell privately prompts for and confirms the separate backup passphrase, delivering it to Node/GPG through anonymous pipes, never command arguments, environment variables or files. Do not send either value through chat or put the recovery passphrase in the Drive folder.

## What is implemented and tested

- `scripts/recovery-export.ps1` first verifies the local CLI and a synthetic encryption/decryption round trip, without connecting to production or asking for passwords. It then privately prompts for the backup passphrase twice and the existing database password, restores its process environment afterward and starts the reviewed exporter. Do not reset the production password for this task.
- `scripts/recovery-export.mjs` pins Supabase CLI **2.120.0**, project `qfwhtsmqndnocfidhdhy` and PostgreSQL major **17**. It uses a clean temporary CLI workdir, avoiding implicit reads of the app's env files. Supplying the existing password avoids temporary-login setup and its retry-side effects.
- SQL stdout goes directly to GPG, whose output is written to exclusive `.partial` files outside the repository. Only successful producer/encryption exits publish a final encrypted file. A manifest records ciphertext lengths/hashes and explicit completion limits. Failures, timeouts and existing outputs cannot become a successful backup.
- Ten synthetic Node tests passed on Windows: UTF-8 encryption/decryption, wrong-passphrase/tamper rejection, producer/encryption failure, timeout/non-overwrite behavior, export inventory, repository destination protection, the real isolated GPG setup, missing-GPG rejection, safe failure classification and all five stages through the PowerShell wrapper with a Unicode passphrase. Windows CI runs the wrapper test; Linux runs the portable cases. The PowerShell script parsed successfully.

These are backup-pipeline tests, not evidence of a recoverable production snapshot. The first owner-run attempt failed during encryption because Windows' default GPG home was unavailable; no successful export, restore or upload has been established. The repaired live path initializes an isolated GPG home using a relative path, matching the tested MSYS setup, and does not require a GPG popup. Do not enter real secrets in an agent tool.

The second owner-run attempt passed encryption preflight but the roles export failed. The original script discarded its diagnostics, so the underlying production connection/export cause is still unknown. The updated pipeline examines at most 64 KiB of CLI stderr internally and emits only a fixed error category, safe explanation and numeric exit code. It never saves or echoes raw diagnostics. A category is a troubleshooting hint, not proof that a password or provider configuration is correct.

The installed CLI's flags, saved management login and running Docker engine were checked separately. A real CLI 2.120.0 rehearsal exported all five stages from a disposable PostgreSQL 17 fixture through GPG successfully. That fixture used its private Docker bridge address and synthetic tables; it exercised `--db-url` with local-only authentication rather than the production `--linked` connection. The owned fixture was stopped. This demonstrates the actual local CLI/tool-image/encryption path, not production authentication, hosted recovery or a full Supabase restore. Local evidence is retained under TEMP `istory-real-cli-rehearsal-IlR0zD`.

## Operator step: export privately

Use a normal local PowerShell window. Docker must be running; the installed Node 24, Supabase CLI and GPG paths below have been discovered on this machine. The destination contains encrypted output only and is outside Git.

```powershell
$taskBackupRoot = Join-Path $env:LOCALAPPDATA 'iStoryRecovery'
New-Item -ItemType Directory -Force -Path $taskBackupRoot | Out-Null

& '.\scripts\recovery-export.ps1' `
  -OutputDirectory $taskBackupRoot `
  -NodeExecutable 'C:\Users\HP 240 G9\AppData\Roaming\nvm\v24.22.1\node.exe' `
  -SupabaseCli 'C:\Users\HP 240 G9\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\supabase\dist\supabase.js' `
  -GpgExecutable 'C:\Program Files\Git\usr\bin\gpg.exe'
```

Run from the repository root. The output parent must already exist. Wait for **`Local encryption and CLI preflight passed`**. Then enter your chosen backup passphrase, confirm it, and enter the current Supabase **database password**, not the service-role/API key. All prompts are in PowerShell; no GPG popup is expected. The script uses the same passphrase for all five parts. Keep it on securely stored paper or in a password manager, separately from Drive. If preflight or an export fails, stop; do not weaken encryption or treat partial files as complete. Each retry creates a fresh backup directory; do not upload the previous failed attempt's `.partial` files.

Expected final status: **`EXPORTED_NOT_RESTORE_VERIFIED`**. The five encrypted parts are roles, schema, data, migration schema and migration data, plus a metadata-only `manifest.json`. Never upload `.partial` files or raw SQL. The manifest and ciphertext hashes are safe to inspect for verification; SQL/customer records, credentials and passphrases are not needed in the conversation.

On another failure, report only the generated `error` category and `sourceExit` (for example `DATABASE_AUTHENTICATION`, exit 1), not raw CLI/debug output. Do not repeatedly guess passwords or reset the production password. The two failed owner-run directories are incomplete and must not be uploaded as backups.

## Coverage and recovery limits

The export follows the installed CLI's [reviewed source](https://github.com/supabase/cli/tree/v2.120.0/apps/cli/src/commands/db/dump) and Supabase's [backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), checked Nov5. Use the installed CLI's flags, not the newly published v3 defaults.

Supabase's default schema export excludes platform-managed schemas; custom `auth`/`storage` policies/triggers need separate catalog-backed coverage. Migration history is exported separately because it is not covered by the default export. Database data and object metadata are different from Storage object bytes. Media objects, provider configuration/credentials, encryption-root recovery and custom-role passwords require separate coverage. Do not export or print a Vault root/signing/private key through the agent.

The five exports are separate CLI invocations, not one shared database snapshot. Keep schema/migration changes paused during export and record any writes that affect cross-resource consistency. A completed manifest does not prove that these exports and retained media/configuration represent the same recovery point; resolve that during the isolated restore before accepting the recovery gate.

Before accepting this release's recovery gate, record which of those resources the cutover changes, how retained resources remain available, and how the covered database/auth state is restored with the intended Supabase engine/extensions. Do not call a plain PostgreSQL import a full Supabase recovery. A failed restore must be diagnosed from redacted metadata, without pasting SQL or customer records into chat.

## Restore and off-site verification

1. Verify every ciphertext size and SHA-256 against the manifest. Decrypt only through GPG into the isolated restore process; do not display decrypted SQL or create an unprotected dump file.
2. Restore into an explicitly disposable local environment matching PostgreSQL 17 and required Supabase extensions/managed schema. Isolate network access; no production email, callbacks, AI requests, payments, public ports or host data mounts. Supply any required protected platform configuration through the owner's normal mechanism. No production restore is authorized as a test.
3. Use fail-on-error transactional restore, the CLI's documented role/schema/data ordering and the observed migration history. Preserve actual grants/defaults and restore trigger/publication settings deliberately. Compare aggregate integrity metadata without exposing records. Exercise controlled synthetic accounts and the reviewed migrations on that copy, including effective role denial and compatibility tests.
4. Record actual restore duration, artifact hashes, schema/grant identities, covered resources and the recovery point. The backup's timestamp is its recovery point; it does not preserve later writes. Application rollback should preserve new receipts/identities/jobs through a compatible artifact rather than automatically restoring an old snapshot.
5. Upload the completed encrypted set and manifest to the owner-selected **Restricted** Drive folder. Keep passphrases and keys out of that folder. With current tool access, the owner must perform upload and any private download. Re-download a completed encrypted part and compare its hash before claiming off-site delivery.
6. Keep the manifest at `EXPORTED_NOT_RESTORE_VERIFIED` until real restore evidence exists; keep off-site delivery separate. Record verified results in the cutover evidence instead of manually editing an incomplete export into a success claim.

Supabase explicitly recommends off-site CLI exports for free-tier projects and notes that database backups exclude Storage objects: [backup documentation](https://supabase.com/docs/guides/platform/backups). No paid backup service, new capacity or plaintext upload is part of this workflow.
