<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/bearer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$usuario = trim((string) ($body['usuario'] ?? $body['email'] ?? ''));
$senha = (string) ($body['senha'] ?? $body['password'] ?? '');

if ($usuario === '' || $senha === '') {
    ebd_json_response(['ok' => false, 'error' => 'Indique utilizador e senha', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
    $sql = <<<'SQL'
SELECT u.id, u.nome_real, u.email, u.login_usuario, u.senha, u.nivel_acesso, u.congregacao_id, u.deleted_at,
       c.nome AS congregacao_nome,
       c.bairro AS congregacao_bairro,
       c.subtitulo AS congregacao_subtitulo
FROM usuarios u
LEFT JOIN congregacoes c ON c.id = u.congregacao_id
WHERE (u.email = :u OR u.login_usuario = :u2)
LIMIT 1
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['u' => $usuario, 'u2' => $usuario]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

if ($row === false || !empty($row['deleted_at'])) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador ou senha inválidos', 'code' => 'AUTH_INVALID'], 401);
}

$hash = $row['senha'] ?? '';
if ($hash === '' || !password_verify($senha, $hash)) {
    ebd_json_response(['ok' => false, 'error' => 'Utilizador ou senha inválidos', 'code' => 'AUTH_INVALID'], 401);
}

unset($row['senha']);

$row['id'] = (int) $row['id'];
$row['congregacao_id'] = isset($row['congregacao_id']) ? (int) $row['congregacao_id'] : null;
ebd_attach_igreja_to_user_row($pdo, $row);

$tokenPayload = null;

try {
    $tokenPayload = ebd_issue_api_token($pdo, $row['id']);
} catch (Throwable $e) {
    // Tabela `api_tokens` em falta ou erro DB — login continua sem token (aplique database_migration_003).
}

$payload = [
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'user' => $row,
];

if ($tokenPayload !== null) {
    $payload['token'] = $tokenPayload['token'];
    $payload['expires_at'] = $tokenPayload['expires_at'];
}

ebd_json_response($payload);
