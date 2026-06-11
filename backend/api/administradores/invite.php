<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$nomeReal = trim((string) ($body['nome_real'] ?? ''));
$sexo = strtoupper(trim((string) ($body['sexo'] ?? '')));
$loginUsuario = strtolower(trim((string) ($body['login_usuario'] ?? '')));
$senha = (string) ($body['senha'] ?? '');
$congregacaoId = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;

if ($nomeReal === '' || strlen($nomeReal) < 2) {
    ebd_json_response(['ok' => false, 'error' => 'Indique o nome.', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!in_array($sexo, ['M', 'F'], true)) {
    ebd_json_response(['ok' => false, 'error' => 'Sexo inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!preg_match('/^[a-z0-9]{3,40}$/', $loginUsuario)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Usuário: use 3 a 40 caracteres, só letras minúsculas e números.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

if (strlen($senha) < 6) {
    ebd_json_response(['ok' => false, 'error' => 'A senha deve ter pelo menos 6 caracteres.', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);
ebd_require_school_admin($auth);

$scopeCid = ebd_resolve_congregacao_scope($pdo, $auth, $congregacaoId);

$dupLogin = $pdo->prepare(
    'SELECT id FROM usuarios WHERE login_usuario = :l AND congregacao_id = :cid LIMIT 1'
);
$dupLogin->execute(['l' => $loginUsuario, 'cid' => $scopeCid]);
if ($dupLogin->fetch() !== false) {
    ebd_json_response(['ok' => false, 'error' => 'Este usuário já está em uso nesta igreja.', 'code' => 'DUPLICATE_ENTRY'], 409);
}

$authEmail = ebd_build_admin_invite_email($loginUsuario, $scopeCid);
$dupEmail = $pdo->prepare('SELECT id FROM usuarios WHERE email = :e LIMIT 1');
$dupEmail->execute(['e' => $authEmail]);
if ($dupEmail->fetch() !== false) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Conflito ao gerar e-mail interno. Tente outro nome de usuário.',
        'code' => 'DUPLICATE_ENTRY',
    ], 409);
}

$senhaHash = password_hash($senha, PASSWORD_DEFAULT);

$ins = $pdo->prepare(
    'INSERT INTO usuarios (
        congregacao_id, nome_real, sexo, email, login_usuario, senha,
        data_matricula, is_admin, nivel_acesso
    ) VALUES (
        :cid, :nome, :sexo, :email, :login, :senha,
        CURDATE(), 1, \'admin\'
    )'
);

try {
    $ins->execute([
        'cid' => $scopeCid,
        'nome' => $nomeReal,
        'sexo' => $sexo,
        'email' => $authEmail,
        'login' => $loginUsuario,
        'senha' => $senhaHash,
    ]);
} catch (PDOException $e) {
    if (($e->errorInfo[0] ?? '') === '23000') {
        ebd_json_response(['ok' => false, 'error' => 'Dados em conflito', 'code' => 'DUPLICATE_ENTRY'], 409);
    }
    ebd_json_response(['ok' => false, 'error' => 'Erro ao criar administrador', 'code' => 'STORE_FAILED'], 500);
}

$id = (int) $pdo->lastInsertId();

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'id' => $id,
    'nome_real' => $nomeReal,
    'login_usuario' => $loginUsuario,
    'message' => 'Administrador criado.',
]);
