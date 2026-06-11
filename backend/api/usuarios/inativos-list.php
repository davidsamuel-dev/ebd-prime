<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';

require_once __DIR__ . '/_helpers.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



$q = trim((string) ($_GET['q'] ?? ''));



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

        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

        'usuarios' => [],

    ]);

}



$cadastrosInativosOr = ebd_has_cadastros_ebd_inativos_table($pdo)

    ? <<<'SQL'

    OR EXISTS (

      SELECT 1 FROM cadastros_ebd_inativos ci

      WHERE ci.usuario_id = u.id

        AND ci.papel = (CASE WHEN LOWER(u.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)

    )

SQL

    : '';



$sql = <<<SQL

SELECT

    u.id,

    u.nome_real,

    u.sexo,

    (

        SELECT v.turma_id

        FROM vinculos_turma v

        WHERE v.usuario_id = u.id

          AND v.papel = (CASE WHEN LOWER(u.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)

          AND v.ativo = 0

        ORDER BY v.id DESC

        LIMIT 1

    ) AS turma_id_hint,

    (

        SELECT t.nome_turma

        FROM vinculos_turma v

        INNER JOIN turmas t ON t.id = v.turma_id

        WHERE v.usuario_id = u.id

          AND v.papel = (CASE WHEN LOWER(u.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)

          AND v.ativo = 0

        ORDER BY v.id DESC

        LIMIT 1

    ) AS turma_label_hint

FROM usuarios u

WHERE u.deleted_at IS NULL

  AND u.congregacao_id = :cid

  AND u.is_admin = 0

  AND u.nivel_acesso NOT IN ('admin', 'secretario')

  AND (

    (

      LOWER(u.nivel_acesso) <> 'professor'

      AND EXISTS (

        SELECT 1 FROM vinculos_turma v

        WHERE v.usuario_id = u.id AND v.papel = 'aluno' AND v.ativo = 0

      )

      AND NOT EXISTS (

        SELECT 1 FROM vinculos_turma v

        WHERE v.usuario_id = u.id AND v.papel = 'aluno' AND v.ativo = 1

      )

    )

    OR (

      LOWER(u.nivel_acesso) = 'professor'

      AND EXISTS (

        SELECT 1 FROM vinculos_turma v

        WHERE v.usuario_id = u.id AND v.papel = 'professor' AND v.ativo = 0

      )

      AND NOT EXISTS (

        SELECT 1 FROM vinculos_turma v

        WHERE v.usuario_id = u.id AND v.papel = 'professor' AND v.ativo = 1

      )

    )

    {$cadastrosInativosOr}

  )

SQL;



$params = ['cid' => $congregacaoId];



if ($q !== '') {

    $sql .= ' AND u.nome_real LIKE :q';

    $params['q'] = '%' . $q . '%';

}



$sql .= ' ORDER BY u.nome_real ASC';



try {

    $stmt = $pdo->prepare($sql);

    $stmt->execute($params);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

} catch (Throwable $e) {

    ebd_json_response([

        'ok' => false,

        'error' => 'Erro ao listar cadastros inativos.',

        'code' => 'DB_UNAVAILABLE',

    ], 503);

}



$usuarios = [];

foreach ($rows as $row) {

    $hint = isset($row['turma_id_hint']) ? (int) $row['turma_id_hint'] : 0;

    $usuarios[] = [

        'id' => (int) $row['id'],

        'nome_real' => (string) $row['nome_real'],

        'sexo' => ($row['sexo'] ?? 'M') === 'F' ? 'F' : 'M',

        'turma_id_hint' => $hint > 0 ? $hint : null,

        'turma_label_hint' => $hint > 0 ? (string) ($row['turma_label_hint'] ?? '') : null,

    ];

}



ebd_json_response([

    'ok' => true,

    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

    'usuarios' => $usuarios,

]);

