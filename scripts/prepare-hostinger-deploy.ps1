# Gera pasta pronta para upload FTP (chama o script PHP).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/prepare-hostinger-deploy.ps1
php (Join-Path (Split-Path -Parent $PSScriptRoot) 'backend\scripts\prepare-hostinger-deploy.php')
exit $LASTEXITCODE

# --- legado abaixo (não executado) ---

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root 'backend'
$out = Join-Path $root 'deploy\hostinger-ebd.adparaiso.com.br'

Write-Host "EBD Prime — preparar deploy Hostinger"
Write-Host "Origem: $backend"
Write-Host "Destino: $out"

if (Test-Path $out) {
    Remove-Item -Recurse -Force $out
}
New-Item -ItemType Directory -Path $out | Out-Null

Push-Location $backend
try {
    if (-not (Test-Path 'vendor\autoload.php')) {
        Write-Host "composer install..."
        composer install --no-dev --optimize-autoloader
    }
} finally {
    Pop-Location
}

$exclude = @('.env', '.env.production', 'scripts', '.git', '.gitignore')
Get-ChildItem -Path $backend -Force | Where-Object {
    $exclude -notcontains $_.Name
} | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $out -Recurse -Force
}

Copy-Item (Join-Path $backend '.env.production') (Join-Path $out '.env') -Force
Write-Host ""
Write-Host "OK — enviar TODO o conteudo de:"
Write-Host "  $out"
Write-Host "para a RAIZ do subdominio ebd.adparaiso.com.br (substituir pagina padrao)."
Write-Host ""
Write-Host "Depois abrir: https://ebd.adparaiso.com.br/api/health.php"
Write-Host "Preencher EBD_SMTP_PASS no .env no servidor (senha da caixa suporte@adparaiso.com.br)."
