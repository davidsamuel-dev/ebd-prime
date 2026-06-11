<?php

declare(strict_types=1);

/**
 * Descobre host MySQL Hostinger acessível a partir do PC.
 * Lê user/pass/db de backend/.env
 */

require_once dirname(__DIR__) . '/db_connection.php';

$user = ebd_env_string('EBD_DB_USER');
$pass = ebd_env_string('EBD_DB_PASS');
$db = ebd_env_string('EBD_DB_NAME', 'u370088447_ebd_prime');
$port = ebd_env_string('EBD_DB_PORT', '3306');

$candidates = [
    'auth-db1664.hstgr.io',
    'srv1664.hstgr.io',
    'mysql1664.hostinger.com',
    '127.0.0.1',
];

foreach ($candidates as $host) {
    $label = "$host:$port";
    try {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $db);
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 8,
        ]);
        $ver = $pdo->query('SELECT VERSION()')->fetchColumn();
        $tables = (int) $pdo->query(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()'
        )->fetchColumn();
        fwrite(STDOUT, "OK $label — MySQL $ver — tabelas: $tables\n");
        exit(0);
    } catch (Throwable $e) {
        fwrite(STDOUT, "FALHOU $label — " . $e->getMessage() . "\n");
    }
}

exit(1);
