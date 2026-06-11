# Deploy automático para Hostinger (gera pacote + envia por FTP).
# Uso:
#   npm run deploy:hostinger
# ou:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-hostinger.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-hostinger.ps1 -DryRun

param(
    [switch]$DryRun,
    [switch]$PackOnly
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nodeArgs = @("scripts/deploy-hostinger.mjs")
if ($DryRun) { $nodeArgs += "--dry-run" }
if ($PackOnly) { $nodeArgs += "--pack-only" }

if (-not (Test-Path "backend\.env.deploy")) {
    Write-Host ""
    Write-Host "Crie backend\.env.deploy (copie de backend\.env.deploy.example)" -ForegroundColor Yellow
    Write-Host "  copy backend\.env.deploy.example backend\.env.deploy" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

node @nodeArgs
exit $LASTEXITCODE
