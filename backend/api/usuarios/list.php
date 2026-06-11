<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';

require_once __DIR__ . '/_helpers.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



$q = trim((string) ($_GET['q'] ?? ''));

$limit = isset($_GET['limit']) ? min(1000, max(1, (int) $_GET['limit'])) : 100;



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

    ebd_json_response([

        'ok' => true,

        'meta' => [

            'service' => EbdApiMeta::SERVICE,

            'version' => EbdApiMeta::VERSION,

        ],

        'usuarios' => [],

    ]);

}



$excludeInativos = ebd_has_cadastros_ebd_inativos_table($pdo)

    ? ebd_sql_exclude_cadastros_ebd_inativos('u')

    : '';



$sql = <<<SQL

SELECT

    u.id,

    u.nome_real,

    u.sexo,

    u.email,

    u.nivel_acesso,

    u.congregacao_id,

    (

        SELECT v.turma_id

        FROM vinculos_turma v

        WHERE v.usuario_id = u.id

          AND v.ativo = 1

          AND v.papel = (CASE WHEN u.nivel_acesso = 'professor' THEN 'professor' ELSE 'aluno' END)

        ORDER BY v.id ASC

        LIMIT 1

    ) AS turma_id,

    (

        SELECT t.nome_turma

        FROM vinculos_turma v

        INNER JOIN turmas t ON t.id = v.turma_id

        WHERE v.usuario_id = u.id

          AND v.ativo = 1

          AND v.papel = (CASE WHEN u.nivel_acesso = 'professor' THEN 'professor' ELSE 'aluno' END)

        ORDER BY v.id ASC

        LIMIT 1

    ) AS turma_label

FROM usuarios u

WHERE u.deleted_at IS NULL

  AND u.nivel_acesso <> 'admin'

  AND u.is_admin = 0

{$excludeInativos}

SQL;

$sql .= ebd_sql_exclude_somente_vinculos_inativos('u');

$sql .= <<<'SQL'



  AND (

    (

      LOWER(u.nivel_acesso) = 'professor'

      AND (

        EXISTS (

          SELECT 1 FROM vinculos_turma v

          WHERE v.usuario_id = u.id AND v.papel = 'professor' AND v.ativo = 1

        )

        OR NOT EXISTS (

          SELECT 1 FROM vinculos_turma v

          WHERE v.usuario_id = u.id AND v.papel = 'professor'

        )

      )

    )

    OR (

      LOWER(u.nivel_acesso) <> 'professor'

      AND (

        EXISTS (

          SELECT 1 FROM vinculos_turma v

          WHERE v.usuario_id = u.id AND v.papel = 'aluno' AND v.ativo = 1

        )

        OR NOT EXISTS (

          SELECT 1 FROM vinculos_turma v

          WHERE v.usuario_id = u.id AND v.papel = 'aluno'

        )

      )

    )

  )

SQL;



$params = [];



if ($congregacaoId > 0) {

    $sql .= ' AND u.congregacao_id = :cid';

    $params['cid'] = $congregacaoId;

}



if ($q !== '') {

    $sql .= ' AND u.nome_real LIKE :q';

    $params['q'] = '%' . $q . '%';

}



$sql .= ' ORDER BY u.nome_real ASC LIMIT ' . (int) $limit;



try {

    $stmt = $pdo->prepare($sql);

    $stmt->execute($params);

    $rows = $stmt->fetchAll();

} catch (Throwable $e) {

    ebd_json_response([

        'ok' => false,

        'error' => 'Erro ao listar cadastros.',

        'code' => 'DB_UNAVAILABLE',

    ], 503);

}



foreach ($rows as &$row) {

    $row['id'] = (int) $row['id'];

    $row['congregacao_id'] = isset($row['congregacao_id']) ? (int) $row['congregacao_id'] : null;

    $tid = isset($row['turma_id']) ? (int) $row['turma_id'] : 0;

    $row['turma_id'] = $tid > 0 ? $tid : null;

}



unset($row);



ebd_json_response([

    'ok' => true,

    'meta' => [

        'service' => EbdApiMeta::SERVICE,

        'version' => EbdApiMeta::VERSION,

    ],

    'usuarios' => $rows,

]);

