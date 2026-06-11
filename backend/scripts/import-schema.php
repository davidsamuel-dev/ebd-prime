<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';

/**
 * Importa SQL por PDO sem cliente mysql no PATH.
 * Uso: php backend/scripts/import-schema.php
 */

function split_sql_statements(string $sql): array
{
    $out = [];
    $buf = '';
    $inSingle = false;
    $inDouble = false;
    $len = strlen($sql);

    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];
        $prev = $i > 0 ? $sql[$i - 1] : '';

        if ($ch === "'" && !$inDouble && $prev !== '\\') {
            $inSingle = !$inSingle;
            $buf .= $ch;
            continue;
        }

        if ($ch === '"' && !$inSingle && $prev !== '\\') {
            $inDouble = !$inDouble;
            $buf .= $ch;
            continue;
        }

        if ($ch === ';' && !$inSingle && !$inDouble) {
            $stmt = trim($buf);
            if ($stmt !== '') {
                $out[] = $stmt;
            }
            $buf = '';
            continue;
        }

        $buf .= $ch;
    }

    $stmt = trim($buf);
    if ($stmt !== '') {
        $out[] = $stmt;
    }

    return $out;
}

function clean_sql(string $raw): string
{
    if (str_starts_with($raw, "\xEF\xBB\xBF")) {
        $raw = substr($raw, 3);
    }

    $lines = preg_split('/\R/', $raw) ?: [];
    $clean = [];

    foreach ($lines as $line) {
        $t = ltrim($line);
        if (str_starts_with($t, '--')) {
            continue;
        }
        if (str_starts_with($t, '#')) {
            continue;
        }
        $clean[] = $line;
    }

    return implode("\n", $clean);
}

function run_file(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        fwrite(STDOUT, "[skip] $path\n");
        return;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("Falha ao ler $path");
    }

    $sql = clean_sql($raw);
    $stmts = split_sql_statements($sql);
    $count = 0;

    foreach ($stmts as $s) {
        $q = trim($s);
        if ($q === '') {
            continue;
        }
        $pdo->exec($q);
        $count++;
    }

    fwrite(STDOUT, "[ok] $path ($count comandos)\n");
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) {
    $base = dirname(__DIR__);
    $files = [
        $base . '/database.sql',
        $base . '/database_migration_002_email_unique.sql',
        $base . '/database_migration_003_api_tokens.sql',
        $base . '/database_migration_004_escala_numero_licao.sql',
        $base . '/seed_demo.sql',
    ];

    try {
        $pdo = ebd_get_pdo();
        $pdo->beginTransaction();
        foreach ($files as $f) {
            run_file($pdo, $f);
        }
        $pdo->commit();
        fwrite(STDOUT, "Importação concluída com sucesso.\n");
        exit(0);
    } catch (Throwable $e) {
        if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fwrite(STDERR, 'Falha na importação: ' . $e->getMessage() . "\n");
        exit(1);
    }
}
