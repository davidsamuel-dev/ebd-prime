<?php

declare(strict_types=1);

require_once __DIR__ . '/load_env.php';
require_once __DIR__ . '/ebd_normalize_request.php';

ebd_load_dotenv();

/**
 * Lê variável de ambiente (`.env` preenche `$_ENV`; no Windows `getenv` pode ser inconsistente).
 */
function ebd_env_string(string $key, string $default = ''): string
{
    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }

    $g = getenv($key);
    if ($g !== false) {
        return (string) $g;
    }

    return $default;
}

/**
 * Conexão MySQL via PDO — EBD Prime
 * Credenciais: ficheiro `backend/.env` (ver `.env.example`) ou variáveis do sistema.
 */

function ebd_get_pdo(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = ebd_env_string('EBD_DB_HOST', '127.0.0.1');
    $port = ebd_env_string('EBD_DB_PORT', '3306');
    $dbname = ebd_env_string('EBD_DB_NAME', 'ebd_prime');
    $charset = ebd_env_string('EBD_DB_CHARSET', 'utf8mb4');
    $user = ebd_env_string('EBD_DB_USER', 'root');
    $pass = ebd_env_string('EBD_DB_PASS', '');

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $host,
        $port,
        $dbname,
        $charset
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $user, $pass, $options);

    return $pdo;
}
