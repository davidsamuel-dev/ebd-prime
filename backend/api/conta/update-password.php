<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$atual = (string) ($body['senha_atual'] ?? $body['password_current'] ?? '');
$nova = (string) ($body['senha_nova'] ?? $body['password_new'] ?? '');

if ($atual === '' || $nova === '') {
    ebd_json_response(['ok' => false, 'error' => 'Indique a senha atual e a nova senha', 'code' => 'VALIDATION_ERROR'], 400);
}

if (mb_strlen($nova) < 6) {
    ebd_json_response(['ok' => false, 'error' => 'A nova senha deve ter pelo menos 6 caracteres', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$auth = ebd_require_authenticated_user($pdo);

$stmt = $pdo->prepare('SELECT senha FROM usuarios WHERE id = :id AND deleted_at IS NULL LIMIT 1');
$stmt->execute(['id' => $auth['id']]);
$row = $stmt->fetch();

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$hash = (string) ($row['senha'] ?? '');
if ($hash === '' || !password_verify($atual, $hash)) {
    ebd_json_response(['ok' => false, 'error' => 'Senha atual incorreta', 'code' => 'AUTH_INVALID'], 401);
}

$newHash = password_hash($nova, PASSWORD_DEFAULT);
$up = $pdo->prepare('UPDATE usuarios SET senha = :h WHERE id = :id AND deleted_at IS NULL');
$up->execute(['h' => $newHash, 'id' => $auth['id']]);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Senha atualizada com sucesso.',
]);
