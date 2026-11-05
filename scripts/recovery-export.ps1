param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][string]$SupabaseCli,
  [string]$NodeExecutable = 'node',
  [string]$GpgExecutable = 'gpg'
)
$ErrorActionPreference = 'Stop'
$taskScript = Join-Path $PSScriptRoot 'recovery-export.mjs'
& $NodeExecutable $taskScript --output $OutputDirectory --supabase-cli $SupabaseCli --gpg $GpgExecutable --preflight
if ($LASTEXITCODE -ne 0) { throw 'Local preflight failed. No passwords are needed until this is fixed.' }
Write-Host 'Use the existing database password. Do not reset it for this export.'
Write-Host 'Enter your backup passphrase here in PowerShell; keep it separately from the backup folder.'
$taskPhrase = Read-Host 'Backup passphrase' -AsSecureString
$taskConfirm = Read-Host 'Confirm backup passphrase' -AsSecureString
$taskPassword = $null
$taskProcess = $null
$taskPriorValue = [Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'Process')
try {
  $taskPhraseText = ([System.Management.Automation.PSCredential]::new('unused', $taskPhrase)).GetNetworkCredential().Password
  $taskConfirmText = ([System.Management.Automation.PSCredential]::new('unused', $taskConfirm)).GetNetworkCredential().Password
  if ($taskPhraseText -cne $taskConfirmText) { throw 'Passphrases do not match. No database export started.' }
  if ([string]::IsNullOrEmpty($taskPhraseText) -or $taskPhraseText -match "[\r\n\x00]" -or [Text.Encoding]::UTF8.GetByteCount($taskPhraseText) -gt 1024) { throw 'Use a nonempty, single-line passphrase of at most 1024 UTF-8 bytes.' }
  $taskConfirmText = $null
  $taskPassword = Read-Host 'Existing Supabase database password (not an API/service key)' -AsSecureString
  $taskCredential = [System.Management.Automation.PSCredential]::new('postgres', $taskPassword)
  # This operator-owned process passes the value privately to its child. No
  # password is written to argv, source, env files, transcripts or the manifest.
  [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $taskCredential.GetNetworkCredential().Password, 'Process')
  $taskArguments = @($taskScript, '--output', $OutputDirectory, '--supabase-cli', $SupabaseCli, '--gpg', $GpgExecutable)
  if (@($taskArguments | Where-Object { $_.Contains('"') }).Count -gt 0) { throw 'Executable and output paths cannot contain double quotes.' }
  $taskStart = [Diagnostics.ProcessStartInfo]::new()
  $taskStart.FileName = $NodeExecutable
  $taskStart.Arguments = ($taskArguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $taskStart.UseShellExecute = $false
  $taskStart.RedirectStandardInput = $true
  $taskStart.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
  $taskProcess = [Diagnostics.Process]::Start($taskStart)
  try {
    # The passphrase travels over an anonymous UTF-8 pipe, never argv, env or disk.
    $taskProcess.StandardInput.WriteLine((@{passphrase=$taskPhraseText} | ConvertTo-Json -Compress))
  } finally { $taskProcess.StandardInput.Close(); $taskPhraseText = $null }
  $taskProcess.WaitForExit()
  if ($taskProcess.ExitCode -ne 0) { throw 'Export did not complete; partial files are not backups.' }
} finally {
  [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $taskPriorValue, 'Process')
  if ($taskPassword) { $taskPassword.Dispose() }
  $taskPhrase.Dispose()
  $taskConfirm.Dispose()
  if ($taskProcess) { $taskProcess.Dispose() }
  $taskPhraseText = $null
  $taskConfirmText = $null
  $taskCredential = $null
  $taskPriorValue = $null
}
