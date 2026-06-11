<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';

require_once __DIR__ . '/meta.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$origin = ebd_env_string('EBD_CORS_ORIGIN');
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * @param array<string, mixed> $data
 */
function ebd_json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

/**
 * @return array<string, mixed>
 */
function ebd_read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        ebd_json_response([
            'ok' => false,
            'error' => 'JSON inválido',
            'code' => 'INVALID_JSON',
        ], 400);
    }

    return is_array($decoded) ? $decoded : [];
}

/**
 * Carrega módulo partilhado (api/lib ou lib/ na raiz do deploy).
 */
function ebd_require_lib(string $filename): void
{
    $filename = ltrim($filename, '/');
    $roots = [
        __DIR__ . '/lib',
        dirname(__DIR__) . '/lib',
    ];
    foreach ($roots as $root) {
        $path = $root . '/' . $filename;
        if (is_readable($path)) {
            require_once $path;
            return;
        }
    }
    ebd_json_response([
        'ok' => false,
        'error' => 'Módulo em falta no servidor (' . $filename . '). Atualize o deploy da API.',
        'code' => 'STORE_FAILED',
    ], 503);
}
