<?php



declare(strict_types=1);



/**

 * Alunos que não compareceram em nenhuma das 3 últimas aulas da turma (com chamada feita).

 * GET ?congregacao_id= (opcional; escopo da sessão)

 */

require_once dirname(__DIR__) . '/bootstrap.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



try {

    $pdo = ebd_get_pdo();

} catch (Throwable $e) {

    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);

}



require_once dirname(__DIR__) . '/auth/bearer.php';

$auth = ebd_require_authenticated_user($pdo);



require_once __DIR__ . '/_helpers.php';

$excludeInativosAluno = ebd_sql_exclude_cadastro_inativo_papel_if_table($pdo, 'u', 'aluno');



$requestedCid = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;

$congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $requestedCid);



if ($congregacaoId <= 0) {

    ebd_json_response([

        'ok' => true,

        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

        'tem_dados_suficientes' => false,

        'aulas_consideradas' => 3,

        'usuarios' => [],

    ]);

}



/** Subquery: aula com chamada de alunos registada. */

$chamadaAlunosSql = <<<'SQL'

(

    SELECT COUNT(*)

    FROM frequencia f_ca

    INNER JOIN vinculos_turma v_ca

        ON v_ca.usuario_id = f_ca.usuario_id

       AND v_ca.turma_id = r_ca.turma_id

       AND v_ca.papel = 'aluno'

       AND v_ca.ativo = 1

    WHERE f_ca.relatorio_aula_id = r_ca.id

) > 0

SQL;



$sql = <<<SQL

SELECT

    u.id,

    u.nome_real,

    v.turma_id,

    t.nome_turma

FROM vinculos_turma v

INNER JOIN usuarios u ON u.id = v.usuario_id AND u.deleted_at IS NULL

INNER JOIN turmas t ON t.id = v.turma_id AND t.congregacao_id = :cid

WHERE v.papel = 'aluno'

  AND v.ativo = 1

{$excludeInativosAluno}

  AND (

      SELECT COUNT(DISTINCT e.data_aula)

      FROM escala_aulas e

      INNER JOIN relatorios_aula r_ca

          ON r_ca.turma_id = e.turma_id AND r_ca.data_aula = e.data_aula

      WHERE e.turma_id = v.turma_id

        AND {$chamadaAlunosSql}

  ) >= 3

  AND (

      SELECT COUNT(DISTINCT e.data_aula)

      FROM escala_aulas e

      INNER JOIN relatorios_aula r_pr

          ON r_pr.turma_id = e.turma_id AND r_pr.data_aula = e.data_aula

      INNER JOIN frequencia f

          ON f.relatorio_aula_id = r_pr.id

         AND f.usuario_id = u.id

         AND f.presenca = 1

      WHERE e.turma_id = v.turma_id

        AND (

            SELECT COUNT(*)

            FROM frequencia f_ca2

            INNER JOIN vinculos_turma v_ca2

                ON v_ca2.usuario_id = f_ca2.usuario_id

               AND v_ca2.turma_id = r_pr.turma_id

               AND v_ca2.papel = 'aluno'

               AND v_ca2.ativo = 1

            WHERE f_ca2.relatorio_aula_id = r_pr.id

        ) > 0

        AND e.data_aula IN (

            SELECT data_aula FROM (

                SELECT e2.data_aula

                FROM escala_aulas e2

                INNER JOIN relatorios_aula r2

                    ON r2.turma_id = e2.turma_id AND r2.data_aula = e2.data_aula

                WHERE e2.turma_id = v.turma_id

                  AND (

                      SELECT COUNT(*)

                      FROM frequencia f_ca3

                      INNER JOIN vinculos_turma v_ca3

                          ON v_ca3.usuario_id = f_ca3.usuario_id

                         AND v_ca3.turma_id = r2.turma_id

                         AND v_ca3.papel = 'aluno'

                         AND v_ca3.ativo = 1

                      WHERE f_ca3.relatorio_aula_id = r2.id

                  ) > 0

                ORDER BY e2.data_aula DESC

                LIMIT 3

            ) ultimas

        )

  ) = 0

ORDER BY u.nome_real ASC

SQL;



$stmt = $pdo->prepare($sql);

$stmt->execute(['cid' => $congregacaoId]);

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);



foreach ($rows as &$row) {

    $row['id'] = (int) $row['id'];

    $row['turma_id'] = (int) $row['turma_id'];

}



unset($row);



$chkSql = <<<SQL

SELECT e.turma_id

FROM escala_aulas e

INNER JOIN turmas t ON t.id = e.turma_id

INNER JOIN relatorios_aula r_ca

    ON r_ca.turma_id = e.turma_id AND r_ca.data_aula = e.data_aula

WHERE t.congregacao_id = :cid

  AND {$chamadaAlunosSql}

GROUP BY e.turma_id

HAVING COUNT(DISTINCT e.data_aula) >= 3

LIMIT 1

SQL;

$chk = $pdo->prepare($chkSql);

$chk->execute(['cid' => $congregacaoId]);

$temDados = $chk->fetch() !== false;



ebd_json_response([

    'ok' => true,

    'meta' => [

        'service' => EbdApiMeta::SERVICE,

        'version' => EbdApiMeta::VERSION,

    ],

    'congregacao_id' => $congregacaoId,

    'tem_dados_suficientes' => $temDados,

    'aulas_consideradas' => 3,

    'usuarios' => $rows,

]);

