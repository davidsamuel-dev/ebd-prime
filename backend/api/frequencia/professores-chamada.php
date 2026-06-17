<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';



$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';



try {

    $pdo = ebd_get_pdo();

} catch (Throwable $e) {

    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);

}



require_once dirname(__DIR__) . '/auth/bearer.php';

$auth = ebd_require_authenticated_user($pdo);



require_once dirname(__DIR__) . '/usuarios/_helpers.php';

$excludeInativosProfessor = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'professor');

ebd_require_lib('ebd_escala_helpers.php');



if ($method === 'GET') {

    $dataAula = trim((string) ($_GET['data_aula'] ?? ''));

    $requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;

    $congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $requestedCid);



    if ($congregacaoId <= 0) {

        ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);

    }

    if ($dataAula === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {

        ebd_json_response(['ok' => false, 'error' => 'data_aula inválida', 'code' => 'VALIDATION_ERROR'], 400);

    }



    $sql = <<<SQL

SELECT

    u.id,

    u.nome_real,

    v.turma_id,

    t.nome_turma AS turma_nome,

    e.professor_usuario_id AS escala_professor_id,

    f.presenca AS presenca_salva

FROM usuarios u

INNER JOIN vinculos_turma v

    ON v.usuario_id = u.id AND v.papel = 'professor' AND v.ativo = 1

INNER JOIN turmas t ON t.id = v.turma_id AND t.congregacao_id = :cid

LEFT JOIN escala_aulas e ON e.turma_id = v.turma_id AND e.data_aula = :data_escala

LEFT JOIN relatorios_aula r ON r.turma_id = v.turma_id AND r.data_aula = :data_rel

LEFT JOIN frequencia f ON f.relatorio_aula_id = r.id AND f.usuario_id = u.id

WHERE u.deleted_at IS NULL

  AND u.congregacao_id = :cid2

  AND LOWER(u.nivel_acesso) = 'professor'

{$excludeInativosProfessor}

ORDER BY u.nome_real ASC, t.nome_turma ASC

SQL;



    $stmt = $pdo->prepare($sql);

    $stmt->execute([

        'cid' => $congregacaoId,

        'cid2' => $congregacaoId,

        'data_rel' => $dataAula,

        'data_escala' => $dataAula,

    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $linhas = [];

    foreach ($rows as $row) {

        $tid = isset($row['turma_id']) ? (int) $row['turma_id'] : 0;

        if ($tid <= 0) {

            continue;

        }

        $uid = (int) $row['id'];

        $escalaPid = isset($row['escala_professor_id']) ? (int) $row['escala_professor_id'] : 0;

        $presencaSalva = $row['presenca_salva'];

        $hasSaved = $presencaSalva !== null && $presencaSalva !== false;

        $presenca = $hasSaved ? ((int) $presencaSalva !== 0) : ($escalaPid === $uid);



        $linhas[] = [

            'id' => $uid,

            'nome_real' => (string) $row['nome_real'],

            'turma_id' => $tid,

            'turma_nome' => (string) ($row['turma_nome'] ?? ''),

            'presenca' => $presenca,

            'ministrando' => $escalaPid === $uid,

        ];

    }



    ebd_json_response([

        'ok' => true,

        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

        'data_aula' => $dataAula,

        'linhas' => $linhas,

    ]);

}



if ($method === 'POST') {

    $body = ebd_read_json_body();

    $dataAula = trim((string) ($body['data_aula'] ?? ''));



    if ($dataAula === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {

        ebd_json_response(['ok' => false, 'error' => 'data_aula inválida', 'code' => 'VALIDATION_ERROR'], 400);

    }



    $linhas = $body['linhas'] ?? [];

    if (!is_array($linhas)) {

        ebd_json_response(['ok' => false, 'error' => 'linhas deve ser um array', 'code' => 'VALIDATION_ERROR'], 400);

    }



    $pdo->beginTransaction();

    try {

        $findRel = $pdo->prepare(

            'SELECT id FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'

        );

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

        $upsert = $pdo->prepare(

            <<<'SQL'

INSERT INTO frequencia (

    relatorio_aula_id, usuario_id, presenca, biblia, revista, pontuacao_total

) VALUES (

    :rid, :uid, :p, 0, 0, :pts

)

ON DUPLICATE KEY UPDATE

    presenca = VALUES(presenca),

    pontuacao_total = VALUES(pontuacao_total),

    updated_at = CURRENT_TIMESTAMP

SQL

        );

        $chk = $pdo->prepare(

            <<<SQL

SELECT 1

FROM vinculos_turma v

INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL

INNER JOIN turmas t ON t.id = v.turma_id

WHERE v.turma_id = :tid

  AND v.usuario_id = :uid

  AND v.papel = 'professor'

  AND v.ativo = 1

  AND u.congregacao_id = t.congregacao_id

{$excludeInativosProfessor}

LIMIT 1

SQL

        );



        $relCache = [];



        foreach ($linhas as $item) {

            if (!is_array($item)) {

                continue;

            }

            $uid = isset($item['usuario_id']) ? (int) $item['usuario_id'] : 0;

            $tid = isset($item['turma_id']) ? (int) $item['turma_id'] : 0;

            if ($uid <= 0 || $tid <= 0) {

                continue;

            }



            ebd_require_turma_in_scope($pdo, $auth, $tid);

            $chk->execute(['tid' => $tid, 'uid' => $uid]);

            if ($chk->fetchColumn() === false) {

                continue;

            }



            if (!isset($relCache[$tid])) {

                ebd_ensure_escala_aula($pdo, $tid, $dataAula);

                $findRel->execute(['tid' => $tid, 'd' => $dataAula]);

                $relId = $findRel->fetchColumn();

                if ($relId === false) {

                    $insRel->execute(['tid' => $tid, 'd' => $dataAula]);

                    $relId = $pdo->lastInsertId();

                }

                $relCache[$tid] = (int) $relId;

            }



            $pres = !empty($item['presenca']);

            $upsert->execute([

                'rid' => $relCache[$tid],

                'uid' => $uid,

                'p' => $pres ? 1 : 0,

                'pts' => $pres ? 1 : 0,

            ]);

        }



        $pdo->commit();

    } catch (Throwable $e) {

        $pdo->rollBack();

        ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar chamada de professores', 'code' => 'STORE_FAILED'], 500);

    }



    ebd_json_response([

        'ok' => true,

        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

        'message' => 'Chamada de professores guardada',

    ]);

}



ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

