param(
  [Parameter(Mandatory = $true)][string]$BackupDirectory,
  [string]$NodeExecutable = 'node',
  [string]$GpgExecutable = 'gpg'
)
$ErrorActionPreference = 'Stop'
$taskScript = Join-Path $PSScriptRoot 'recovery-restore.mjs'
& $NodeExecutable $taskScript --directory $BackupDirectory --gpg $GpgExecutable --preflight
if ($LASTEXITCODE -ne 0) { throw 'Restore preflight failed. No passphrase is needed until this is fixed.' }
Write-Host 'This uses the completed encrypted backup. No database password, export or production connection is needed.'
$taskPhrase = Read-Host 'Existing backup passphrase' -AsSecureString
$taskProcess = $null
try {
  $taskPhraseText = ([Management.Automation.PSCredential]::new('unused', $taskPhrase)).GetNetworkCredential().Password
  if ([string]::IsNullOrEmpty($taskPhraseText) -or $taskPhraseText -match "[\r\n\x00]" -or [Text.Encoding]::UTF8.GetByteCount($taskPhraseText) -gt 1024) { throw 'Use the existing nonempty, single-line backup passphrase.' }
  $taskArguments = @($taskScript, '--directory', $BackupDirectory, '--gpg', $GpgExecutable)
  if (@($taskArguments | Where-Object { $_.Contains('"') }).Count -gt 0) { throw 'Executable and backup paths cannot contain double quotes.' }
  $taskStart = [Diagnostics.ProcessStartInfo]::new()
  $taskStart.FileName = $NodeExecutable
  $taskStart.Arguments = ($taskArguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $taskStart.UseShellExecute = $false
  $taskStart.RedirectStandardInput = $true
  $taskStart.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
  $taskProcess = [Diagnostics.Process]::Start($taskStart)
  try { $taskProcess.StandardInput.WriteLine((@{passphrase=$taskPhraseText} | ConvertTo-Json -Compress)) }
  finally { $taskProcess.StandardInput.Close(); $taskPhraseText = $null }
  $taskProcess.WaitForExit()
  if ($taskProcess.ExitCode -ne 0) { throw 'Restore verification failed. The encrypted backup is unchanged; no production changes were made.' }
} finally {
  $taskPhrase.Dispose()
  if ($taskProcess) { $taskProcess.Dispose() }
  $taskPhraseText = $null
}
