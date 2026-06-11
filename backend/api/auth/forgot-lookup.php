<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
ebd_require_lib('ebd_password_recovery.php');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$usuario = trim((string) ($body['usuario'] ?? ''));

if ($usuario === '') {
    ebd_json_response(['ok' => false, 'error' => 'Indique o nome de utilizador', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$sql = <<<'SQL'
SELECT id, email, login_usuario
FROM usuarios
WHERE (email = :u OR login_usuario = :u2)
  AND deleted_at IS NULL
LIMIT 1
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['u' => $usuario, 'u2' => $usuario]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row === false) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Não encontrámos conta com este utilizador.',
        'code' => 'NOT_FOUND',
    ], 404);
}

$email = trim((string) ($row['email'] ?? ''));
if ($email === '') {
    ebd_json_response([
        'ok' => false,
        'error' => 'Esta conta não tem e-mail definido. Contacte o administrador.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'masked_email' => ebd_mask_email($email),
    'conta_handle' => ebd_conta_handle($row),
]);
