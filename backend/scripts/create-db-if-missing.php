<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';

$name = ebd_env_string('EBD_DB_NAME', 'ebd_prime');
$host = ebd_env_string('EBD_DB_HOST', '127.0.0.1');
$port = ebd_env_string('EBD_DB_PORT', '3306');
$user = ebd_env_string('EBD_DB_USER', 'root');
$pass = ebd_env_string('EBD_DB_PASS', '');

$dsn = sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port);
$pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec(
    'CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', $name) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
);
fwrite(STDOUT, "Base `$name` pronta.\n");
