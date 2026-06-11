<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$turmaId = isset($_GET['turma_id']) ? (int) $_GET['turma_id'] : 0;
$dateFrom = trim((string) ($_GET['date_from'] ?? ''));
$dateTo = trim((string) ($_GET['date_to'] ?? ''));

if ($turmaId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    ebd_json_response(['ok' => false, 'error' => 'Intervalo inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

if ($dateFrom > $dateTo) {
    ebd_json_response(['ok' => false, 'error' => 'Data inicial maior que a final', 'code' => 'VALIDATION_ERROR'], 400);
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

$stmtAlunos = $pdo->prepare(
    'SELECT v.usuario_id, u.nome_real
     FROM vinculos_turma v
     INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
     WHERE v.turma_id = :tid AND v.papel = \'aluno\' AND v.ativo = 1'
    . $excludeInativosAluno . '
     ORDER BY u.nome_real ASC'
);
$stmtAlunos->execute(['tid' => $turmaId]);
$alunoRows = $stmtAlunos->fetchAll(PDO::FETCH_ASSOC);

$alunoIds = [];
$nomeBy = [];
foreach ($alunoRows as $row) {
    $uid = (int) $row['usuario_id'];
    $alunoIds[] = $uid;
    $nomeBy[$uid] = (string) $row['nome_real'];
}

$alunosCount = count($alunoIds);

$stmtDatas = $pdo->prepare(
    'SELECT data_aula FROM escala_aulas
     WHERE turma_id = :tid AND data_aula >= :df AND data_aula <= :dt
     ORDER BY data_aula ASC'
);
$stmtDatas->execute(['tid' => $turmaId, 'df' => $dateFrom, 'dt' => $dateTo]);
$datas = $stmtDatas->fetchAll(PDO::FETCH_COLUMN);
$totalAulas = count($datas);

$presencasByUser = array_fill_keys($alunoIds, 0);
$pontosByUser = array_fill_keys($alunoIds, 0);

if ($totalAulas > 0 && $alunosCount > 0) {
    $placeholders = implode(',', array_fill(0, $alunosCount, '?'));
    $sql = <<<SQL
SELECT f.usuario_id, f.presenca, f.pontuacao_total
FROM relatorios_aula r
INNER JOIN frequencia f ON f.relatorio_aula_id = r.id
WHERE r.turma_id = ?
  AND r.data_aula >= ?
  AND r.data_aula <= ?
  AND f.usuario_id IN ($placeholders)
SQL;
    $params = array_merge([$turmaId, $dateFrom, $dateTo], $alunoIds);
    $stmtFreq = $pdo->prepare($sql);
    $stmtFreq->execute($params);
    while ($ln = $stmtFreq->fetch(PDO::FETCH_ASSOC)) {
        $uid = (int) $ln['usuario_id'];
        if ((int) $ln['presenca'] !== 0) {
            $presencasByUser[$uid] = ($presencasByUser[$uid] ?? 0) + 1;
        }
        $pontosByUser[$uid] = ($pontosByUser[$uid] ?? 0) + (int) $ln['pontuacao_total'];
    }
}

$sumPct = 0;
$nPct = 0;
foreach ($alunoIds as $uid) {
    $pres = $presencasByUser[$uid] ?? 0;
    $pct = $totalAulas > 0 ? (int) round((100 * $pres) / $totalAulas) : 0;
    $sumPct += $pct;
    $nPct += 1;
}
$mediaIntervaloPct = $nPct > 0 ? (int) round($sumPct / $nPct) : 0;

/**
 * @param list<array{usuario_id: int, nome_real: string, valor: int}> $rows
 * @return list<array{usuario_id: int, nome_real: string, valor: int, rank: int}>
 */
function ebd_rank_rows(array $rows): array
{
    usort($rows, static function (array $a, array $b): int {
        $cmp = $b['valor'] <=> $a['valor'];
        if ($cmp !== 0) {
            return $cmp;
        }

        return strcmp($a['nome_real'], $b['nome_real']);
    });

    $out = [];
    $rank = 1;
    foreach ($rows as $i => $row) {
        if ($i > 0 && $row['valor'] !== $rows[$i - 1]['valor']) {
            $rank = $i + 1;
        }
        $out[] = [
            'usuario_id' => $row['usuario_id'],
            'nome_real' => $row['nome_real'],
            'valor' => $row['valor'],
            'rank' => $rank,
        ];
    }

    return $out;
}

$freqRows = [];
$pontRows = [];
foreach ($alunoIds as $uid) {
    $freqRows[] = [
        'usuario_id' => $uid,
        'nome_real' => $nomeBy[$uid] ?? '',
        'valor' => $presencasByUser[$uid] ?? 0,
    ];
    $pontRows[] = [
        'usuario_id' => $uid,
        'nome_real' => $nomeBy[$uid] ?? '',
        'valor' => $pontosByUser[$uid] ?? 0,
    ];
}

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'turma_id' => $turmaId,
    'alunos_count' => $alunosCount,
    'total_aulas' => $totalAulas,
    'media_intervalo_pct' => $mediaIntervaloPct,
    'ranking_frequencia' => ebd_rank_rows($freqRows),
    'ranking_pontuacao' => ebd_rank_rows($pontRows),
]);
