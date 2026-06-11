<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
ebd_require_lib('ebd_smtp_config.php');
ebd_require_lib('ebd_mailer.php');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

if (!ebd_auth_may_view_all_congregacoes($auth)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Apenas administradores podem alterar a configuração SMTP.',
        'code' => 'FORBIDDEN',
    ], 403);
}

$requested = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;
$cid = ebd_resolve_congregacao_scope($pdo, $auth, $requested);

$trim = static fn (mixed $v): string => trim((string) ($v ?? ''));

$host = $trim($body['smtp_host'] ?? '');
$user = $trim($body['smtp_user'] ?? '');
$fromEmail = $trim($body['smtp_from_email'] ?? '');
$pass = (string) ($body['smtp_pass'] ?? '');
$port = isset($body['smtp_port']) ? max(1, min(65535, (int) $body['smtp_port'])) : 465;
$secureRaw = strtolower($trim($body['smtp_secure'] ?? 'ssl'));
$secure = in_array($secureRaw, ['ssl', 'tls', 'starttls'], true) ? $secureRaw : 'ssl';
$fromName = $trim($body['smtp_from_name'] ?? '') ?: 'EBD Prime';
$resetBase = $trim($body['password_reset_link_base'] ?? '');

if ($host === '' || $user === '' || $fromEmail === '') {
    ebd_json_response([
        'ok' => false,
        'error' => 'Servidor SMTP, utilizador e e-mail remetente são obrigatórios.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
    ebd_json_response(['ok' => false, 'error' => 'E-mail remetente inválido.', 'code' => 'VALIDATION_ERROR'], 400);
}

$existingPass = '';
try {
    $stmt = $pdo->prepare('SELECT smtp_pass FROM congregacoes WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $cid]);
    $existingPass = trim((string) ($stmt->fetchColumn() ?: ''));
} catch (Throwable $e) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Base de dados desatualizada. Execute database_migration_009_inativos_sem_turma_smtp.sql',
        'code' => 'DB_UNAVAILABLE',
    ], 503);
}

$passToStore = $pass !== '' ? $pass : $existingPass;
if ($passToStore === '' && !ebd_smtp_configured($pdo, null)) {
    ebd_json_response([
        'ok' => false,
        'error' => 'Indique a senha SMTP.',
        'code' => 'VALIDATION_ERROR',
    ], 400);
}

if ($passToStore === '') {
    $passToStore = ebd_env_string('EBD_SMTP_PASS');
}

$sql = <<<'SQL'
UPDATE congregacoes SET
    smtp_host = :host,
    smtp_port = :port,
    smtp_secure = :secure,
    smtp_user = :user,
    smtp_pass = :pass,
    smtp_from_email = :from_email,
    smtp_from_name = :from_name,
    password_reset_link_base = :reset_base,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
SQL;

try {
    $pdo->prepare($sql)->execute([
        'host' => $host,
        'port' => $port,
        'secure' => $secure,
        'user' => $user,
        'pass' => $passToStore,
        'from_email' => $fromEmail,
        'from_name' => $fromName,
        'reset_base' => $resetBase !== '' ? $resetBase : null,
        'id' => $cid,
    ]);
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar SMTP', 'code' => 'STORE_FAILED'], 500);
}

$testEmail = $trim($body['test_email'] ?? '');
if ($testEmail !== '') {
    if (!filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
        ebd_json_response(['ok' => false, 'error' => 'E-mail de teste inválido.', 'code' => 'VALIDATION_ERROR'], 400);
    }
    $cfg = ebd_load_smtp_config($pdo, $cid);
    if ($cfg === null) {
        ebd_json_response(['ok' => false, 'error' => 'SMTP incompleto após guardar.', 'code' => 'STORE_FAILED'], 500);
    }
    try {
        ebd_send_smtp_test_email($cfg, $testEmail);
    } catch (Throwable $e) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Guardado, mas o teste falhou: ' . $e->getMessage(),
            'code' => 'STORE_FAILED',
        ], 503);
    }
    ebd_json_response([
        'ok' => true,
        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
        'message' => 'Configuração guardada e e-mail de teste enviado.',
        'configured' => true,
    ]);
}

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'message' => 'Configuração SMTP guardada.',
    'configured' => ebd_smtp_configured($pdo, $cid),
]);
