<#
Safe interactive local secret setup for dayandisli.com.

This script contains NO secret values. It only prompts for them interactively,
writes them into the project's gitignored local env file, and reports
present/missing status. It never echoes secret values to the console,
never writes them to shell history, and never creates VITE_*-prefixed
copies of server-only secrets.

Usage:
    pwsh -File .\tools\local\configure-local-secrets.ps1
#>

[CmdletBinding()]
param(
    [string]$EnvFile = (Join-Path $PSScriptRoot "..\..\.env")
)

$ErrorActionPreference = "Stop"
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))

# Variables this script is allowed to manage. Each entry declares whether the
# value is a secret (SecureString prompt) and a short description.
# NOTE: PARASUT_* and SUPABASE_SERVICE_ROLE_KEY etc. are server-only and must
# NEVER be prefixed with VITE_.
$variables = [ordered]@{
    "VITE_SUPABASE_URL"              = @{ Secret = $false; Description = "Supabase project URL (browser-safe)" }
    "VITE_SUPABASE_PUBLISHABLE_KEY"  = @{ Secret = $false; Description = "Supabase publishable/anon key (browser-safe)" }
    "ERP_COMPANY_ID"                 = @{ Secret = $false; Description = "Internal ERP tenant UUID (must match erp_users.accessible_company_ids)" }
    "PARASUT_COMPANY_ID"             = @{ Secret = $false; Description = "Parasut external company id" }
    "PARASUT_CLIENT_ID"              = @{ Secret = $true;  Description = "Parasut OAuth client id" }
    "PARASUT_CLIENT_SECRET"          = @{ Secret = $true;  Description = "Parasut OAuth client secret" }
    "PARASUT_USERNAME"               = @{ Secret = $false; Description = "Parasut account username/email" }
    "PARASUT_PASSWORD"               = @{ Secret = $true;  Description = "Parasut account password" }
}

function Test-IsSafelyIgnored([string]$path) {
    Push-Location $repoRoot
    try {
        $relative = [System.IO.Path]::GetRelativePath($repoRoot, $path)
        $result = git check-ignore -q -- $relative
        return ($LASTEXITCODE -eq 0)
    } finally {
        Pop-Location
    }
}

if (-not (Test-IsSafelyIgnored $EnvFile)) {
    Write-Warning "Refusing to write '$EnvFile' - it is not covered by .gitignore. Aborting to avoid an accidental secret commit."
    exit 1
}

# Load existing values (names only are ever displayed; values stay in memory only).
$existing = [ordered]@{}
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $idx = $line.IndexOf('=')
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1)
        $existing[$name] = $value
    }
}

Write-Host "`n=== Local secret status (values never shown) ===" -ForegroundColor Cyan
foreach ($name in $variables.Keys) {
    $present = $existing.Contains($name) -and -not [string]::IsNullOrWhiteSpace($existing[$name])
    $status = if ($present) { "present" } else { "MISSING" }
    Write-Host ("  {0,-32} {1}" -f $name, $status)
}

$missing = $variables.Keys | Where-Object { -not ($existing.Contains($_) -and -not [string]::IsNullOrWhiteSpace($existing[$_])) }
if (-not $missing) {
    Write-Host "`nAll tracked variables are already present in $EnvFile. Nothing to do." -ForegroundColor Green
    exit 0
}

Write-Host "`nMissing variables: $($missing -join ', ')" -ForegroundColor Yellow
$proceed = Read-Host "`nEnter values for the missing variables now? (y/N)"
if ($proceed -notin @('y', 'Y', 'yes', 'Yes')) {
    Write-Host "Aborted. No changes made." -ForegroundColor Yellow
    exit 0
}

$newValues = [ordered]@{}
foreach ($name in $missing) {
    $meta = $variables[$name]
    Write-Host "`n$name - $($meta.Description)"
    if ($meta.Secret) {
        $secure = Read-Host -AsSecureString "  Enter value (input hidden)"
        if ($secure.Length -eq 0) {
            Write-Host "  Skipped (empty)." -ForegroundColor DarkYellow
            continue
        }
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        $newValues[$name] = $plain
    } else {
        $val = Read-Host "  Enter value"
        if ([string]::IsNullOrWhiteSpace($val)) {
            Write-Host "  Skipped (empty)." -ForegroundColor DarkYellow
            continue
        }
        $newValues[$name] = $val
    }
}

if ($newValues.Count -eq 0) {
    Write-Host "`nNo values entered. No changes made." -ForegroundColor Yellow
    exit 0
}

# Backup existing file into an ignored, protected directory before writing.
$backupDir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (Test-Path $EnvFile) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = Join-Path $backupDir ".env.$stamp.bak"
    Copy-Item $EnvFile $backupPath
    try {
        # Restrict backup to the current user only.
        icacls $backupPath /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
    } catch {
        Write-Verbose "Could not set restrictive ACL on backup file: $($_.Exception.Message)"
    }
    Write-Host "`nBacked up existing file to $backupPath" -ForegroundColor DarkCyan
}

# Merge and write.
foreach ($name in $newValues.Keys) {
    $existing[$name] = $newValues[$name]
}

$lines = foreach ($name in $existing.Keys) { "$name=$($existing[$name])" }
Set-Content -Path $EnvFile -Value $lines -Encoding utf8 -NoNewline:$false

try {
    icacls $EnvFile /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
} catch {
    Write-Verbose "Could not set restrictive ACL on env file: $($_.Exception.Message)"
}

# Clear plaintext copies from memory as best-effort.
foreach ($k in @($newValues.Keys)) { $newValues[$k] = $null }
Remove-Variable newValues, existing -ErrorAction SilentlyContinue

Write-Host "`n=== Updated status ===" -ForegroundColor Cyan
$final = [ordered]@{}
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $idx = $line.IndexOf('=')
    $final[$line.Substring(0, $idx).Trim()] = $true
}
foreach ($name in $variables.Keys) {
    $status = if ($final.Contains($name)) { "present" } else { "MISSING" }
    Write-Host ("  {0,-32} {1}" -f $name, $status)
}

Write-Host "`nDone. No values were printed to the console or written to shell history." -ForegroundColor Green
