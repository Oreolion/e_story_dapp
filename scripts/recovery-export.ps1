param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][string]$SupabaseCli,
  [string]$NodeExecutable = 'node',
  [string]$GpgExecutable = 'gpg'
)
$ErrorActionPreference = 'Stop'
Write-Host 'Use the existing database password. Do not reset it for this export.'
Write-Host 'GPG will separately ask for a backup passphrase; store it outside the backup folder.'
$taskPassword = Read-Host 'Existing Supabase database password (not an API/service key)' -AsSecureString
$taskCredential = [System.Management.Automation.PSCredential]::new('postgres', $taskPassword)
$taskPriorValue = [Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD', 'Process')
try {
  # This operator-owned process passes the value privately to its child. No
  # password is written to argv, source, env files, transcripts or the manifest.
  [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $taskCredential.GetNetworkCredential().Password, 'Process')
  & $NodeExecutable (Join-Path $PSScriptRoot 'recovery-export.mjs') --output $OutputDirectory --supabase-cli $SupabaseCli --gpg $GpgExecutable
  if ($LASTEXITCODE -ne 0) { throw 'Export did not complete; partial files are not backups.' }
} finally {
  [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD', $taskPriorValue, 'Process')
  $taskPassword.Dispose()
  $taskCredential = $null
  $taskPriorValue = $null
}
