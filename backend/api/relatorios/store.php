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

$tema = trim((string) ($body['tema_licao'] ?? ''));
$totalBiblias = isset($body['total_biblias']) ? max(0, (int) $body['total_biblias']) : 0;
$totalRevistas = isset($body['total_revistas']) ? max(0, (int) $body['total_revistas']) : 0;
$totalVisitantes = isset($body['total_visitantes']) ? max(0, (int) $body['total_visitantes']) : 0;
$valorOferta = isset($body['valor_oferta']) ? (float) $body['valor_oferta'] : 0.0;
if ($valorOferta < 0) {
    $valorOferta = 0.0;
}
$observacoes = trim((string) ($body['observacoes'] ?? ''));
$status = trim((string) ($body['status'] ?? 'rascunho'));

if (!in_array($status, ['rascunho', 'enviado'], true)) {
    $status = 'rascunho';
}

$professorUsuarioId = isset($body['professor_usuario_id'])
    ? (int) $body['professor_usuario_id']
    : null;
if ($professorUsuarioId !== null && $professorUsuarioId <= 0) {
    $professorUsuarioId = null;
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$turma = ebd_require_turma_in_scope($pdo, $auth, $turmaId);

if ($professorUsuarioId === null) {
    $professorUsuarioId = (int) $auth['id'];
}

$chk = $pdo->prepare(
    'SELECT id FROM usuarios WHERE id = :id AND congregacao_id = :cid AND deleted_at IS NULL LIMIT 1'
);
$chk->execute(['id' => $professorUsuarioId, 'cid' => $turma['congregacao_id']]);

if ($chk->fetch() === false) {
    $professorUsuarioId = null;
}

$sql = <<<'SQL'
INSERT INTO relatorios_aula (
    turma_id, professor_usuario_id, data_aula, tema_licao,
    total_biblias, total_revistas, total_visitantes, valor_oferta, observacoes, status
) VALUES (
    :turma_id, :professor_usuario_id, :data_aula, :tema_licao,
    :total_biblias, :total_revistas, :total_visitantes, :valor_oferta, :observacoes, :status
)
ON DUPLICATE KEY UPDATE
    tema_licao = VALUES(tema_licao),
    total_biblias = VALUES(total_biblias),
    total_revistas = VALUES(total_revistas),
    total_visitantes = VALUES(total_visitantes),
    valor_oferta = VALUES(valor_oferta),
    observacoes = VALUES(observacoes),
    status = VALUES(status),
    professor_usuario_id = COALESCE(VALUES(professor_usuario_id), professor_usuario_id),
    updated_at = CURRENT_TIMESTAMP
SQL;

$params = [
    'turma_id' => $turmaId,
    'professor_usuario_id' => $professorUsuarioId,
    'data_aula' => $dataAula,
    'tema_licao' => $tema !== '' ? $tema : null,
    'total_biblias' => $totalBiblias,
    'total_revistas' => $totalRevistas,
    'total_visitantes' => $totalVisitantes,
    'valor_oferta' => $valorOferta,
    'observacoes' => $observacoes !== '' ? $observacoes : null,
    'status' => $status,
];

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
} catch (PDOException $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar relatório', 'code' => 'STORE_FAILED'], 500);
}

$lookup = $pdo->prepare(
    'SELECT id FROM relatorios_aula WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
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
    'message' => 'Relatório guardado',
]);
