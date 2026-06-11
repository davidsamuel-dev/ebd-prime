<?php

declare(strict_types=1);

/**
 * Testa envio SMTP (recuperação de senha).
 * Uso: php backend/scripts/test-smtp.php destino@email.com
 */

require_once dirname(__DIR__) . '/db_connection.php';
require_once dirname(__DIR__) . '/lib/ebd_mailer.php';

$to = isset($argv[1]) ? trim($argv[1]) : '';

if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Uso: php backend/scripts/test-smtp.php seu@email.com\n");
    exit(1);
}

$base = trim(ebd_env_string('EBD_PASSWORD_RESET_LINK_BASE'));
if ($base === '') {
    fwrite(STDERR, "Defina EBD_PASSWORD_RESET_LINK_BASE no backend/.env\n");
    exit(1);
}

if (ebd_env_string('EBD_SMTP_PASS') === '') {
    fwrite(STDERR, "Defina EBD_SMTP_PASS (senha da caixa Hostinger) no backend/.env\n");
    exit(1);
}

$link = $base . (str_contains($base, '?') ? '&' : '?') . 'token=teste_smtp';

try {
    ebd_send_password_reset_email($to, $link);
    fwrite(STDOUT, "OK — e-mail de teste enviado para $to\n");
    fwrite(STDOUT, 'Remetente: ' . ebd_env_string('EBD_SMTP_FROM_EMAIL') . "\n");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . "\n");
    exit(1);
}
