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

$requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;
$congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $requestedCid);

if ($congregacaoId <= 0) {
    ebd_json_response([
        'ok' => true,
        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
        'administradores' => [],
    ]);
}

$sql = <<<'SQL'
SELECT id, nome_real, login_usuario
FROM usuarios
WHERE deleted_at IS NULL
  AND congregacao_id = :cid
  AND (
    is_admin = 1
    OR nivel_acesso IN ('admin', 'secretario')
  )
ORDER BY nome_real ASC
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['cid' => $congregacaoId]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$out = [];
foreach ($rows as $row) {
    $login = trim((string) ($row['login_usuario'] ?? ''));
    $out[] = [
        'id' => (int) $row['id'],
        'nome_real' => (string) $row['nome_real'],
        'login_usuario' => $login !== '' ? strtolower($login) : null,
    ];
}

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'administradores' => $out,
]);
