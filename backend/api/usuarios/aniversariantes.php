<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$mes = isset($_GET['mes']) ? (int) $_GET['mes'] : (int) date('n');

if ($mes < 1 || $mes > 12) {
    ebd_json_response(['ok' => false, 'error' => 'mes deve estar entre 1 e 12', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;

if (ebd_auth_may_view_all_congregacoes($auth)) {
    $congregacaoId = $requestedCid;
} else {
    $mine = isset($auth['congregacao_id']) ? (int) $auth['congregacao_id'] : 0;

    if ($mine <= 0) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Utilizador sem congregação definida',
            'code' => 'NO_CONGREGACAO',
        ], 403);
    }

    if ($requestedCid > 0 && $requestedCid !== $mine) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Acesso negado a esta congregação',
            'code' => 'FORBIDDEN',
        ], 403);
    }

    $congregacaoId = $mine;
}

$sql = <<<'SQL'
SELECT
    u.id,
    u.nome_real,
    u.data_nascimento,
    DAY(u.data_nascimento) AS dia
FROM usuarios u
WHERE u.deleted_at IS NULL
  AND u.data_nascimento IS NOT NULL
  AND MONTH(u.data_nascimento) = :mes
SQL;

$params = ['mes' => $mes];

if ($congregacaoId > 0) {
    $sql .= ' AND u.congregacao_id = :cid';
    $params['cid'] = $congregacaoId;
}

$sql .= ' ORDER BY DAY(u.data_nascimento) ASC, u.nome_real ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['dia'] = (int) $r['dia'];
}

unset($r);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'mes' => $mes,
    'aniversariantes' => $rows,
]);
