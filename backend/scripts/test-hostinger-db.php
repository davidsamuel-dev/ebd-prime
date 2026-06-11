<?php

declare(strict_types=1);

/**
 * Testa ligação PDO com as credenciais de backend/.env
 * Uso: php backend/scripts/test-hostinger-db.php
 */

require_once dirname(__DIR__) . '/db_connection.php';

try {
    $pdo = ebd_get_pdo();
    $v = $pdo->query('SELECT VERSION() AS v')->fetch();
    $tables = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
    )->fetchColumn();

    fwrite(STDOUT, "OK — MySQL " . ($v['v'] ?? '?') . "\n");
    fwrite(STDOUT, "Base: " . ebd_env_string('EBD_DB_NAME') . " — tabelas: $tables\n");

    if ($tables === 0) {
        fwrite(STDOUT, "Aviso: nenhuma tabela. Importe backend/database.sql no phpMyAdmin.\n");
    }

    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
