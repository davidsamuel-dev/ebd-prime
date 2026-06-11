<?php

declare(strict_types=1);

/**
 * Imagens da landing page (servidas via PHP em /api/).
 * Uso: /api/landing-asset.php?f=logo_comprida.png
 */

$allowed = [
    'logo1.png' => 'image/png',
    'logo_comprida.png' => 'image/png',
    'logo_fundo_azul.png' => 'image/png',
];

$name = basename((string) ($_GET['f'] ?? ''));
if ($name === '' || !isset($allowed[$name])) {
    http_response_code(404);
    exit;
}

$path = null;
foreach ([
    __DIR__ . '/' . $name,
    dirname(__DIR__) . '/lib/landing-images/' . $name,
] as $candidate) {
    if (is_readable($candidate)) {
        $path = $candidate;
        break;
    }
}

if ($path === null) {
    http_response_code(404);
    exit;
}

header('Content-Type: ' . $allowed[$name]);
header('Cache-Control: public, max-age=86400');
readfile($path);
