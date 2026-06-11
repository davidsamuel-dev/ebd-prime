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
$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');

$stmtRel = $pdo->prepare(
    'SELECT id FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
);
$stmtRel->execute(['tid' => $turmaId, 'd' => $dataAula]);
$relatorioId = $stmtRel->fetchColumn();
$relatorioId = $relatorioId !== false ? (int) $relatorioId : 0;

if ($relatorioId > 0) {
    $sql = <<<SQL
SELECT
    u.id,
    u.nome_real,
    COALESCE(f.presenca, 0) AS presenca,
    COALESCE(f.biblia, 0) AS biblia,
    COALESCE(f.revista, 0) AS revista,
    COALESCE(f.pontuacao_total, 0) AS pontuacao_total
FROM vinculos_turma v
INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
LEFT JOIN frequencia f
    ON f.usuario_id = u.id AND f.relatorio_aula_id = :rid
WHERE v.turma_id = :tid
  AND v.papel = 'aluno'
  AND v.ativo = 1
{$excludeInativosAluno}
ORDER BY u.nome_real ASC
SQL;
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['tid' => $turmaId, 'rid' => $relatorioId]);
} else {
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
}
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['presenca'] = (int) $row['presenca'] !== 0;
    $row['biblia'] = (int) $row['biblia'] !== 0;
    $row['revista'] = (int) $row['revista'] !== 0;
    $row['pontuacao_total'] = (int) $row['pontuacao_total'];
}

unset($row);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'turma_id' => $turmaId,
    'data_aula' => $dataAula,
    'relatorio_id' => $relatorioId > 0 ? $relatorioId : null,
    'linhas' => $rows,
]);
