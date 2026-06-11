<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
ebd_require_lib('ebd_smtp_config.php');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

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
        'error' => 'Apenas administradores podem ver a configuração SMTP.',
        'code' => 'FORBIDDEN',
    ], 403);
}

$requested = isset($_GET['congregacao_id']) ? (int) $_GET['congregacao_id'] : 0;
$cid = ebd_resolve_congregacao_scope($pdo, $auth, $requested);

$row = null;
try {
    $stmt = $pdo->prepare(
        'SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_email, smtp_from_name,
                password_reset_link_base,
                (smtp_pass IS NOT NULL AND smtp_pass <> \'\') AS has_pass
         FROM congregacoes WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $cid]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
} catch (Throwable $e) {
    $row = null;
}

$envFallback = ebd_load_smtp_config($pdo, null);
$dbConfigured = $row !== null
    && trim((string) ($row['smtp_host'] ?? '')) !== ''
    && trim((string) ($row['smtp_user'] ?? '')) !== '';

ebd_json_response([
    'ok' => true,
    'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
    'smtp' => [
        'host' => $row['smtp_host'] ?? ($envFallback['host'] ?? ''),
        'port' => isset($row['smtp_port']) ? (int) $row['smtp_port'] : (int) ($envFallback['port'] ?? 465),
        'secure' => $row['smtp_secure'] ?? ($envFallback['secure'] ?? 'ssl'),
        'user' => $row['smtp_user'] ?? ($envFallback['user'] ?? ''),
        'from_email' => $row['smtp_from_email'] ?? ($envFallback['from_email'] ?? ''),
        'from_name' => $row['smtp_from_name'] ?? ($envFallback['from_name'] ?? 'EBD Prime'),
        'password_reset_link_base' => $row['password_reset_link_base'] ?? ($envFallback['password_reset_link_base'] ?? ''),
        'has_password' => ($row !== null && !empty($row['has_pass'])) || ($envFallback['pass'] ?? '') !== '',
        'source' => $dbConfigured ? 'database' : (($envFallback !== null && ($envFallback['pass'] ?? '') !== '') ? 'env' : 'none'),
        'configured' => ebd_smtp_configured($pdo, $cid),
    ],
]);
