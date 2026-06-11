<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';

$pdo = ebd_get_pdo();
$tables = ['congregacoes', 'usuarios', 'turmas', 'api_tokens'];

fwrite(STDOUT, 'Host: ' . ebd_env_string('EBD_DB_HOST') . ' / ' . ebd_env_string('EBD_DB_NAME') . "\n");

foreach ($tables as $t) {
    $n = (int) $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
    fwrite(STDOUT, "  $t: $n registos\n");
}

$sub = (int) $pdo->query(
    "SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'congregacoes' AND COLUMN_NAME = 'subtitulo'"
)->fetchColumn();
fwrite(STDOUT, '  congregacoes.subtitulo: ' . ($sub ? 'sim' : 'NAO') . "\n");
