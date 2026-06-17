<?php

declare(strict_types=1);

/**
 * Limpeza e correções de integridade (tokens, recuperação de senha, escala).
 */

function ebd_purge_expired_api_tokens(PDO $pdo, ?int $usuarioId = null): int
{
    if ($usuarioId !== null && $usuarioId > 0) {
        $stmt = $pdo->prepare('DELETE FROM api_tokens WHERE usuario_id = :uid AND expires_at < NOW()');
        $stmt->execute(['uid' => $usuarioId]);

        return $stmt->rowCount();
    }

    $stmt = $pdo->query('DELETE FROM api_tokens WHERE expires_at < NOW()');

    return $stmt === false ? 0 : $stmt->rowCount();
}

function ebd_purge_stale_password_recovery(PDO $pdo): int
{
    $stmt = $pdo->query(
        'DELETE FROM recuperacao_senhas WHERE used_at IS NOT NULL OR expires_at < NOW()'
    );

    return $stmt === false ? 0 : $stmt->rowCount();
}

function ebd_purge_stale_onboarding_verifications(PDO $pdo): int
{
    $stmt = $pdo->query(
        <<<'SQL'
DELETE FROM onboarding_verifications
WHERE expires_at < NOW()
   OR (verified_at IS NOT NULL AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
SQL
    );

    return $stmt === false ? 0 : $stmt->rowCount();
}

function ebd_backfill_escala_from_relatorios(PDO $pdo): int
{
    $stmt = $pdo->exec(
        <<<'SQL'
INSERT INTO escala_aulas (turma_id, data_aula, professor_usuario_id)
SELECT r.turma_id, r.data_aula, r.professor_usuario_id
FROM relatorios_aula r
LEFT JOIN escala_aulas e ON e.turma_id = r.turma_id AND e.data_aula = r.data_aula
WHERE e.id IS NULL
SQL
    );

    return $stmt === false ? 0 : (int) $stmt;
}

/**
 * @return array<string, int>
 */
function ebd_run_db_maintenance(PDO $pdo, bool $purgeAllExpiredTokens = true): array
{
    $counts = [
        'api_tokens' => $purgeAllExpiredTokens
            ? ebd_purge_expired_api_tokens($pdo)
            : 0,
        'recuperacao_senhas' => ebd_purge_stale_password_recovery($pdo),
        'onboarding_verifications' => ebd_purge_stale_onboarding_verifications($pdo),
        'escala_aulas_backfill' => ebd_backfill_escala_from_relatorios($pdo),
    ];

    return $counts;
}
