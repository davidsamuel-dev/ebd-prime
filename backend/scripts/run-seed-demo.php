<?php

declare(strict_types=1);

require_once __DIR__ . '/import-schema.php';

try {
    $pdo = ebd_get_pdo();
    run_file($pdo, dirname(__DIR__) . '/seed_demo.sql');
    fwrite(STDOUT, "Seed demo aplicado.\n");
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
