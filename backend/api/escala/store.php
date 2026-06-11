<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$turmaId = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;
$dataAula = trim((string) ($body['data_aula'] ?? ''));

$professorUsuarioId = isset($body['professor_usuario_id'])
    ? (int) $body['professor_usuario_id']
    : null;
if ($professorUsuarioId !== null && $professorUsuarioId <= 0) {
    $professorUsuarioId = null;
}

$visitante = trim((string) ($body['professor_visitante_nome'] ?? ''));
$tema = trim((string) ($body['tema_licao'] ?? ''));
$numeroLicao = isset($body['numero_licao']) ? (int) $body['numero_licao'] : null;
if ($numeroLicao !== null && $numeroLicao <= 0) {
    $numeroLicao = null;
}
if ($numeroLicao !== null && $numeroLicao > 999) {
    ebd_json_response(['ok' => false, 'error' => 'numero_licao inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

if ($turmaId <= 0 || $dataAula === '') {
    ebd_json_response([
        'ok' => false,
        'error' => 'turma_id e data_aula (YYYY-MM-DD) são obrigatórios',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataAula)) {
    ebd_json_response(['ok' => false, 'error' => 'data_aula inválida', 'code' => 'VALIDATION_ERROR'], 400);
}

// Cadastro mínimo (só data + turma + número) permitido; professor/visitante opcionais.

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$turma = ebd_require_turma_in_scope($pdo, $auth, $turmaId);

if ($professorUsuarioId !== null) {
    $pu = $pdo->prepare(
        <<<'SQL'
SELECT id FROM usuarios
WHERE id = :id AND congregacao_id = :cid AND deleted_at IS NULL
LIMIT 1
SQL
    );
    $pu->execute(['id' => $professorUsuarioId, 'cid' => $turma['congregacao_id']]);

    if ($pu->fetch() === false) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Professor não encontrado nesta congregação',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }
}

$sql = <<<'SQL'
INSERT INTO escala_aulas (
    turma_id, data_aula, numero_licao, professor_usuario_id, professor_visitante_nome, tema_licao
) VALUES (
    :turma_id, :data_aula, :numero_licao, :professor_usuario_id, :professor_visitante_nome, :tema_licao
)
ON DUPLICATE KEY UPDATE
    numero_licao = VALUES(numero_licao),
    professor_usuario_id = VALUES(professor_usuario_id),
    professor_visitante_nome = VALUES(professor_visitante_nome),
    tema_licao = VALUES(tema_licao),
    updated_at = CURRENT_TIMESTAMP
SQL;

$params = [
    'turma_id' => $turmaId,
    'data_aula' => $dataAula,
    'numero_licao' => $numeroLicao,
    'professor_usuario_id' => $professorUsuarioId,
    'professor_visitante_nome' => $visitante !== '' ? $visitante : null,
    'tema_licao' => $tema !== '' ? $tema : null,
];

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
} catch (PDOException $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar escala', 'code' => 'STORE_FAILED'], 500);
}

$lookup = $pdo->prepare(
    'SELECT id FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
);
$lookup->execute(['tid' => $turmaId, 'd' => $dataAula]);
$id = (int) $lookup->fetchColumn();

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'id' => $id > 0 ? $id : null,
    'message' => 'Aula cadastrada com sucesso',
]);
