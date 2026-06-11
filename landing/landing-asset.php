<?php

declare(strict_types=1);

/**
 * Serve imagens da landing via PHP (Hostinger CDN às vezes não expõe PNG em subpastas novas).
 * Uso: /landing-asset.php?f=logo_comprida.png
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

$dirs = [
    __DIR__ . '/site-assets/' . $name,
    __DIR__ . '/' . $name,
];

$path = null;
foreach ($dirs as $candidate) {
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
