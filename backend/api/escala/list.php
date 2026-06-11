<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$turmaId = isset($_GET['turma_id']) ? (int) $_GET['turma_id'] : 0;

if ($turmaId <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'turma_id é obrigatório', 'code' => 'VALIDATION_ERROR'], 400);
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
$freqAlunosJoin = ebd_sql_frequencia_somente_alunos('f', $pdo);

$sql = <<<SQL
SELECT
    e.id,
    e.turma_id,
    e.data_aula,
    e.numero_licao,
    e.professor_usuario_id,
    e.professor_visitante_nome,
    e.tema_licao,
    u.nome_real AS professor_nome,
    r.id AS relatorio_id,
    r.status AS relatorio_status,
    COALESCE(fp.cnt, 0) AS presentes,
    COALESCE(fa.cnt, 0) AS ausentes,
    COALESCE(ft.cnt, 0) AS chamadas_registadas
FROM escala_aulas e
LEFT JOIN usuarios u ON u.id = e.professor_usuario_id AND u.deleted_at IS NULL
LEFT JOIN relatorios_aula r ON r.turma_id = e.turma_id AND r.data_aula = e.data_aula
LEFT JOIN (
    SELECT f.relatorio_aula_id, COUNT(*) AS cnt
    FROM frequencia f
    {$freqAlunosJoin}
    WHERE f.presenca = 1
    GROUP BY f.relatorio_aula_id
) fp ON fp.relatorio_aula_id = r.id
LEFT JOIN (
    SELECT f.relatorio_aula_id, COUNT(*) AS cnt
    FROM frequencia f
    {$freqAlunosJoin}
    WHERE f.presenca = 0
    GROUP BY f.relatorio_aula_id
) fa ON fa.relatorio_aula_id = r.id
LEFT JOIN (
    SELECT f.relatorio_aula_id, COUNT(*) AS cnt
    FROM frequencia f
    {$freqAlunosJoin}
    GROUP BY f.relatorio_aula_id
) ft ON ft.relatorio_aula_id = r.id
WHERE e.turma_id = :tid
ORDER BY e.data_aula DESC
LIMIT 200
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['tid' => $turmaId]);
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['turma_id'] = (int) $row['turma_id'];
    $row['numero_licao'] = isset($row['numero_licao']) ? (int) $row['numero_licao'] : null;
    $row['professor_usuario_id'] = isset($row['professor_usuario_id'])
        ? (int) $row['professor_usuario_id']
        : null;
    $row['relatorio_id'] = isset($row['relatorio_id']) ? (int) $row['relatorio_id'] : null;
    $row['relatorio_status'] = $row['relatorio_status'] ?? null;
    $row['presentes'] = (int) ($row['presentes'] ?? 0);
    $row['ausentes'] = (int) ($row['ausentes'] ?? 0);
    $row['chamadas_registadas'] = (int) ($row['chamadas_registadas'] ?? 0);
    $tot = $row['presentes'] + $row['ausentes'];
    $row['media_pct'] = $tot > 0 ? (int) round(100 * $row['presentes'] / $tot) : null;
}

unset($row);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'turma_id' => $turmaId,
    'escala' => $rows,
]);
