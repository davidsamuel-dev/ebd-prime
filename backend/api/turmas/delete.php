<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

if ($turmaId <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'turma_id é obrigatório', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

ebd_require_turma_in_scope($pdo, $auth, $turmaId);

$chkVinc = $pdo->prepare('SELECT 1 FROM vinculos_turma WHERE turma_id = :tid LIMIT 1');
$chkVinc->execute(['tid' => $turmaId]);
if ($chkVinc->fetchColumn() !== false) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Há alunos ou professores vinculados. Mova-os ou remova-os antes de apagar a turma.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

$chkEscala = $pdo->prepare('SELECT 1 FROM escala_aulas WHERE turma_id = :tid LIMIT 1');
$chkEscala->execute(['tid' => $turmaId]);
if ($chkEscala->fetchColumn() !== false) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Existem aulas na escala. Remova-as antes de apagar a turma.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

try {
    $stmt = $pdo->prepare('DELETE FROM turmas WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $turmaId]);
} catch (PDOException $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao remover turma', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Turma removida',
]);
