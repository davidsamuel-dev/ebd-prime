<?php

declare(strict_types=1);

/**
 * Token Bearer opaco (Authorization: Bearer <hex>) + persistência só do hash SHA-256.
 * Multi-igreja: uma base MySQL (`u370088447_ebd_prime`), isolamento por `congregacao_id`.
 */

function ebd_get_bearer_plain_token(): ?string
{
    $auth = '';

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $key => $value) {
            if (strcasecmp((string) $key, 'Authorization') === 0) {
                $auth = (string) $value;
                break;
            }
        }
    }

    if ($auth !== '' && preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
        return trim($m[1]);
    }

    return null;
}

/**
 * @return array{token: string, expires_at: string}
 */
function ebd_issue_api_token(PDO $pdo, int $usuarioId): array
{
    if (!function_exists('ebd_purge_expired_api_tokens')) {
        $maintenance = dirname(__DIR__, 2) . '/lib/ebd_db_maintenance.php';
        if (is_readable($maintenance)) {
            require_once $maintenance;
        }
    }
    if (function_exists('ebd_purge_expired_api_tokens')) {
        ebd_purge_expired_api_tokens($pdo, $usuarioId);
    }

    $plain = bin2hex(random_bytes(32));
    $hash = hash('sha256', $plain);
    $expiresAt = (new DateTimeImmutable('+30 days'))->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'INSERT INTO api_tokens (usuario_id, token_hash, expires_at) VALUES (:uid, :h, :exp)'
    );
    $stmt->execute([
        'uid' => $usuarioId,
        'h' => $hash,
        'exp' => $expiresAt,
    ]);

    return [
        'token' => $plain,
        'expires_at' => $expiresAt,
    ];
}

function ebd_revoke_api_token(PDO $pdo, string $plainToken): bool
{
    if ($plainToken === '') {
        return false;
    }

    $hash = hash('sha256', $plainToken);
    $stmt = $pdo->prepare('DELETE FROM api_tokens WHERE token_hash = :h');

    return $stmt->execute(['h' => $hash]) && $stmt->rowCount() > 0;
}

/**
 * @return array<string, mixed>
 */
function ebd_require_authenticated_user(PDO $pdo): array
{
    $plain = ebd_get_bearer_plain_token();

    if ($plain === null || $plain === '') {
        ebd_json_response([
            'ok' => false,
            'error' => 'Autenticação necessária',
            'code' => 'AUTH_REQUIRED',
        ], 401);
    }

    $hash = hash('sha256', $plain);

    $sql = <<<'SQL'
SELECT u.id, u.nome_real, u.email, u.nivel_acesso, u.congregacao_id, u.is_admin
FROM api_tokens t
INNER JOIN usuarios u ON u.id = t.usuario_id
WHERE t.token_hash = :h
  AND t.expires_at > NOW()
  AND u.deleted_at IS NULL
LIMIT 1
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['h' => $hash]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Sessão inválida ou expirada',
            'code' => 'AUTH_INVALID',
        ], 401);
    }

    $row['id'] = (int) $row['id'];
    $row['congregacao_id'] = isset($row['congregacao_id']) ? (int) $row['congregacao_id'] : null;
    $row['is_admin'] = isset($row['is_admin']) ? (int) $row['is_admin'] : 0;

    return $row;
}

/**
 * Conta da plataforma (sem igreja fixa). Igrejas normais NÃO passam aqui.
 */
function ebd_auth_is_platform_operator(array $auth): bool
{
    $cid = isset($auth['congregacao_id']) ? (int) $auth['congregacao_id'] : 0;

    return $cid <= 0 && ((int) ($auth['is_admin'] ?? 0)) === 1;
}

/** @deprecated Use ebd_auth_is_platform_operator — mantido por compatibilidade interna. */
function ebd_auth_may_view_all_congregacoes(array $auth): bool
{
    return ebd_auth_is_platform_operator($auth);
}

/**
 * ID da igreja (tenant) para o pedido atual — sempre a do utilizador autenticado.
 */
