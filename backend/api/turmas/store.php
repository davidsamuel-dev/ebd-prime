<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$nomeTurma = trim((string) ($body['nome_turma'] ?? ''));
if ($nomeTurma === '') {
    ebd_json_response(['ok' => false, 'error' => 'nome_turma é obrigatório', 'code' => 'VALIDATION_ERROR'], 400);
}

$congregacaoId = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;
$departamentoId = isset($body['departamento_id']) ? (int) $body['departamento_id'] : null;
if ($departamentoId !== null && $departamentoId <= 0) {
    $departamentoId = null;
}
$departamentoNome = trim((string) ($body['departamento_nome'] ?? ''));
$turmaIdUpdate = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

$congregacaoId = ebd_resolve_congregacao_scope($pdo, $auth, $congregacaoId);

$resolvedDepartamentoId = null;

if ($departamentoId !== null && $departamentoId > 0) {
    $chk = $pdo->prepare('SELECT id FROM departamentos WHERE id = :id AND congregacao_id = :cid LIMIT 1');
    $chk->execute(['id' => $departamentoId, 'cid' => $congregacaoId]);
    if ($chk->fetch() === false) {
        ebd_json_response(['ok' => false, 'error' => 'Departamento inválido para esta congregação', 'code' => 'VALIDATION_ERROR'], 400);
    }
    $resolvedDepartamentoId = $departamentoId;
} elseif ($departamentoNome !== '') {
    $find = $pdo->prepare('SELECT id FROM departamentos WHERE congregacao_id = :cid AND nome = :nome LIMIT 1');
    $find->execute(['cid' => $congregacaoId, 'nome' => $departamentoNome]);
    $found = $find->fetch(PDO::FETCH_ASSOC);
    if ($found !== false) {
        $resolvedDepartamentoId = (int) $found['id'];
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO departamentos (congregacao_id, nome, ordem) VALUES (:cid, :nome, 0)',
        );
        $ins->execute(['cid' => $congregacaoId, 'nome' => $departamentoNome]);
        $resolvedDepartamentoId = (int) $pdo->lastInsertId();
    }
}

if ($turmaIdUpdate > 0) {
    ebd_require_turma_in_scope($pdo, $auth, $turmaIdUpdate);

    try {
        $stmt = $pdo->prepare(
            <<<'SQL'
UPDATE turmas
SET nome_turma = :nome_turma,
    departamento_id = :departamento_id,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
SQL
        );
        $stmt->execute([
            'nome_turma' => $nomeTurma,
            'departamento_id' => $resolvedDepartamentoId,
            'id' => $turmaIdUpdate,
        ]);
    } catch (PDOException $e) {
        ebd_json_response(['ok' => false, 'error' => 'Erro ao atualizar turma', 'code' => 'STORE_FAILED'], 500);
    }

    ebd_json_response([
        'ok' => true,
        'meta' => [
            'service' => EbdApiMeta::SERVICE,
            'version' => EbdApiMeta::VERSION,
        ],
        'id' => $turmaIdUpdate,
        'message' => 'Turma atualizada',
    ]);
}

$sql = <<<'SQL'
INSERT INTO turmas (congregacao_id, departamento_id, nome_turma)
VALUES (:congregacao_id, :departamento_id, :nome_turma)
SQL;

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'congregacao_id' => $congregacaoId,
        'departamento_id' => $resolvedDepartamentoId,
        'nome_turma' => $nomeTurma,
    ]);
} catch (PDOException $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao criar turma', 'code' => 'STORE_FAILED'], 500);
}

$id = (int) $pdo->lastInsertId();

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'id' => $id,
    'message' => 'Turma criada',
]);
