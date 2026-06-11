<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$usuarioId = isset($_GET['usuario_id']) ? (int) $_GET['usuario_id'] : 0;

if ($usuarioId <= 0) {
    ebd_json_response(['ok' => false, 'error' => 'usuario_id inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

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
    ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);
}

$usuario = ebd_fetch_usuario_in_congregacao($pdo, $usuarioId, $congregacaoId);
if ($usuario === false) {
    ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$stmt = $pdo->prepare(
    <<<'SQL'
SELECT
    u.id,
    u.nome_real,
    u.sexo,
    u.data_nascimento,
    u.telefone,
    u.email,
    u.escolaridade,
    u.estado_civil,
    u.logradouro,
    u.numero,
    u.bairro,
    u.cidade,
    u.estado,
    u.responsavel_1_nome,
    u.responsavel_1_tel,
    u.responsavel_2_nome,
    u.responsavel_2_tel,
    u.nivel_acesso,
    u.congregacao_id,
    (
        SELECT v.turma_id
        FROM vinculos_turma v
        WHERE v.usuario_id = u.id
          AND v.papel = 'aluno'
          AND v.ativo = 1
        ORDER BY v.id ASC
        LIMIT 1
    ) AS turma_id
FROM usuarios u
WHERE u.id = :id AND u.congregacao_id = :cid AND u.deleted_at IS NULL
LIMIT 1
SQL
);
$stmt->execute(['id' => $usuarioId, 'cid' => $congregacaoId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$tid = isset($row['turma_id']) ? (int) $row['turma_id'] : 0;

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'usuario' => [
        'id' => (int) $row['id'],
        'nome_real' => (string) $row['nome_real'],
        'sexo' => strtoupper((string) ($row['sexo'] ?? 'M')) === 'F' ? 'F' : 'M',
        'data_nascimento' => $row['data_nascimento'] !== null ? (string) $row['data_nascimento'] : null,
        'telefone' => $row['telefone'] !== null ? (string) $row['telefone'] : null,
        'email' => $row['email'] !== null ? (string) $row['email'] : null,
        'escolaridade' => $row['escolaridade'] !== null ? (string) $row['escolaridade'] : null,
        'estado_civil' => $row['estado_civil'] !== null ? (string) $row['estado_civil'] : null,
        'logradouro' => $row['logradouro'] !== null ? (string) $row['logradouro'] : null,
        'numero' => $row['numero'] !== null ? (string) $row['numero'] : null,
        'bairro' => $row['bairro'] !== null ? (string) $row['bairro'] : null,
        'cidade' => $row['cidade'] !== null ? (string) $row['cidade'] : null,
        'estado' => $row['estado'] !== null ? (string) $row['estado'] : null,
        'responsavel_1_nome' => $row['responsavel_1_nome'] !== null ? (string) $row['responsavel_1_nome'] : null,
        'responsavel_1_tel' => $row['responsavel_1_tel'] !== null ? (string) $row['responsavel_1_tel'] : null,
        'responsavel_2_nome' => $row['responsavel_2_nome'] !== null ? (string) $row['responsavel_2_nome'] : null,
        'responsavel_2_tel' => $row['responsavel_2_tel'] !== null ? (string) $row['responsavel_2_tel'] : null,
        'nivel_acesso' => (string) ($row['nivel_acesso'] ?? 'sem_login'),
        'congregacao_id' => (int) $row['congregacao_id'],
        'turma_id' => $tid > 0 ? $tid : null,
    ],
]);
