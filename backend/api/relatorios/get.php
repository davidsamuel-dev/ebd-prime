<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$turmaId = isset($_GET['turma_id']) ? (int) $_GET['turma_id'] : 0;
$dataAula = trim((string) ($_GET['data_aula'] ?? ''));

if ($turmaId <= 0 || $dataAula === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'turma_id e data_aula (YYYY-MM-DD) são obrigatórios',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

ebd_require_turma_in_scope($pdo, $auth, $turmaId);

require_once dirname(__DIR__) . '/usuarios/_helpers.php';

$sql = <<<'SQL'
SELECT
    r.id,
    r.turma_id,
    r.professor_usuario_id,
    r.data_aula,
    r.tema_licao,
    r.total_biblias,
    r.total_revistas,
    r.total_visitantes,
    r.valor_oferta,
    r.observacoes,
    r.status
FROM relatorios_aula r
WHERE r.turma_id = :tid AND r.data_aula = :d
LIMIT 1
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['tid' => $turmaId, 'd' => $dataAula]);
$row = $stmt->fetch();

if ($row === false) {
    ebd_json_response([
        'ok' => true,
        'meta' => [
            'service' => EbdApiMeta::SERVICE,
            'version' => EbdApiMeta::VERSION,
        ],
        'relatorio' => null,
    ]);
}

$row['id'] = (int) $row['id'];
$row['turma_id'] = (int) $row['turma_id'];
$row['professor_usuario_id'] = isset($row['professor_usuario_id'])
    ? (int) $row['professor_usuario_id']
    : null;
$row['total_biblias'] = (int) $row['total_biblias'];
$row['total_revistas'] = (int) $row['total_revistas'];
$row['total_visitantes'] = (int) $row['total_visitantes'];
$row['valor_oferta'] = (float) $row['valor_oferta'];
$row['chamadas_registadas'] = ebd_count_frequencia_alunos_relatorio($pdo, (int) $row['id']);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'relatorio' => $row,
]);
