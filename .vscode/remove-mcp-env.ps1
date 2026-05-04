# .vscode/remove-mcp-env.ps1
# Removes the MCP environment variables set by setup-mcp-env.ps1.

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.mcp"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.mcp not found at $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Removing MCP secrets from Windows user environment variables..." -ForegroundColor Yellow

$lines = Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Z_][A-Z0-9_]*=' }

foreach ($line in $lines) {
    $key = $line.Split('=', 2)[0].Trim()
    [Environment]::SetEnvironmentVariable($key, $null, "User")
    Write-Host "  Removed: $key" -ForegroundColor Magenta
}

Write-Host "`nDone. Restart VS Code and/or Cursor for the changes to take effect." -ForegroundColor Yellow
