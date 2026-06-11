<?php



declare(strict_types=1);



require_once dirname(__DIR__) . '/bootstrap.php';

require_once __DIR__ . '/_helpers.php';



if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {

    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);

}



$body = ebd_read_json_body();



$usuarioId = isset($body['usuario_id']) ? (int) $body['usuario_id'] : 0;

$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

$nomeReal = trim((string) ($body['nome_real'] ?? ''));

$congregacaoId = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;



if ($usuarioId <= 0 || $turmaId <= 0) {

    ebd_json_response(['ok' => false, 'error' => 'Dados em falta', 'code' => 'VALIDATION_ERROR'], 400);

}



try {

    $pdo = ebd_get_pdo();

} catch (Throwable $e) {

    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);

}



require_once dirname(__DIR__) . '/auth/bearer.php';

$auth = ebd_require_authenticated_user($pdo);



$scopeCid = ebd_resolve_congregacao_scope($pdo, $auth, $congregacaoId);

if ($scopeCid <= 0) {

    ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);

}



ebd_ativar_cadastro_ebd($pdo, $auth, $usuarioId, $scopeCid, $turmaId, $nomeReal);



ebd_json_response([

    'ok' => true,

    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],

    'id' => $usuarioId,

    'message' => 'Cadastro reativado nas chamadas.',

]);

