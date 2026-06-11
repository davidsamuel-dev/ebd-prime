<?php

declare(strict_types=1);

/**
 * Atualiza e-mail do admin demo para testar recuperação de senha com SMTP.
 * Uso: php backend/scripts/patch-demo-admin-email.php suporte@adparaiso.com.br
 */

require_once dirname(__DIR__) . '/db_connection.php';

$email = isset($argv[1]) ? trim(strtolower($argv[1])) : 'suporte@adparaiso.com.br';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "E-mail inválido.\n");
    exit(1);
}

$pdo = ebd_get_pdo();
$st = $pdo->prepare(
    "UPDATE usuarios SET email = :e WHERE login_usuario = 'admin' OR email = 'admin@demo.local' LIMIT 1"
);
$st->execute(['e' => $email]);

fwrite(STDOUT, "Admin demo: e-mail atualizado para $email (" . $st->rowCount() . " linha(s)).\n");
