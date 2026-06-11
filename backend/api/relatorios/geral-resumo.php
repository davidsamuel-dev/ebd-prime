<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$dateFrom = trim((string) ($_GET['date_from'] ?? ''));
$dateTo = trim((string) ($_GET['date_to'] ?? ''));
$papelFilter = strtolower(trim((string) ($_GET['papel'] ?? 'todos')));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    ebd_json_response(['ok' => false, 'error' => 'Intervalo inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

if ($dateFrom > $dateTo) {
    ebd_json_response(['ok' => false, 'error' => 'Data inicial maior que a final', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!in_array($papelFilter, ['todos', 'alunos', 'professores'], true)) {
    $papelFilter = 'todos';
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
$excludeInativosProfessor = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'professor');

$requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;
$congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $requestedCid);

if ($congregacaoId <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);
}

$stmtTurmas = $pdo->prepare(
    'SELECT t.id, t.nome_turma, t.departamento_id, d.nome AS departamento_nome
     FROM turmas t
     LEFT JOIN departamentos d ON d.id = t.departamento_id
     WHERE t.congregacao_id = :cid
     ORDER BY t.nome_turma ASC'
);
$stmtTurmas->execute(['cid' => $congregacaoId]);
$turmas = $stmtTurmas->fetchAll(PDO::FETCH_ASSOC);

/** @var array<int, array{departamento_id: int|null, departamento_nome: string}> */
$turmaMeta = [];
foreach ($turmas as $turma) {
    $tid = (int) $turma['id'];
    $deptNome = trim((string) ($turma['departamento_nome'] ?? ''));
    $turmaMeta[$tid] = [
        'departamento_id' => isset($turma['departamento_id']) ? (int) $turma['departamento_id'] : null,
        'departamento_nome' => $deptNome !== '' ? $deptNome : 'Geral',
    ];
}

/**
 * @return list<string>
 */
function ebd_geral_papeis_for_filter(string $papelFilter): array
{
    if ($papelFilter === 'alunos') {
        return ['aluno'];
    }
    if ($papelFilter === 'professores') {
        return ['professor'];
    }

    return ['aluno', 'professor'];
}

$papeis = ebd_geral_papeis_for_filter($papelFilter);

/** @var array<int, array{nome: string, papel: string}> */
$usuariosAtivos = [];

foreach ($turmas as $turma) {
    $tid = (int) $turma['id'];
    foreach ($papeis as $papel) {
        $excludeInativos = $papel === 'professor' ? $excludeInativosProfessor : $excludeInativosAluno;
        $stmtV = $pdo->prepare(
            "SELECT v.usuario_id, u.nome_real, u.nivel_acesso
             FROM vinculos_turma v
             INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
             WHERE v.turma_id = :tid AND v.papel = :papel AND v.ativo = 1
             {$excludeInativos}"
        );
        $stmtV->execute(['tid' => $tid, 'papel' => $papel]);
        while ($row = $stmtV->fetch(PDO::FETCH_ASSOC)) {
            $uid = (int) $row['usuario_id'];
            if ($papel === 'professor' && strtolower((string) ($row['nivel_acesso'] ?? '')) !== 'professor') {
                continue;
            }
            if ($papel === 'aluno' && strtolower((string) ($row['nivel_acesso'] ?? '')) === 'professor') {
                continue;
            }
            $usuariosAtivos[$uid] = [
                'nome' => (string) $row['nome_real'],
                'papel' => $papel,
            ];
        }
    }
}

$userIds = array_keys($usuariosAtivos);
$presencasByUser = array_fill_keys($userIds, 0);
$pontosByUser = array_fill_keys($userIds, 0);

if (count($userIds) > 0 && count($turmas) > 0) {
    $turmaIds = array_map(static fn (array $t): int => (int) $t['id'], $turmas);
    $turmaPh = implode(',', array_fill(0, count($turmaIds), '?'));
    $userPh = implode(',', array_fill(0, count($userIds), '?'));
    $papelPh = implode(',', array_fill(0, count($papeis), '?'));
    $sql = <<<SQL
SELECT f.usuario_id, f.presenca, f.pontuacao_total, v.papel
FROM relatorios_aula r
INNER JOIN frequencia f ON f.relatorio_aula_id = r.id
INNER JOIN vinculos_turma v
    ON v.usuario_id = f.usuario_id
   AND v.turma_id = r.turma_id
   AND v.ativo = 1
   AND v.papel IN ($papelPh)
WHERE r.turma_id IN ($turmaPh)
  AND r.data_aula >= ?
  AND r.data_aula <= ?
  AND f.usuario_id IN ($userPh)
SQL;
    $params = array_merge($papeis, $turmaIds, [$dateFrom, $dateTo], $userIds);
    $stmtFreq = $pdo->prepare($sql);
    $stmtFreq->execute($params);
    while ($ln = $stmtFreq->fetch(PDO::FETCH_ASSOC)) {
        $uid = (int) $ln['usuario_id'];
        if (!isset($presencasByUser[$uid])) {
            continue;
        }
        $papelFreq = (string) ($ln['papel'] ?? '');
        if (($usuariosAtivos[$uid]['papel'] ?? '') !== $papelFreq) {
            continue;
        }
        if ((int) $ln['presenca'] !== 0) {
            $presencasByUser[$uid]++;
        }
        $pontosByUser[$uid] += (int) $ln['pontuacao_total'];
    }
}

/**
 * @param list<array{usuario_id: int, nome_real: string, valor: int}> $rows
 * @return list<array{usuario_id: int, nome_real: string, valor: int, rank: int}>
 */
function ebd_geral_rank_rows(array $rows): array
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
foreach ($userIds as $uid) {
    $freqRows[] = [
        'usuario_id' => $uid,
        'nome_real' => $usuariosAtivos[$uid]['nome'],
        'valor' => $presencasByUser[$uid] ?? 0,
    ];
    $pontRows[] = [
        'usuario_id' => $uid,
        'nome_real' => $usuariosAtivos[$uid]['nome'],
        'valor' => $pontosByUser[$uid] ?? 0,
    ];
}

$rankingTurmas = [];
foreach ($turmas as $turma) {
    $tid = (int) $turma['id'];
    $stmtAlunos = $pdo->prepare(
        "SELECT v.usuario_id
         FROM vinculos_turma v
         INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
         WHERE v.turma_id = :tid AND v.papel = 'aluno' AND v.ativo = 1
         {$excludeInativosAluno}"
    );
    $stmtAlunos->execute(['tid' => $tid]);
    $alunoIds = array_map(static fn (array $r): int => (int) $r['usuario_id'], $stmtAlunos->fetchAll(PDO::FETCH_ASSOC));
    $alunosCount = count($alunoIds);

    $stmtDatas = $pdo->prepare(
        'SELECT data_aula FROM escala_aulas
         WHERE turma_id = :tid AND data_aula >= :df AND data_aula <= :dt'
    );
    $stmtDatas->execute(['tid' => $tid, 'df' => $dateFrom, 'dt' => $dateTo]);
    $totalAulas = count($stmtDatas->fetchAll(PDO::FETCH_COLUMN));

    $sumPct = 0;
    $nPct = 0;
    if ($totalAulas > 0 && $alunosCount > 0) {
        $presMap = array_fill_keys($alunoIds, 0);
        $ph = implode(',', array_fill(0, $alunosCount, '?'));
        $sqlT = <<<SQL
SELECT f.usuario_id, f.presenca
FROM relatorios_aula r
INNER JOIN frequencia f ON f.relatorio_aula_id = r.id
WHERE r.turma_id = ?
  AND r.data_aula >= ?
  AND r.data_aula <= ?
  AND f.usuario_id IN ($ph)
SQL;
        $paramsT = array_merge([$tid, $dateFrom, $dateTo], $alunoIds);
        $stmtF = $pdo->prepare($sqlT);
        $stmtF->execute($paramsT);
        while ($ln = $stmtF->fetch(PDO::FETCH_ASSOC)) {
            $uid = (int) $ln['usuario_id'];
            if ((int) $ln['presenca'] !== 0) {
                $presMap[$uid] = ($presMap[$uid] ?? 0) + 1;
            }
        }
        foreach ($alunoIds as $uid) {
            $pres = $presMap[$uid] ?? 0;
            $sumPct += (int) round((100 * $pres) / $totalAulas);
            $nPct++;
        }
    }
    $mediaPct = $nPct > 0 ? (int) round($sumPct / $nPct) : 0;
    $rankingTurmas[] = [
        'turma_id' => $tid,
        'nome_turma' => (string) $turma['nome_turma'],
        'valor' => $mediaPct,
        'alunos_count' => $alunosCount,
        'total_aulas' => $totalAulas,
    ];
}

usort($rankingTurmas, static fn (array $a, array $b): int => $b['valor'] <=> $a['valor'] ?: strcmp($a['nome_turma'], $b['nome_turma']));
$rankT = 1;
foreach ($rankingTurmas as $i => &$rt) {
    if ($i > 0 && $rt['valor'] !== $rankingTurmas[$i - 1]['valor']) {
        $rankT = $i + 1;
    }
    $rt['rank'] = $rankT;
}
unset($rt);

$freqAlunosJoin = ebd_sql_frequencia_somente_alunos('f', $pdo);
$totalMatriculados = 0;
foreach ($rankingTurmas as $rt) {
    $totalMatriculados += (int) ($rt['alunos_count'] ?? 0);
}

$totalPresentes = 0;
$totalAusentes = 0;
$totalVisitantes = 0;
$totalBiblias = 0;
$totalRevistas = 0;
$totalOferta = 0.0;
$relatoriosEnviados = 0;
$relatoriosTotal = 0;
$aulasComRelatorio = [];

/** @var array<int, float> */
$ofertaPorTurma = [];

if (count($turmas) > 0) {
    $turmaIds = array_map(static fn (array $t): int => (int) $t['id'], $turmas);
    $turmaPh = implode(',', array_fill(0, count($turmaIds), '?'));
    $sqlRel = <<<SQL
SELECT r.id, r.turma_id, r.total_visitantes, r.total_biblias, r.total_revistas, r.valor_oferta, r.status, r.data_aula
FROM relatorios_aula r
WHERE r.turma_id IN ($turmaPh)
  AND r.data_aula >= ?
  AND r.data_aula <= ?
SQL;
    $stmtRel = $pdo->prepare($sqlRel);
    $stmtRel->execute(array_merge($turmaIds, [$dateFrom, $dateTo]));
    $relIds = [];
    while ($rel = $stmtRel->fetch(PDO::FETCH_ASSOC)) {
        $relatoriosTotal++;
        $rid = (int) $rel['id'];
        $relIds[] = $rid;
        $tid = (int) $rel['turma_id'];
        $aulasComRelatorio[(string) $rel['data_aula']] = true;
        $totalVisitantes += (int) ($rel['total_visitantes'] ?? 0);
        $totalBiblias += (int) ($rel['total_biblias'] ?? 0);
        $totalRevistas += (int) ($rel['total_revistas'] ?? 0);
        $oferta = (float) ($rel['valor_oferta'] ?? 0);
        $totalOferta += $oferta;
        $ofertaPorTurma[$tid] = ($ofertaPorTurma[$tid] ?? 0.0) + $oferta;
        if (strtolower((string) ($rel['status'] ?? '')) === 'enviado') {
            $relatoriosEnviados++;
        }
    }

    if (count($relIds) > 0) {
        $relPh = implode(',', array_fill(0, count($relIds), '?'));
        $sqlFreq = <<<SQL
SELECT f.presenca
FROM frequencia f
{$freqAlunosJoin}
WHERE f.relatorio_aula_id IN ($relPh)
SQL;
        $stmtFreqGeral = $pdo->prepare($sqlFreq);
        $stmtFreqGeral->execute($relIds);
        while ($ln = $stmtFreqGeral->fetch(PDO::FETCH_ASSOC)) {
            if ((int) ($ln['presenca'] ?? 0) !== 0) {
                $totalPresentes++;
            } else {
                $totalAusentes++;
            }
        }
    }
}

$presencaPct = $totalMatriculados > 0 && ($totalPresentes + $totalAusentes) > 0
    ? (int) round((100 * $totalPresentes) / max(1, $totalPresentes + $totalAusentes))
    : 0;
if ($dateFrom === $dateTo && $totalMatriculados > 0) {
    $presencaPct = (int) round((100 * $totalPresentes) / $totalMatriculados);
}

$todasTurmasEnviadas = count($turmas) > 0;
if ($dateFrom === $dateTo && count($turmas) > 0) {
    $stmtEnv = $pdo->prepare(
        'SELECT COUNT(*) FROM relatorios_aula
         WHERE turma_id = :tid AND data_aula = :d AND LOWER(status) = \'enviado\''
    );
    foreach ($turmas as $turma) {
        $stmtEnv->execute(['tid' => (int) $turma['id'], 'd' => $dateFrom]);
        if ((int) $stmtEnv->fetchColumn() === 0) {
            $todasTurmasEnviadas = false;
            break;
        }
    }
} else {
    $todasTurmasEnviadas = false;
}

/** @var array<string, list<array{turma_id: int, nome_turma: string, valor: int, oferta: float}>> */
$porDepartamento = [];
foreach ($rankingTurmas as $rt) {
    $tid = (int) $rt['turma_id'];
    $dept = $turmaMeta[$tid]['departamento_nome'] ?? 'Geral';
    $porDepartamento[$dept][] = [
        'turma_id' => $tid,
        'nome_turma' => (string) $rt['nome_turma'],
        'valor' => (int) $rt['valor'],
        'oferta' => round($ofertaPorTurma[$tid] ?? 0.0, 2),
    ];
}

$vencedoresDepartamento = [];
foreach ($porDepartamento as $deptNome => $candidatas) {
    usort($candidatas, static function (array $a, array $b): int {
        $cmp = $b['valor'] <=> $a['valor'];
        if ($cmp !== 0) {
            return $cmp;
        }
        $cmpOferta = ($b['oferta'] <=> $a['oferta']);
        if ($cmpOferta !== 0) {
            return $cmpOferta;
        }

        return strcmp($a['nome_turma'], $b['nome_turma']);
    });
    $top = $candidatas[0];
    if (($top['valor'] ?? 0) <= 0 && ($top['oferta'] ?? 0) <= 0) {
        continue;
    }
    $vencedoresDepartamento[] = [
        'departamento_nome' => $deptNome,
        'turma_id' => $top['turma_id'],
        'nome_turma' => $top['nome_turma'],
        'presenca_pct' => $top['valor'],
        'oferta' => $top['oferta'],
        'fechado' => $todasTurmasEnviadas,
    ];
}
usort($vencedoresDepartamento, static fn (array $a, array $b): int => strcmp($a['departamento_nome'], $b['departamento_nome']));

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'congregacao_id' => $congregacaoId,
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
    'papel' => $papelFilter,
    'indicadores' => [
        'matriculados' => $totalMatriculados,
        'presentes' => $totalPresentes,
        'ausentes' => $totalAusentes,
        'visitantes' => $totalVisitantes,
        'total' => $totalPresentes + $totalVisitantes,
        'presenca_pct' => $presencaPct,
        'biblias' => $totalBiblias,
        'revistas' => $totalRevistas,
        'oferta' => round($totalOferta, 2),
        'total_aulas' => count($aulasComRelatorio),
        'relatorios_enviados' => $relatoriosEnviados,
        'relatorios_total' => $relatoriosTotal,
        'turmas_total' => count($turmas),
        'todas_turmas_enviadas' => $todasTurmasEnviadas,
        'tem_dados' => $relatoriosTotal > 0 || $totalPresentes > 0,
    ],
    'vencedores_departamento' => $vencedoresDepartamento,
    'ranking_turmas' => $rankingTurmas,
    'ranking_frequencia' => ebd_geral_rank_rows($freqRows),
    'ranking_pontuacao' => ebd_geral_rank_rows($pontRows),
]);
