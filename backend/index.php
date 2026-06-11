<?php

declare(strict_types=1);

/** Serve a landing page na raiz; fallback para health da API. */
$landing = __DIR__ . '/index.html';
if (is_readable($landing)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($landing);
    exit;
}

header('Location: /api/health.php', true, 302);
exit;
