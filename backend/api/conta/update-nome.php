<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$nome = trim((string) ($body['nome_real'] ?? $body['nome'] ?? ''));

if (mb_strlen($nome) < 2) {
    ebd_json_response(['ok' => false, 'error' => 'Indique um nome com pelo menos 2 caracteres', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$auth = ebd_require_authenticated_user($pdo);

$stmt = $pdo->prepare('UPDATE usuarios SET nome_real = :n WHERE id = :id AND deleted_at IS NULL');
$stmt->execute(['n' => $nome, 'id' => $auth['id']]);

if ($stmt->rowCount() < 1) {
    ebd_json_response(['ok' => false, 'error' => 'Não foi possível atualizar o nome', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Nome atualizado.',
    'nome_real' => $nome,
]);
