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
require_once dirname(__DIR__) . '/usuarios/_helpers.php';
$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');

$requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;
$congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $requestedCid);

if ($congregacaoId <= 0) {
    ebd_json_response([
        'ok' => true,
        'meta' => [
            'service' => EbdApiMeta::SERVICE,
            'version' => EbdApiMeta::VERSION,
        ],
        'turmas' => [],
    ]);
}

$sql = <<<SQL
SELECT
    t.id,
    t.nome_turma,
    t.congregacao_id,
    t.departamento_id,
    d.nome AS departamento_nome,
    (
        SELECT COUNT(*)
        FROM vinculos_turma v
        INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
        WHERE v.turma_id = t.id
          AND v.papel = 'aluno'
          AND v.ativo = 1
        {$excludeInativosAluno}
    ) AS alunos_count
FROM turmas t
LEFT JOIN departamentos d ON d.id = t.departamento_id
WHERE t.congregacao_id = :cid
ORDER BY t.nome_turma ASC
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['cid' => $congregacaoId]);
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['congregacao_id'] = (int) $row['congregacao_id'];
    $row['departamento_id'] = isset($row['departamento_id']) ? (int) $row['departamento_id'] : null;
    $row['alunos_count'] = (int) $row['alunos_count'];
}

unset($row);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'congregacao_id' => $congregacaoId,
    'turmas' => $rows,
]);
