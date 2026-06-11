<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/auth/bearer.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$preToken = trim((string) ($body['pre_token'] ?? ''));
$nomeReal = trim((string) ($body['nome_real'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$sexo = strtoupper(trim((string) ($body['sexo'] ?? '')));
$loginUsuario = strtolower(trim((string) ($body['login_usuario'] ?? $body['usuario'] ?? '')));
$senha = (string) ($body['senha'] ?? $body['password'] ?? '');
$congregacaoNome = trim((string) ($body['congregacao_nome'] ?? $body['nome_instituicao'] ?? ''));
$logradouro = trim((string) ($body['logradouro'] ?? ''));
$numero = trim((string) ($body['numero'] ?? ''));
$bairro = trim((string) ($body['bairro'] ?? ''));
$cidade = trim((string) ($body['cidade'] ?? ''));
$estado = strtoupper(trim((string) ($body['estado'] ?? '')));

if (
    $preToken === '' || strlen($preToken) !== 64
    || $nomeReal === '' || !in_array($sexo, ['M', 'F'], true)
    || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)
    || $loginUsuario === '' || !preg_match('/^[a-z0-9]{3,40}$/', $loginUsuario)
    || strlen($senha) < 6
    || $congregacaoNome === '' || $logradouro === '' || $cidade === '' || strlen($estado) !== 2
) {
    ebd_json_response(['ok' => false, 'error' => 'Dados obrigatórios inválidos ou incompletos', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$sqlPre = <<<'SQL'
SELECT id, phone_e164, verified_at, pre_token_expires_at
FROM onboarding_verifications
WHERE pre_token = :t
LIMIT 1
SQL;

$stmt = $pdo->prepare($sqlPre);
$stmt->execute(['t' => $preToken]);
$preRow = $stmt->fetch(PDO::FETCH_ASSOC);

if ($preRow === false || empty($preRow['verified_at'])) {
    ebd_json_response(['ok' => false, 'error' => 'Sessão de cadastro inválida ou telefone não verificado', 'code' => 'AUTH_INVALID'], 401);
}

if (strtotime((string) $preRow['pre_token_expires_at']) < time()) {
    ebd_json_response(['ok' => false, 'error' => 'Sessão expirada. Refaça a verificação do telefone.', 'code' => 'AUTH_INVALID'], 401);
}

$phone = (string) $preRow['phone_e164'];
$preId = (int) $preRow['id'];

$chkLogin = $pdo->prepare('SELECT id FROM usuarios WHERE login_usuario = :u LIMIT 1');
$chkLogin->execute(['u' => $loginUsuario]);
if ($chkLogin->fetch() !== false) {
    ebd_json_response(['ok' => false, 'error' => 'Este nome de usuário já está em uso', 'code' => 'DUPLICATE_ENTRY'], 409);
}

$chkEmail = $pdo->prepare('SELECT id FROM usuarios WHERE email = :e AND deleted_at IS NULL LIMIT 1');
$chkEmail->execute(['e' => $email]);
if ($chkEmail->fetch() !== false) {
    ebd_json_response(['ok' => false, 'error' => 'Este e-mail já está registado', 'code' => 'DUPLICATE_ENTRY'], 409);
}

$senhaHash = password_hash($senha, PASSWORD_DEFAULT);
$dataMatricula = date('Y-m-d');

$pdo->beginTransaction();

try {
    $insCong = $pdo->prepare(
        'INSERT INTO congregacoes (nome, cidade, logradouro, numero, bairro, estado, status)
         VALUES (:nome, :cidade, :log, :num, :bairro, :uf, \'ativo\')'
    );
    $insCong->execute([
        'nome' => $congregacaoNome,
        'cidade' => $cidade,
        'log' => $logradouro,
        'num' => $numero !== '' ? $numero : null,
        'bairro' => $bairro !== '' ? $bairro : null,
        'uf' => $estado,
    ]);
    $congregacaoId = (int) $pdo->lastInsertId();

    $insUser = $pdo->prepare(
        'INSERT INTO usuarios (
            congregacao_id, nome_real, sexo, telefone, email, login_usuario, senha,
            data_matricula, is_admin, nivel_acesso
        ) VALUES (
            :cid, :nome, :sexo, :tel, :email, :login, :senha,
            :dm, 1, \'admin\'
        )'
    );
    $insUser->execute([
        'cid' => $congregacaoId,
        'nome' => $nomeReal,
        'sexo' => $sexo,
        'tel' => $phone,
        'email' => $email,
        'login' => $loginUsuario,
        'senha' => $senhaHash,
        'dm' => $dataMatricula,
    ]);
    $userId = (int) $pdo->lastInsertId();

    $pdo->prepare('DELETE FROM onboarding_verifications WHERE id = :id')->execute(['id' => $preId]);

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    $sqlState = $e->errorInfo[0] ?? '';
    if ($sqlState === '23000') {
        ebd_json_response(['ok' => false, 'error' => 'E-mail ou usuário já registado', 'code' => 'DUPLICATE_ENTRY'], 409);
    }
    ebd_json_response(['ok' => false, 'error' => 'Erro ao criar cadastro', 'code' => 'STORE_FAILED'], 500);
} catch (Throwable $e) {
    $pdo->rollBack();
    ebd_json_response(['ok' => false, 'error' => 'Erro ao criar cadastro', 'code' => 'STORE_FAILED'], 500);
}

$userRow = [
    'id' => $userId,
    'nome_real' => $nomeReal,
    'email' => $email,
    'nivel_acesso' => 'admin',
];
$userRow['congregacao_id'] = $congregacaoId;
ebd_attach_igreja_to_user_row($pdo, $userRow);

$tokenPayload = null;

try {
    $tokenPayload = ebd_issue_api_token($pdo, $userId);
} catch (Throwable $e) {
}

$payload = [
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'user' => $userRow,
];

if ($tokenPayload !== null) {
    $payload['token'] = $tokenPayload['token'];
    $payload['expires_at'] = $tokenPayload['expires_at'];
}

ebd_json_response($payload);
