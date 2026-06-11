<?php

declare(strict_types=1);

/**
 * Aplica database_migration_009_inativos_sem_turma_smtp.sql na base configurada em .env
 * Uso (Hostinger SSH ou local): php backend/scripts/apply-migration-009-inativos.php
 */

require_once dirname(__DIR__) . '/db_connection.php';

$sqlFile = dirname(__DIR__) . '/database_migration_009_inativos_sem_turma_smtp.sql';
if (!is_readable($sqlFile)) {
    fwrite(STDERR, "Ficheiro não encontrado: $sqlFile\n");
    exit(1);
}

$raw = file_get_contents($sqlFile);
$statements = array_filter(
    array_map('trim', preg_split('/;\s*\n/', $raw) ?: []),
    static fn (string $s): bool => $s !== '' && !str_starts_with($s, '--'),
);

try {
    $pdo = ebd_get_pdo();
    foreach ($statements as $statement) {
        $pdo->exec($statement);
        fwrite(STDOUT, "OK: " . substr(str_replace("\n", ' ', $statement), 0, 80) . "...\n");
    }
    fwrite(STDOUT, "\nMigration 009 (inativos + SMTP) aplicada.\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
