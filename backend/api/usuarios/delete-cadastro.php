<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$usuarioId = isset($body['usuario_id']) ? (int) $body['usuario_id'] : 0;
$congregacaoId = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;

if ($usuarioId <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$scopeCid = ebd_resolve_congregacao_scope($pdo, $auth, $congregacaoId);
if ($scopeCid <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);
}

$usuario = ebd_fetch_usuario_in_congregacao($pdo, $usuarioId, $scopeCid);
if ($usuario === false) {
    ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
}

if (ebd_usuario_is_protected_staff($usuario)) {
    ebd_json_response(['ok' => false, 'error' => 'Não é possível excluir este tipo de conta.', 'code' => 'FORBIDDEN'], 403);
}

$ativos = ebd_fetch_active_aluno_vinculos($pdo, $usuarioId);
if (count($ativos) > 0) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Inative o cadastro nas chamadas antes de excluir definitivamente.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

try {
    $pdo->prepare('DELETE FROM usuarios WHERE id = :id')->execute(['id' => $usuarioId]);
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao excluir cadastro', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'message' => 'Cadastro excluído definitivamente.',
]);
