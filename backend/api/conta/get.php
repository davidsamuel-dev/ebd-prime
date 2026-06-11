<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$auth = ebd_require_authenticated_user($pdo);

$stmt = $pdo->prepare(
    'SELECT id, nome_real, login_usuario, email FROM usuarios WHERE id = :id AND deleted_at IS NULL LIMIT 1'
);
$stmt->execute(['id' => $auth['id']]);
$row = $stmt->fetch();

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$row['id'] = (int) $row['id'];
$row['nome_real'] = (string) ($row['nome_real'] ?? '');
$row['login_usuario'] = (string) ($row['login_usuario'] ?? '');
$row['email'] = $row['email'] !== null && $row['email'] !== '' ? (string) $row['email'] : null;

$session = [
    'id' => (int) $auth['id'],
    'nome_real' => $row['nome_real'],
    'login_usuario' => $row['login_usuario'],
    'email' => $row['email'],
    'nivel_acesso' => (string) ($auth['nivel_acesso'] ?? ''),
    'congregacao_id' => isset($auth['congregacao_id']) ? (int) $auth['congregacao_id'] : null,
];
ebd_attach_igreja_to_user_row($pdo, $session);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'profile' => $row,
    'session' => $session,
]);
