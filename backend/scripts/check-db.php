#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Testa PDO + credenciais do `backend/.env`. Uso: php backend/scripts/check-db.php
 */
require_once dirname(__DIR__) . '/db_connection.php';

try {
    $pdo = ebd_get_pdo();
    $pdo->query('SELECT 1');
    $st = $pdo->query('SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "api_tokens"');
    $row = $st->fetch();
    $hasTokens = isset($row['c']) && (int) $row['c'] > 0;
    fwrite(STDOUT, "MySQL OK. Tabela api_tokens: " . ($hasTokens ? "sim\n" : "NÃO (importe database.sql)\n"));
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Falha: ' . $e->getMessage() . "\n");
    fwrite(STDERR, "Arranque o MySQL (XAMPP, Laragon) ou aponte backend/.env para a Hostinger.\n");
    fwrite(STDERR, "Importe schema: npm run db:import  ou  npm run db:import:php\n");
    exit(1);
}
