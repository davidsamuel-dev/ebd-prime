<?php

declare(strict_types=1);

/**
 * Lista alunos matriculados na turma (vínculo ativo) para a chamada.
 * GET ?turma_id=
 */
require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$turmaId = isset($_GET['turma_id']) ? (int) $_GET['turma_id'] : 0;

if ($turmaId <= 0) {
    ebd_json_response([
        'ok' => false,
        'error' => 'turma_id é obrigatório',
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
$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');

$sql = <<<SQL
SELECT
    u.id,
    u.nome_real,
    0 AS presenca,
    0 AS biblia,
    0 AS revista,
    0 AS pontuacao_total
FROM vinculos_turma v
INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
WHERE v.turma_id = :tid
  AND v.papel = 'aluno'
  AND v.ativo = 1
{$excludeInativosAluno}
ORDER BY u.nome_real ASC
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['tid' => $turmaId]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['presenca'] = false;
    $row['biblia'] = false;
    $row['revista'] = false;
    $row['pontuacao_total'] = 0;
}

unset($row);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'turma_id' => $turmaId,
    'linhas' => $rows,
]);
