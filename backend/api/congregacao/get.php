<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$requested = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;
$cid = ebd_resolve_congregacao_scope($pdo, $auth, $requested);

$stmt = $pdo->prepare(
    'SELECT id, nome, subtitulo, logradouro, numero, bairro, estado, cidade, status
     FROM congregacoes WHERE id = :id LIMIT 1',
);
$stmt->execute(['id' => $cid]);
$row = $stmt->fetch();

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Dados da igreja não encontrados', 'code' => 'NOT_FOUND'], 404);
}

$row['id'] = (int) $row['id'];

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'congregacao' => $row,
]);
