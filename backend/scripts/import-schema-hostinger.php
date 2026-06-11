<?php

declare(strict_types=1);

/**
 * Importa apenas o schema completo (produção Hostinger / base vazia).
 * Não executa seed_demo.sql.
 *
 * Uso (com backend/.env apontando ao MySQL):
 *   php backend/scripts/import-schema-hostinger.php
 */

require_once dirname(__DIR__) . '/db_connection.php';

function hostinger_split_sql(string $sql): array
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

function hostinger_clean_sql(string $raw): string
{
    if (str_starts_with($raw, "\xEF\xBB\xBF")) {
        $raw = substr($raw, 3);
    }

    $lines = preg_split('/\R/', $raw) ?: [];
    $clean = [];

    foreach ($lines as $line) {
        $t = ltrim($line);
        if (str_starts_with($t, '--') || str_starts_with($t, '#')) {
            continue;
        }
        $clean[] = $line;
    }

    return implode("\n", $clean);
}

function hostinger_run_file(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        fwrite(STDOUT, "[skip] $path\n");
        return;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("Falha ao ler $path");
    }

    $sql = hostinger_clean_sql($raw);
    $stmts = hostinger_split_sql($sql);
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

$base = dirname(__DIR__);
$schema = $base . '/database.sql';

try {
    fwrite(STDOUT, 'Ligação: ' . ebd_env_string('EBD_DB_HOST') . ' / ' . ebd_env_string('EBD_DB_NAME') . "\n");
    $pdo = ebd_get_pdo();
    $pdo->beginTransaction();
    hostinger_run_file($pdo, $schema);
    $pdo->commit();
    fwrite(STDOUT, "Schema importado (sem seed demo).\n");
    exit(0);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Falha: ' . $e->getMessage() . "\n");
    exit(1);
}
