<?php

declare(strict_types=1);

/**
 * Router para `php -S` — expõe cabeçalhos (Authorization) antes de despachar ficheiros.
 * Arranque: na raiz do projeto → npm run api
 */
require_once __DIR__ . '/ebd_normalize_request.php';

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url((string) $uri, PHP_URL_PATH) ?? '/';
$path = rawurldecode($path);

$file = realpath(__DIR__ . DIRECTORY_SEPARATOR . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $path), DIRECTORY_SEPARATOR));

if ($file !== false && str_starts_with($file, realpath(__DIR__) ?: '') && is_file($file)) {
    return false;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo '404 — use /api/health.php, /api/auth/login.php, etc.';
