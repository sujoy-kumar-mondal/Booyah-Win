# ==============================================================================
# Booyah Win - Weekly Database Backup Script (PowerShell / pg_dump)
# ==============================================================================
# SECURITY REQUIREMENTS:
# 1. Never stores, logs, or commits database credentials or dumps in git.
# 2. Refuses to write backup files inside the repository folder.
# 3. Output dump contains encrypted PII (PAN/Aadhaar) and must be kept secure.
# ==============================================================================

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = (Get-Item (Join-Path $scriptDir "..")).FullName

# 1. Get DATABASE_URL
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    $securePass = Read-Host -Prompt "Enter PostgreSQL connection string (DATABASE_URL)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $dbUrl = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

if (-not $dbUrl) {
    Write-Error "Error: DATABASE_URL is required."
    exit 1
}

# 2. Get destination directory
$defaultDest = Join-Path $HOME "booyah_backups"
$destInput = Read-Host -Prompt "Enter destination directory for backup [default: $defaultDest]"
if (-not $destInput) {
    $destInput = $defaultDest
}

if (-not (Test-Path $destInput)) {
    New-Item -ItemType Directory -Path $destInput -Force | Out-Null
}

$destReal = (Get-Item $destInput).FullName

# 3. Guard against saving inside the repository
if ($destReal.StartsWith($repoDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Error "Error: Refusing to write backup inside the repository directory ($repoDir). Please choose a secure directory outside the git repository."
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $destReal "booyah_backup_${timestamp}.dump"

Write-Host "Creating compressed custom-format backup using pg_dump..."
& pg_dump $dbUrl -F c -b -v -f $outputFile

Write-Host "Backup created successfully: $outputFile"
Write-Host "Remember to close this PowerShell window to clear session memory."
