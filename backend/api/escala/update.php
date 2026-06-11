<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



$body = ebd_read_json_body();



$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

$dataAnterior = trim((string) ($body['data_aula_anterior'] ?? ''));

$dataNova = trim((string) ($body['data_aula'] ?? ''));

$numeroLicao = array_key_exists('numero_licao', $body)

    ? (int) $body['numero_licao']

    : null;



if ($turmaId <= 0 || $dataAnterior === '' || $dataNova === '') {

    ebd_json_response(['ok' => false, 'error' => 'Dados em falta', 'code' => 'VALIDATION_ERROR'], 400);

}



if (

    !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAnterior)

    || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataNova)

) {

    ebd_json_response(['ok' => false, 'error' => 'Datas inválidas', 'code' => 'VALIDATION_ERROR'], 400);

}



if ($numeroLicao !== null && ($numeroLicao <= 0 || $numeroLicao > 999)) {

    ebd_json_response(['ok' => false, 'error' => 'numero_licao inválido', 'code' => 'VALIDATION_ERROR'], 400);

}



try {

    $pdo = ebd_get_pdo();

} catch (Throwable $e) {

    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);

}



require_once dirname(__DIR__) . '/auth/bearer.php';

$auth = ebd_require_authenticated_user($pdo);



ebd_require_turma_in_scope($pdo, $auth, $turmaId);



$find = $pdo->prepare(

    'SELECT id FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d LIMIT 1'

);

$find->execute(['tid' => $turmaId, 'd' => $dataAnterior]);

$escalaId = $find->fetchColumn();



if ($escalaId === false) {

    ebd_json_response(['ok' => false, 'error' => 'Aula não encontrada', 'code' => 'NOT_FOUND'], 404);

}



if ($dataAnterior !== $dataNova) {

    $dup = $pdo->prepare(

        'SELECT id FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d LIMIT 1'

    );

    $dup->execute(['tid' => $turmaId, 'd' => $dataNova]);

    if ($dup->fetchColumn() !== false) {

        ebd_json_response([

            'ok' => false,

            'error' => 'Já existe uma aula com esta data nesta turma.',

            'code' => 'DUPLICATE_ENTRY',

        ], 409);

    }



    $dupRel = $pdo->prepare(

        'SELECT id FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'

    );

    $dupRel->execute(['tid' => $turmaId, 'd' => $dataNova]);

    if ($dupRel->fetchColumn() !== false) {

        ebd_json_response([

            'ok' => false,

            'error' => 'Já existe relatório/chamada nesta data para esta turma.',

            'code' => 'DUPLICATE_ENTRY',

        ], 409);

    }

}



$pdo->beginTransaction();



try {

    if ($dataAnterior === $dataNova) {

        if ($numeroLicao !== null) {

            $pdo->prepare(

                'UPDATE escala_aulas SET numero_licao = :n, updated_at = CURRENT_TIMESTAMP

                 WHERE id = :id'

            )->execute(['n' => $numeroLicao, 'id' => (int) $escalaId]);

        }

    } else {

        $pdo->prepare(

            'UPDATE escala_aulas SET data_aula = :novo, numero_licao = COALESCE(:n, numero_licao),

             updated_at = CURRENT_TIMESTAMP WHERE id = :id'

        )->execute([

            'novo' => $dataNova,

            'n' => $numeroLicao,

            'id' => (int) $escalaId,

        ]);



        $pdo->prepare(

            'UPDATE relatorios_aula SET data_aula = :novo, updated_at = CURRENT_TIMESTAMP

             WHERE turma_id = :tid AND data_aula = :ant'

        )->execute([

            'novo' => $dataNova,

            'tid' => $turmaId,

            'ant' => $dataAnterior,

        ]);

    }



    $pdo->commit();

} catch (Throwable $e) {

    $pdo->rollBack();

    ebd_json_response(['ok' => false, 'error' => 'Erro ao atualizar aula', 'code' => 'STORE_FAILED'], 500);

}



ebd_json_response([

    'ok' => true,

    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

    'message' => 'Aula atualizada.',

]);

