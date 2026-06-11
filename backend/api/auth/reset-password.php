<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
ebd_require_lib('ebd_password_recovery.php');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$token = trim((string) ($body['token'] ?? ''));
$novaSenha = (string) ($body['nova_senha'] ?? $body['password'] ?? '');

if ($token === '' || $novaSenha === '') {
    ebd_json_response(['ok' => false, 'error' => 'Indique token e nova senha', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$err = ebd_complete_password_reset($pdo, $token, $novaSenha);
if ($err !== null) {
    ebd_json_response(['ok' => false, 'error' => $err, 'code' => 'VALIDATION_ERROR'], 400);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Senha atualizada com sucesso.',
]);
