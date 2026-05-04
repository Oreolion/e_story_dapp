# .vscode/setup-mcp-env.ps1
# Reads .env.mcp from the project root and installs the values as Windows
# user environment variables. VS Code and Cursor inherit these automatically.
# Run this once per machine. Requires PowerShell.

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.mcp"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.mcp not found at $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Installing MCP secrets from .env.mcp as Windows user environment variables..." -ForegroundColor Cyan

$lines = Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Z_][A-Z0-9_]*=' }

foreach ($line in $lines) {
    $parts = $line.Split('=', 2)
    $key   = $parts[0].Trim()
    $value = $parts[1].Trim()

    [Environment]::SetEnvironmentVariable($key, $value, "User")
    Write-Host "  Set User env var: $key" -ForegroundColor Green
}

Write-Host "`nDone. Restart VS Code and/or Cursor for the changes to take effect." -ForegroundColor Cyan
Write-Host "You can verify with: [Environment]::GetEnvironmentVariable('FIRECRAWL_API_KEY', 'User')"
