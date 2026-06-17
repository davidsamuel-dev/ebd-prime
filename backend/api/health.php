<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';
require_once __DIR__ . '/meta.php';

/**
 * Health check operacional (liveness + readiness da base de dados).
 *
 * GET apenas. Sem dados sensíveis. Adequado para monitorização e para o cliente validar EXPO_PUBLIC_API_URL.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$origin = ebd_env_string('EBD_CORS_ORIGIN');
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'Método não permitido',
        'code' => 'METHOD_NOT_ALLOWED',
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

$dbStatus = 'down';
$dbLatencyMs = null;
$dbErrorCode = null;

try {
    $t0 = microtime(true);
    $pdo = ebd_get_pdo();
    $pdo->query('SELECT 1');
    $dbLatencyMs = round((microtime(true) - $t0) * 1000, 2);
    $dbStatus = 'up';
} catch (Throwable $e) {
    $dbStatus = 'down';
    $dbErrorCode = 'DB_CONNECTION_FAILED';
    $pdoMsg = strtolower($e->getMessage());
    if (str_contains($pdoMsg, '1049')) {
        $dbErrorCode = 'DB_DATABASE_MISSING';
    } elseif (str_contains($pdoMsg, '1045') || str_contains($pdoMsg, '1698')) {
        $dbErrorCode = 'DB_AUTH_FAILED';
    } elseif (
        str_contains($pdoMsg, '2002')
        || str_contains($pdoMsg, 'connection refused')
        || str_contains($pdoMsg, 'recusou')
        || str_contains($pdoMsg, 'actively refused')
    ) {
        $dbErrorCode = 'DB_HOST_REFUSED';
    }
}

$overallOk = $dbStatus === 'up';

$payload = [
    'ok' => $overallOk,
    'service' => EbdApiMeta::SERVICE,
    'version' => EbdApiMeta::VERSION,
    'time' => gmdate('c'),
    'database' => [
        'status' => $dbStatus,
        'latency_ms' => $dbLatencyMs,
    ],
];

if ($dbErrorCode !== null) {
    $payload['database']['error_code'] = $dbErrorCode;
    $payload['hints'] = [
        'Confirme que o MySQL está a correr (XAMPP, Laragon ou base remota Hostinger).',
        'Verifique o ficheiro backend/.env: EBD_DB_HOST (prefira 127.0.0.1), EBD_DB_USER, EBD_DB_PASS, EBD_DB_NAME.',
        'Importe o schema: npm run db:import, npm run db:import:php ou backend/scripts/import-schema.ps1.',
    ];
}

http_response_code($overallOk ? 200 : 503);
echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
