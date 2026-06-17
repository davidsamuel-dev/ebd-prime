<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;
$dataAula = trim((string) ($body['data_aula'] ?? ''));

if ($turmaId <= 0 || $dataAula === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'turma_id e data_aula (YYYY-MM-DD) são obrigatórios',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

$linhas = $body['linhas'] ?? [];
if (!is_array($linhas)) {
    ebd_json_response(['ok' => false, 'error' => 'linhas deve ser um array', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$turma = ebd_require_turma_in_scope($pdo, $auth, $turmaId);

require_once dirname(__DIR__) . '/usuarios/_helpers.php';
$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');

ebd_require_lib('ebd_escala_helpers.php');

$relatorioId = 0;

$pdo->beginTransaction();

try {
    ebd_ensure_escala_aula($pdo, $turmaId, $dataAula);

    $findRel = $pdo->prepare(
        'SELECT id FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
    );
    $findRel->execute(['tid' => $turmaId, 'd' => $dataAula]);
    $relId = $findRel->fetchColumn();

    if ($relId === false) {
        $insRel = $pdo->prepare(
            <<<'SQL'
INSERT INTO relatorios_aula (
    turma_id, professor_usuario_id, data_aula, tema_licao,
    total_biblias, total_revistas, total_visitantes, valor_oferta, observacoes, status
) VALUES (
    :tid, NULL, :d, NULL,
    0, 0, 0, 0.00, NULL, 'rascunho'
)
SQL
        );
        $insRel->execute(['tid' => $turmaId, 'd' => $dataAula]);
        $relatorioId = (int) $pdo->lastInsertId();
    } else {
        $relatorioId = (int) $relId;
    }

    $upsert = $pdo->prepare(
        <<<'SQL'
INSERT INTO frequencia (
    relatorio_aula_id, usuario_id, presenca, biblia, revista, pontuacao_total
) VALUES (
    :rid, :uid, :p, :b, :r, :pts
)
ON DUPLICATE KEY UPDATE
    presenca = VALUES(presenca),
    biblia = VALUES(biblia),
    revista = VALUES(revista),
    pontuacao_total = VALUES(pontuacao_total),
    updated_at = CURRENT_TIMESTAMP
SQL
    );

    foreach ($linhas as $item) {
        if (!is_array($item)) {
            continue;
        }

        $uid = isset($item['usuario_id']) ? (int) $item['usuario_id'] : 0;
        if ($uid <= 0) {
            continue;
        }

        $chk = $pdo->prepare(
            <<<SQL
SELECT 1
FROM vinculos_turma v
INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL
WHERE v.turma_id = :tid
  AND v.usuario_id = :uid
  AND v.papel = 'aluno'
  AND v.ativo = 1
  AND u.congregacao_id = :cid
{$excludeInativosAluno}
LIMIT 1
SQL
        );
        $chk->execute([
            'tid' => $turmaId,
            'uid' => $uid,
            'cid' => $turma['congregacao_id'],
        ]);

        if ($chk->fetchColumn() === false) {
            continue;
        }

        $pres = !empty($item['presenca']);
        $bib = !empty($item['biblia']);
        $rev = !empty($item['revista']);
        $pts = isset($item['pontuacao_total']) ? (int) $item['pontuacao_total'] : (($pres ? 1 : 0) + ($bib ? 1 : 0) + ($rev ? 1 : 0));

        $upsert->execute([
            'rid' => $relatorioId,
            'uid' => $uid,
            'p' => $pres ? 1 : 0,
            'b' => $bib ? 1 : 0,
            'r' => $rev ? 1 : 0,
            'pts' => $pts,
        ]);
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar frequência', 'code' => 'STORE_FAILED'], 500);
} catch (Throwable $e) {
    $pdo->rollBack();
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar frequência', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'relatorio_id' => $relatorioId,
    'message' => 'Frequência guardada',
]);
