<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
ebd_require_lib('ebd_password_recovery.php');
ebd_require_lib('ebd_smtp_config.php');
ebd_require_lib('ebd_mailer.php');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$usuario = trim((string) ($body['usuario'] ?? ''));
$emailConfirm = trim(strtolower((string) ($body['email'] ?? '')));

if ($usuario === '' || $emailConfirm === '') {
    ebd_json_response(['ok' => false, 'error' => 'Indique utilizador e e-mail', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!filter_var($emailConfirm, FILTER_VALIDATE_EMAIL)) {
    ebd_json_response(['ok' => false, 'error' => 'E-mail inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$sql = <<<'SQL'
SELECT id, email, login_usuario, congregacao_id
FROM usuarios
WHERE (email = :u OR login_usuario = :u2)
  AND deleted_at IS NULL
LIMIT 1
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['u' => $usuario, 'u2' => $usuario]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row === false) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Não encontrámos conta com este utilizador.',
        'code' => 'NOT_FOUND',
    ], 404);
}

$dbEmail = strtolower(trim((string) ($row['email'] ?? '')));
if ($dbEmail === '') {
    ebd_json_response([
        'ok' => false,
        'error' => 'Esta conta não tem e-mail definido.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

if ($dbEmail !== $emailConfirm) {
    ebd_json_response([
        'ok' => false,
        'error' => 'O e-mail não coincide com o registado na conta.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

$usuarioId = (int) $row['id'];
$congregacaoIdUsuario = isset($row['congregacao_id']) ? (int) $row['congregacao_id'] : 0;

$smtpCfg = ebd_load_smtp_config($pdo, $congregacaoIdUsuario > 0 ? $congregacaoIdUsuario : null);
$baseLink = is_array($smtpCfg)
    ? trim((string) ($smtpCfg['password_reset_link_base'] ?? ''))
    : '';
if ($baseLink === '') {
    $baseLink = trim(ebd_env_string('EBD_PASSWORD_RESET_LINK_BASE'));
}
if ($baseLink === '') {
    ebd_json_response([
        'ok' => false,
        'error' => 'Recuperação de senha indisponível no momento. Contacte o administrador da escola.',
        'code' => 'STORE_FAILED',
    ], 503);
}

$scopeCid = $congregacaoIdUsuario > 0 ? $congregacaoIdUsuario : null;
if (!ebd_smtp_configured($pdo, $scopeCid)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Recuperação de senha indisponível no momento. Contacte o administrador da escola.',
        'code' => 'STORE_FAILED',
    ], 503);
}
$pdo->prepare(
    'DELETE FROM recuperacao_senhas WHERE usuario_id = :uid AND used_at IS NULL'
)->execute(['uid' => $usuarioId]);

$plainToken = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $plainToken);
$expiresAt = (new DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s');

try {
    $ins = $pdo->prepare(
        'INSERT INTO recuperacao_senhas (usuario_id, token_hash, expires_at) VALUES (:uid, :h, :e)'
    );
    $ins->execute([
        'uid' => $usuarioId,
        'h' => $tokenHash,
        'e' => $expiresAt,
    ]);
} catch (Throwable $e) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Não foi possível gerar o pedido de recuperação.',
        'code' => 'STORE_FAILED',
    ], 500);
}

$sep = str_contains($baseLink, '?') ? '&' : '?';
$resetLink = $baseLink . $sep . 'token=' . rawurlencode($plainToken);

try {
    ebd_send_password_reset_email(
        $dbEmail,
        $resetLink,
        $congregacaoIdUsuario > 0 ? $congregacaoIdUsuario : null,
    );
} catch (Throwable $e) {
    $pdo->prepare('DELETE FROM recuperacao_senhas WHERE token_hash = :h')->execute(['h' => $tokenHash]);
    $msg = $e->getMessage();
    ebd_json_response([
        'ok' => false,
        'error' => 'Não foi possível enviar o e-mail: ' . $msg,
        'code' => 'STORE_FAILED',
    ], 503);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Link de recuperação enviado.',
    'email_destino_mascarado' => ebd_mask_email($dbEmail),
]);
