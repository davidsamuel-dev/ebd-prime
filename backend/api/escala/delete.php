<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



$body = ebd_read_json_body();



$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

$dataAula = trim((string) ($body['data_aula'] ?? ''));



if ($turmaId <= 0 || $dataAula === '') {

    ebd_json_response(['ok' => false, 'error' => 'Dados em falta', 'code' => 'VALIDATION_ERROR'], 400);

}



if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {

    ebd_json_response(['ok' => false, 'error' => 'data_aula inválida', 'code' => 'VALIDATION_ERROR'], 400);

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

$find->execute(['tid' => $turmaId, 'd' => $dataAula]);



if ($find->fetchColumn() === false) {

    ebd_json_response(['ok' => false, 'error' => 'Aula não encontrada', 'code' => 'NOT_FOUND'], 404);

}



$pdo->beginTransaction();



try {

    $pdo->prepare(

        'DELETE FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d'

    )->execute(['tid' => $turmaId, 'd' => $dataAula]);



    $pdo->prepare(

        'DELETE FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d'

    )->execute(['tid' => $turmaId, 'd' => $dataAula]);



    $pdo->commit();

} catch (Throwable $e) {

    $pdo->rollBack();

    ebd_json_response(['ok' => false, 'error' => 'Erro ao remover aula', 'code' => 'STORE_FAILED'], 500);

}



ebd_json_response([

    'ok' => true,

    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

    'message' => 'Aula e registos associados foram removidos.',

]);

