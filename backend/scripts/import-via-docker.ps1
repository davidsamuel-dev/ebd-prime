# Importa o schema através do contentor Docker (não precisa de `mysql.exe` no PATH).
# Executar na raiz do projeto: npm run db:import:docker
#
# Variáveis alinhadas com docker-compose.yml (valores por defeito).

param(
    [string]$RootPassword = "ebd_root_local",
    [string]$AppUser = "ebd",
    [string]$AppPassword = "ebd_local",
    [string]$Database = "ebd_prime"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $backendRoot

Set-Location $projectRoot

function Test-DockerMysql {
    docker compose exec -T mysql mysqladmin ping -h localhost 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

if (-not (Test-DockerMysql)) {
    Write-Error "Contentor MySQL indisponível. Execute: npm run db:up   e aguarde ~30 s."
}

function Sql-Root {
    param([string]$Sql)
    docker compose exec -T mysql mysql -uroot -p$RootPassword -e $Sql
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Sql-AppPipe {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) {
        Write-Warning "Ignorado (inexistente): $FilePath"
        return
    }
    $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
    $content | docker compose exec -T mysql mysql -u $AppUser -p$AppPassword $Database
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao importar: $FilePath"
    }
}

Write-Host "A criar base '$Database' (se necessário)..."
Sql-Root "CREATE DATABASE IF NOT EXISTS ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "database.sql..."
Sql-AppPipe (Join-Path $backendRoot "database.sql")

foreach ($name in @(
        "database_migration_002_email_unique.sql",
        "database_migration_003_api_tokens.sql",
        "database_migration_004_escala_numero_licao.sql"
    )) {
    $p = Join-Path $backendRoot $name
    if (Test-Path $p) {
        Write-Host $name
        Sql-AppPipe $p
    }
}

$seed = Join-Path $backendRoot "seed_demo.sql"
if (Test-Path $seed) {
    Write-Host "seed_demo.sql..."
    Sql-AppPipe $seed
}

Write-Host "Importação via Docker concluída."
