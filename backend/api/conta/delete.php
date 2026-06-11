<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$senha = (string) ($body['senha'] ?? $body['password'] ?? '');

if ($senha === '') {
    ebd_json_response(['ok' => false, 'error' => 'Confirme a sua senha para excluir a conta', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$auth = ebd_require_authenticated_user($pdo);

$stmt = $pdo->prepare('SELECT senha, nivel_acesso FROM usuarios WHERE id = :id AND deleted_at IS NULL LIMIT 1');
$stmt->execute(['id' => $auth['id']]);
$row = $stmt->fetch();

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$nivel = strtolower((string) ($row['nivel_acesso'] ?? ''));
if ($nivel === 'super_admin') {
    ebd_json_response(['ok' => false, 'error' => 'Conta de super administrador não pode ser excluída por aqui', 'code' => 'FORBIDDEN'], 403);
}

$hash = (string) ($row['senha'] ?? '');
if ($hash === '' || !password_verify($senha, $hash)) {
    ebd_json_response(['ok' => false, 'error' => 'Senha incorreta', 'code' => 'AUTH_INVALID'], 401);
}

$pdo->beginTransaction();

try {
    $pdo->prepare('DELETE FROM api_tokens WHERE usuario_id = :id')->execute(['id' => $auth['id']]);
    $pdo->prepare('UPDATE usuarios SET deleted_at = NOW() WHERE id = :id')->execute(['id' => $auth['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    ebd_json_response(['ok' => false, 'error' => 'Erro ao excluir conta', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Conta excluída.',
]);
