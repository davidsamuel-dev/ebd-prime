<?php

declare(strict_types=1);

/**
 * Testa leitura/escrita na base configurada em backend/.env
 * Uso: php backend/scripts/test-db-modifications.php
 */

require_once dirname(__DIR__) . '/db_connection.php';

try {
    $pdo = ebd_get_pdo();

    $hasSubtitulo = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'congregacoes' AND COLUMN_NAME = 'subtitulo'"
    )->fetchColumn();

    if ($hasSubtitulo === 0) {
        $pdo->exec(
            "ALTER TABLE congregacoes ADD COLUMN subtitulo VARCHAR(255) DEFAULT NULL AFTER nome"
        );
        fwrite(STDOUT, "Migração: coluna congregacoes.subtitulo criada.\n");
    } else {
        fwrite(STDOUT, "Schema: congregacoes.subtitulo já existe.\n");
    }

    $row = $pdo->query('SELECT id, nome, subtitulo FROM congregacoes ORDER BY id LIMIT 1')->fetch();
    if (!$row) {
        fwrite(STDOUT, "Aviso: nenhuma congregação — importe seed ou cadastre na app.\n");
        exit(0);
    }

    $id = (int) $row['id'];
    $antes = $row['subtitulo'];
    $marca = 'teste_' . date('YmdHis');

    $pdo->prepare('UPDATE congregacoes SET subtitulo = :s WHERE id = :id')
        ->execute(['s' => $marca, 'id' => $id]);

    $depois = $pdo->prepare('SELECT subtitulo FROM congregacoes WHERE id = :id');
    $depois->execute(['id' => $id]);
    $lido = (string) ($depois->fetchColumn() ?: '');

    $pdo->prepare('UPDATE congregacoes SET subtitulo = :s WHERE id = :id')
        ->execute(['s' => $antes, 'id' => $id]);

    if ($lido !== $marca) {
        throw new RuntimeException("Escrita falhou: esperado $marca, lido $lido");
    }

    fwrite(STDOUT, "OK — UPDATE/SELECT em congregacoes (id=$id), subtítulo revertido.\n");
    fwrite(STDOUT, 'Base: ' . ebd_env_string('EBD_DB_NAME') . ' @ ' . ebd_env_string('EBD_DB_HOST') . "\n");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
