<?php

declare(strict_types=1);

/**
 * Resumo consolidado de uma aula (data única) — por turma, professores e totais gerais.
 * GET ?data_aula=YYYY-MM-DD&congregacao_id=
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/usuarios/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$dataAula = trim((string) ($_GET['data_aula'] ?? ''));
if ($dataAula === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {
    ebd_json_response(['ok' => false, 'error' => 'data_aula inválida', 'code' => 'VALIDATION_ERROR'], 400);
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
    ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);
}

$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');
$excludeInativosProfessor = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'professor');
$freqAlunosJoin = ebd_sql_frequencia_somente_alunos('f', $pdo);

$stmtTurmas = $pdo->prepare(
    'SELECT id, nome_turma FROM turmas WHERE congregacao_id = :cid ORDER BY nome_turma ASC'
);
$stmtTurmas->execute(['cid' => $congregacaoId]);
$turmasDb = $stmtTurmas->fetchAll(PDO::FETCH_ASSOC);

$stmtMat = $pdo->prepare(
    'SELECT COUNT(*) FROM vinculos_turma v
     INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
     WHERE v.turma_id = :tid AND v.papel = \'aluno\' AND v.ativo = 1'
    . $excludeInativosAluno
);

$stmtRel = $pdo->prepare(
    'SELECT id, status, total_biblias, total_revistas, total_visitantes, valor_oferta
     FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
);

$stmtPres = $pdo->prepare(
    "SELECT COUNT(*) FROM frequencia f {$freqAlunosJoin} WHERE f.relatorio_aula_id = :rid AND f.presenca = 1"
);
$stmtAus = $pdo->prepare(
    "SELECT COUNT(*) FROM frequencia f {$freqAlunosJoin} WHERE f.relatorio_aula_id = :rid AND f.presenca = 0"
);
$stmtBib = $pdo->prepare(
    "SELECT COUNT(*) FROM frequencia f {$freqAlunosJoin} WHERE f.relatorio_aula_id = :rid AND f.biblia = 1"
);
$stmtRev = $pdo->prepare(
    "SELECT COUNT(*) FROM frequencia f {$freqAlunosJoin} WHERE f.relatorio_aula_id = :rid AND f.revista = 1"
);

$stmtNumero = $pdo->prepare(
    'SELECT numero_licao FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
);

$turmas = [];
$enviados = 0;
$totalMatriculados = 0;
$totalPresentes = 0;
$totalAusentes = 0;
$totalVisitantes = 0;
$totalBiblias = 0;
$totalRevistas = 0;
$totalOferta = 0.0;
$aproveitamento = [];
$ofertaPorTurma = [];

foreach ($turmasDb as $turma) {
    $tid = (int) $turma['id'];
    $nome = (string) $turma['nome_turma'];

    $stmtMat->execute(['tid' => $tid]);
    $matriculados = (int) $stmtMat->fetchColumn();

    $stmtRel->execute(['tid' => $tid, 'd' => $dataAula]);
    $rel = $stmtRel->fetch(PDO::FETCH_ASSOC);

    $presentes = 0;
    $ausentes = 0;
    $biblias = 0;
    $revistas = 0;
    $visitantes = 0;
    $oferta = 0.0;
    $status = null;
    $chamadaFeita = false;

    if ($rel !== false) {
        $rid = (int) $rel['id'];
        $status = (string) ($rel['status'] ?? 'rascunho');
        if (strtolower($status) === 'enviado') {
            $enviados++;
        }
        $visitantes = (int) ($rel['total_visitantes'] ?? 0);
        $oferta = (float) ($rel['valor_oferta'] ?? 0);
        $biblias = (int) ($rel['total_biblias'] ?? 0);
        $revistas = (int) ($rel['total_revistas'] ?? 0);

        $stmtPres->execute(['rid' => $rid]);
        $presentes = (int) $stmtPres->fetchColumn();
        $stmtAus->execute(['rid' => $rid]);
        $ausentes = (int) $stmtAus->fetchColumn();
        $chamadaFeita = ebd_count_frequencia_alunos_relatorio($pdo, $rid) > 0;
        if (!$chamadaFeita && $matriculados === 0) {
            $chamadaFeita = true;
        }

        if ($biblias === 0) {
            $stmtBib->execute(['rid' => $rid]);
            $biblias = (int) $stmtBib->fetchColumn();
        }
        if ($revistas === 0) {
            $stmtRev->execute(['rid' => $rid]);
            $revistas = (int) $stmtRev->fetchColumn();
        }
    }

    $total = $presentes + $visitantes;
    $presencaPct = $matriculados > 0 ? (int) round((100 * $presentes) / $matriculados) : 0;

    $stmtNumero->execute(['tid' => $tid, 'd' => $dataAula]);
    $numeroLicao = $stmtNumero->fetchColumn();
    $numeroLicao = $numeroLicao !== false ? (int) $numeroLicao : null;

    $turmas[] = [
        'turma_id' => $tid,
        'nome_turma' => $nome,
        'numero_licao' => $numeroLicao,
        'matriculados' => $matriculados,
        'presentes' => $presentes,
        'ausentes' => $ausentes,
        'visitantes' => $visitantes,
        'total' => $total,
        'presenca_pct' => $presencaPct,
        'biblias' => $biblias,
        'revistas' => $revistas,
        'oferta' => round($oferta, 2),
        'chamada_feita' => $chamadaFeita,
        'relatorio_status' => $status,
    ];

    $totalMatriculados += $matriculados;
    $totalPresentes += $presentes;
    $totalAusentes += $ausentes;
    $totalVisitantes += $visitantes;
    $totalBiblias += $biblias;
    $totalRevistas += $revistas;
    $totalOferta += $oferta;

    $aproveitamento[] = [
        'label' => $nome,
        'pct' => $presencaPct,
    ];
    $ofertaPorTurma[] = [
        'label' => $nome,
        'valor' => round($oferta, 2),
    ];
}

// Professores
$stmtProfMat = $pdo->prepare(
    'SELECT COUNT(DISTINCT u.id) FROM usuarios u
     INNER JOIN vinculos_turma v ON v.usuario_id = u.id AND v.papel = \'professor\' AND v.ativo = 1
     WHERE u.deleted_at IS NULL AND u.congregacao_id = :cid
       AND LOWER(u.nivel_acesso) = \'professor\''
    . $excludeInativosProfessor
);
$stmtProfMat->execute(['cid' => $congregacaoId]);
$profMatriculados = (int) $stmtProfMat->fetchColumn();

$stmtProfPres = $pdo->prepare(
    'SELECT COUNT(DISTINCT f.usuario_id)
     FROM relatorios_aula r
     INNER JOIN turmas t ON t.id = r.turma_id AND t.congregacao_id = :cid
     INNER JOIN frequencia f ON f.relatorio_aula_id = r.id AND f.presenca = 1
     INNER JOIN vinculos_turma v ON v.usuario_id = f.usuario_id AND v.papel = \'professor\' AND v.ativo = 1
     INNER JOIN usuarios u ON u.id = f.usuario_id AND u.deleted_at IS NULL
     WHERE r.data_aula = :d'
    . $excludeInativosProfessor
);
$stmtProfPres->execute(['cid' => $congregacaoId, 'd' => $dataAula]);
$profPresentes = (int) $stmtProfPres->fetchColumn();
$profAusentes = max(0, $profMatriculados - $profPresentes);
$profPct = $profMatriculados > 0 ? (int) round((100 * $profPresentes) / $profMatriculados) : 0;

array_unshift($aproveitamento, ['label' => 'Professores', 'pct' => $profPct]);
array_unshift($ofertaPorTurma, ['label' => 'Professores', 'valor' => 0.0]);

$totalGeral = $totalPresentes + $totalVisitantes;
$presencaGeralPct = $totalMatriculados > 0
    ? (int) round((100 * $totalPresentes) / $totalMatriculados)
    : 0;

$finalizada = count($turmasDb) > 0;
if ($finalizada) {
    foreach ($turmas as $t) {
        $chamadaOk = !empty($t['chamada_feita']);
        $enviadoOk = strtolower((string) ($t['relatorio_status'] ?? '')) === 'enviado';
        if (!$chamadaOk || !$enviadoOk) {
            $finalizada = false;
            break;
        }
    }
}

$numeroLicaoGeral = null;
foreach ($turmas as $t) {
    if ($t['numero_licao'] !== null) {
        $numeroLicaoGeral = $t['numero_licao'];
        break;
    }
}

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'congregacao_id' => $congregacaoId,
    'data_aula' => $dataAula,
    'numero_licao' => $numeroLicaoGeral,
    'finalizada' => $finalizada,
    'geral' => [
        'matriculados' => $totalMatriculados,
        'presentes' => $totalPresentes,
        'ausentes' => $totalAusentes,
        'visitantes' => $totalVisitantes,
        'total' => $totalGeral,
        'presenca_pct' => $presencaGeralPct,
        'biblias' => $totalBiblias,
        'revistas' => $totalRevistas,
        'oferta' => round($totalOferta, 2),
        'aproveitamento' => $aproveitamento,
        'oferta_por_turma' => $ofertaPorTurma,
    ],
    'professores' => [
        'matriculados' => $profMatriculados,
        'presentes' => $profPresentes,
        'ausentes' => $profAusentes,
        'presenca_pct' => $profPct,
    ],
    'turmas' => $turmas,
]);
