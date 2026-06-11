<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$login = strtolower(trim((string) ($body['login_usuario'] ?? $body['usuario'] ?? '')));

if ($login === '' || mb_strlen($login) < 3) {
    ebd_json_response(['ok' => false, 'error' => 'Utilize um nome de utilizador com pelo menos 3 caracteres', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!preg_match('/^[a-z0-9._-]+$/', $login)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Utilize apenas letras minúsculas, números, ponto, traço ou sublinhado',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$auth = ebd_require_authenticated_user($pdo);

$dup = $pdo->prepare(
    'SELECT id FROM usuarios WHERE login_usuario = :l AND id <> :id AND deleted_at IS NULL LIMIT 1'
);
$dup->execute(['l' => $login, 'id' => $auth['id']]);
if ($dup->fetch() !== false) {
    ebd_json_response(['ok' => false, 'error' => 'Este utilizador já está em uso', 'code' => 'DUPLICATE_ENTRY'], 409);
}

$stmt = $pdo->prepare('UPDATE usuarios SET login_usuario = :l WHERE id = :id AND deleted_at IS NULL');
$stmt->execute(['l' => $login, 'id' => $auth['id']]);

if ($stmt->rowCount() < 1) {
    ebd_json_response(['ok' => false, 'error' => 'Não foi possível atualizar o utilizador', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Utilizador de acesso atualizado.',
    'login_usuario' => $login,
]);
