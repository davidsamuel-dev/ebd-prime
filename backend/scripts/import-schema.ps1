# Importa `database.sql`, migrações e `seed_demo.sql` para MySQL local.
# Requer o cliente `mysql` no PATH (XAMPP: C:\xampp\mysql\bin).
#
# Exemplos (executar na pasta `backend`):
#   .\scripts\import-schema.ps1
#   .\scripts\import-schema.ps1 -User ebd -Password ebd_local
#   .\scripts\import-schema.ps1 -User root -Password "a_tua_senha"

param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 3306,
    [string]$User = "root",
    [string]$Password = "",
    [string]$Database = "ebd_prime"
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $backendRoot

$mysql = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysql) {
    Write-Error "Comando 'mysql' nao encontrado. Adicione o binario do MySQL ao PATH (ex. XAMPP) ou use HeidiSQL / phpMyAdmin para importar database.sql manualmente."
}

function Mysql-Exec {
    param([string]$Sql)
    if ($Password -ne "") {
        & mysql -h $Host -P $Port -u $User -p$Password -e $Sql
    } else {
        & mysql -h $Host -P $Port -u $User -e $Sql
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Mysql-ImportFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $content = Get-Content -Path $Path -Raw -Encoding UTF8
    if ($Password -ne "") {
        $content | & mysql -h $Host -P $Port -u $User -p$Password $Database
    } else {
        $content | & mysql -h $Host -P $Port -u $User $Database
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao importar: $Path"
    }
}

Write-Host "A criar base '$Database' (se nao existir)..."
Mysql-Exec "CREATE DATABASE IF NOT EXISTS ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "Importando database.sql..."
Mysql-ImportFile (Join-Path $backendRoot "database.sql")

foreach ($name in @(
        "database_migration_002_email_unique.sql",
        "database_migration_003_api_tokens.sql",
        "database_migration_004_escala_numero_licao.sql"
    )) {
    $p = Join-Path $backendRoot $name
    if (Test-Path $p) {
        Write-Host "Migracao: $name"
        Mysql-ImportFile $p
    }
}

$seed = Join-Path $backendRoot "seed_demo.sql"
if (Test-Path $seed) {
    Write-Host "Seed demo..."
    Mysql-ImportFile $seed
}

Write-Host "Feito. Copie .env.example para .env e arranje o servidor PHP (ex.: php -S 0.0.0.0:8080 -t . api/router.php se usar router)."
