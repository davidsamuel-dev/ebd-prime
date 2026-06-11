<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

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

$stmt = $pdo->prepare(
    <<<'SQL'
SELECT id, nome_real, congregacao_id
FROM usuarios
WHERE id = :id AND deleted_at IS NULL
LIMIT 1
SQL
);
$stmt->execute(['id' => $usuarioId]);
$usuario = $stmt->fetch();

if ($usuario === false) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador não encontrado', 'code' => 'NOT_FOUND'], 404);
}

$usuario['id'] = (int) $usuario['id'];
$usuario['congregacao_id'] = isset($usuario['congregacao_id']) ? (int) $usuario['congregacao_id'] : null;

ebd_assert_usuario_same_congregacao($auth, $usuario['congregacao_id']);

$turmaStmt = $pdo->prepare(
    <<<'SQL'
SELECT t.nome_turma
FROM vinculos_turma v
INNER JOIN turmas t ON t.id = v.turma_id
WHERE v.usuario_id = :uid
  AND v.papel = 'aluno'
  AND v.ativo = 1
ORDER BY v.id ASC
LIMIT 1
SQL
);
$turmaStmt->execute(['uid' => $usuarioId]);
$turmaLabel = $turmaStmt->fetchColumn();
$turmaLabel = $turmaLabel !== false ? (string) $turmaLabel : null;

$sqlAgg = <<<'SQL'
SELECT
    COALESCE(SUM(CASE WHEN f.presenca = 1 THEN 1 ELSE 0 END), 0) AS presencas,
    COALESCE(SUM(CASE WHEN f.presenca = 0 THEN 1 ELSE 0 END), 0) AS ausencias,
    COALESCE(COUNT(*), 0) AS registos,
    COALESCE(SUM(f.pontuacao_total), 0) AS pontos
FROM frequencia f
WHERE f.usuario_id = :uid
SQL;

$aggStmt = $pdo->prepare($sqlAgg);
$aggStmt->execute(['uid' => $usuarioId]);
$row = $aggStmt->fetch();

$presencas = (int) ($row['presencas'] ?? 0);
$ausencias = (int) ($row['ausencias'] ?? 0);
$registos = (int) ($row['registos'] ?? 0);
$pontos = (int) ($row['pontos'] ?? 0);

$aproveitamentoPct = 0;
if ($registos > 0) {
    $aproveitamentoPct = (int) round(($presencas / $registos) * 100);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'usuario' => [
        'id' => $usuario['id'],
        'nome_real' => $usuario['nome_real'],
        'turma_label' => $turmaLabel,
    ],
    'stats' => [
        'presencas' => $presencas,
        'ausencias' => $ausencias,
        'registos' => $registos,
        'pontos' => $pontos,
        'aproveitamento_pct' => $aproveitamentoPct,
    ],
]);
