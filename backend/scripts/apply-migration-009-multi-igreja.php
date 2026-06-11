<?php

declare(strict_types=1);

/**
 * Aplica database_migration_009_multi_igreja_login.sql na base configurada em .env
 * Uso: php backend/scripts/apply-migration-009-multi-igreja.php
 */

require_once dirname(__DIR__) . '/db_connection.php';

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    fwrite(STDERR, 'Ligação falhou: ' . $e->getMessage() . "\n");
    exit(1);
}

$db = ebd_env_string('EBD_DB_NAME');
fwrite(STDOUT, "Base: {$db} @ " . ebd_env_string('EBD_DB_HOST') . "\n\n");

$hasOld = (int) $pdo->query(
    "SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'usuarios'
       AND INDEX_NAME = 'uk_usuarios_login_usuario'"
)->fetchColumn();

$hasNew = (int) $pdo->query(
    "SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'usuarios'
       AND INDEX_NAME = 'uk_usuarios_congregacao_login'"
)->fetchColumn();

fwrite(STDOUT, "Índice uk_usuarios_login_usuario (global): " . ($hasOld ? 'existe' : 'não existe') . "\n");
fwrite(STDOUT, "Índice uk_usuarios_congregacao_login: " . ($hasNew ? 'existe' : 'não existe') . "\n\n");

if ($hasNew) {
    fwrite(STDOUT, "Migração 009 já aplicada — nada a fazer.\n");
} else {
    if ($hasOld) {
        $pdo->exec('ALTER TABLE `usuarios` DROP INDEX `uk_usuarios_login_usuario`');
        fwrite(STDOUT, "OK — removido uk_usuarios_login_usuario\n");
    }
    $pdo->exec(
        'ALTER TABLE `usuarios` ADD UNIQUE KEY `uk_usuarios_congregacao_login` (`congregacao_id`, `login_usuario`)'
    );
    fwrite(STDOUT, "OK — criado uk_usuarios_congregacao_login\n");
}

fwrite(STDOUT, "\n--- Igrejas (congregacoes) ---\n");
$rows = $pdo->query('SELECT id, nome, cidade, status FROM congregacoes ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    $cidade = $r['cidade'] ?? '-';
    fwrite(STDOUT, sprintf('  #%d %s (%s) [%s]' . "\n", $r['id'], $r['nome'], $cidade, $r['status']));
}
fwrite(STDOUT, 'Total igrejas: ' . count($rows) . "\n\n");

fwrite(STDOUT, "--- Utilizadores por igreja ---\n");
$u = $pdo->query(
    'SELECT congregacao_id, COUNT(*) AS n FROM usuarios WHERE deleted_at IS NULL GROUP BY congregacao_id ORDER BY congregacao_id'
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($u as $row) {
    $cid = $row['congregacao_id'] ?? 'NULL';
    fwrite(STDOUT, "  congregacao_id={$cid}: {$row['n']} utilizadores\n");
}

fwrite(STDOUT, "\n--- Turmas por igreja ---\n");
$t = $pdo->query(
    'SELECT congregacao_id, COUNT(*) AS n FROM turmas GROUP BY congregacao_id ORDER BY congregacao_id'
)->fetchAll(PDO::FETCH_ASSOC);
foreach ($t as $row) {
    fwrite(STDOUT, "  congregacao_id={$row['congregacao_id']}: {$row['n']} turmas\n");
}

fwrite(STDOUT, "\nConcluído.\n");
