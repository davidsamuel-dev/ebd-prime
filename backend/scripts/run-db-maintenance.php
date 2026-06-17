<?php

declare(strict_types=1);

/**
 * Executa manutenção de integridade (mesma lógica da migration 010).
 * Uso: php backend/scripts/run-db-maintenance.php
 */

require_once dirname(__DIR__) . '/db_connection.php';
require_once dirname(__DIR__) . '/lib/ebd_db_maintenance.php';

try {
    $pdo = ebd_get_pdo();
    $counts = ebd_run_db_maintenance($pdo);

    foreach ($counts as $label => $n) {
        fwrite(STDOUT, sprintf("%s: %d registo(s) afetado(s)\n", $label, $n));
    }

    fwrite(STDOUT, "\nManutenção concluída.\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