function ebd_resolve_congregacao_scope(PDO $pdo, array $auth, int $requestedCid): int
{
    if (ebd_auth_is_platform_operator($auth)) {
        if ($requestedCid > 0) {
            $chk = $pdo->prepare('SELECT id FROM congregacoes WHERE id = :id LIMIT 1');
            $chk->execute(['id' => $requestedCid]);

            if ($chk->fetch() !== false) {
                return $requestedCid;
            }
        }

        ebd_json_response([
            'ok' => false,
            'error' => 'Indique a igreja (congregacao_id) no pedido',
            'code' => 'NO_CONGREGACAO',
        ], 400);
    }

    $mine = isset($auth['congregacao_id']) ? (int) $auth['congregacao_id'] : 0;

    if ($mine <= 0) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Utilizador sem igreja associada. Refaça o login.',
            'code' => 'NO_CONGREGACAO',
        ], 403);
    }

    if ($requestedCid > 0 && $requestedCid !== $mine) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Acesso negado a dados de outra igreja',
            'code' => 'FORBIDDEN',
        ], 403);
    }

    return $mine;
}

function ebd_assert_usuario_same_congregacao(array $auth, ?int $targetCongregacaoId): void
{
    if (ebd_auth_is_platform_operator($auth)) {
        return;
    }

    $mine = isset($auth['congregacao_id']) ? (int) $auth['congregacao_id'] : 0;
    $target = $targetCongregacaoId ?? 0;

    if ($mine <= 0 || $target <= 0 || $mine !== $target) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Acesso negado',
            'code' => 'FORBIDDEN',
        ], 403);
    }
}

function ebd_auth_is_school_admin(array $auth): bool
{
    if (((int) ($auth['is_admin'] ?? 0)) === 1) {
        return true;
    }

    $nivel = strtolower((string) ($auth['nivel_acesso'] ?? ''));

    return in_array($nivel, ['admin', 'secretario'], true);
}

function ebd_require_school_admin(array $auth): void
{
    if (!ebd_auth_is_school_admin($auth)) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Apenas administradores podem executar esta ação.',
            'code' => 'FORBIDDEN',
        ], 403);
    }
}

/** E-mail técnico por igreja + login (evita choque global na coluna email UNIQUE). */
function ebd_build_admin_invite_email(string $loginUsuario, int $congregacaoId): string
{
    $slug = preg_replace('/[^a-z0-9]/', '', strtolower(trim($loginUsuario))) ?? '';

    if ($slug === '') {
        $slug = 'user';
    }

    return $slug . '.ig' . max(1, $congregacaoId) . '@acesso.ebd.adparaiso.com.br';
}

/**
 * @return array{id: int, congregacao_id: int}
 */
function ebd_require_turma_in_scope(PDO $pdo, array $auth, int $turmaId): array
{
    if ($turmaId <= 0) {
        ebd_json_response(['ok' => false, 'error' => 'turma_id inválido', 'code' => 'VALIDATION_ERROR'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, congregacao_id FROM turmas WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $turmaId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        ebd_json_response(['ok' => false, 'error' => 'Turma não encontrada', 'code' => 'NOT_FOUND'], 404);
    }

    $cid = (int) $row['congregacao_id'];
    $scope = ebd_resolve_congregacao_scope($pdo, $auth, $cid);

    if ($cid !== $scope) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Turma de outra igreja',
            'code' => 'FORBIDDEN',
        ], 403);
    }

    return [
        'id' => (int) $row['id'],
        'congregacao_id' => $cid,
    ];
}

/** Dados da igreja do utilizador (login / onboarding). */
function ebd_attach_igreja_to_user_row(PDO $pdo, array &$row): void
{
    $cid = isset($row['congregacao_id']) ? (int) $row['congregacao_id'] : 0;

    if ($cid <= 0) {
        return;
    }

    $stmt = $pdo->prepare(
        'SELECT nome, bairro, subtitulo FROM congregacoes WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $cid]);
    $igreja = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($igreja !== false) {
        $row['congregacao_nome'] = $igreja['nome'] ?? null;
        $row['congregacao_bairro'] = $igreja['bairro'] ?? null;
        $row['congregacao_subtitulo'] = $igreja['subtitulo'] ?? null;
    }
}
