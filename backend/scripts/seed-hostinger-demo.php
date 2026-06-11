<?php

declare(strict_types=1);

/**
 * Popula a base configurada em backend/.env (Hostinger ou local).
 * Uso: php backend/scripts/seed-hostinger-demo.php
 *      php backend/scripts/seed-hostinger-demo.php --force
 */

require_once __DIR__ . '/import-schema.php';

$force = in_array('--force', $argv ?? [], true);

try {
    $pdo = ebd_get_pdo();
    $n = (int) $pdo->query('SELECT COUNT(*) FROM congregacoes')->fetchColumn();

    if ($n > 0 && !$force) {
        fwrite(STDOUT, "Já existem $n congregação(ões). Use --force para acrescentar outro seed.\n");
        exit(0);
    }

    if ($force && $n > 0) {
        fwrite(STDOUT, "Aviso: --force com dados existentes pode duplicar e-mails (uk_usuarios_email).\n");
    }

    $path = dirname(__DIR__) . '/seed_demo_hostinger.sql';
    run_file($pdo, $path);

    fwrite(STDOUT, "\nSeed aplicado em " . ebd_env_string('EBD_DB_NAME') . " @ " . ebd_env_string('EBD_DB_HOST') . "\n\n");
    fwrite(STDOUT, "Login (senha: demo123):\n");
    fwrite(STDOUT, "  admin@demo.local  ou  admin\n");
    fwrite(STDOUT, "  professor@demo.local\n");
    fwrite(STDOUT, "  secretario@demo.local\n");
    fwrite(STDOUT, "Alunos sem login: aluno1@demo.local … aluno3@demo.local (turmas Berçário / Primários)\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
