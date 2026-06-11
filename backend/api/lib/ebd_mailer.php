<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/ebd_smtp_config.php';

function ebd_mailer_vendor_autoload(): string
{
    foreach ([
        dirname(__DIR__, 2) . '/vendor/autoload.php',
        dirname(__DIR__) . '/vendor/autoload.php',
    ] as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }

    throw new RuntimeException(
        'PHPMailer não instalado. Execute composer install e envie a pasta vendor/ para o servidor.',
    );
}

/**
 * @param array<string, string|null> $cfg
 */
function ebd_phpmailer_make(array $cfg): PHPMailer\PHPMailer\PHPMailer
{
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host = (string) $cfg['host'];
    $mail->SMTPAuth = true;
    $mail->Username = (string) $cfg['user'];
    $mail->Password = (string) $cfg['pass'];
    $port = (int) ($cfg['port'] ?? 465);
    $mail->Port = $port > 0 ? $port : 465;

    $encryption = strtolower((string) ($cfg['secure'] ?? 'ssl'));
    if ($encryption === 'tls' || $encryption === 'starttls') {
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    }

    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ],
    ];

    $mail->setFrom((string) $cfg['from_email'], (string) ($cfg['from_name'] ?? 'EBD Prime'));

    return $mail;
}

/**
 * @param array<string, string|null> $cfg
 */
function ebd_phpmailer_send(PHPMailer\PHPMailer\PHPMailer $mail, array $cfg): void
{
    try {
        $mail->send();
        return;
    } catch (PHPMailer\PHPMailer\Exception $first) {
        $msg = $first->getMessage();
        $secure = strtolower((string) ($cfg['secure'] ?? 'ssl'));
        $canRetryTls = str_contains(strtolower($msg), 'authenticate')
            && $secure !== 'tls'
            && $secure !== 'starttls';

        if (!$canRetryTls) {
            throw new RuntimeException($msg, 0, $first);
        }

        $retryCfg = $cfg;
        $retryCfg['port'] = '587';
        $retryCfg['secure'] = 'tls';
        $retry = ebd_phpmailer_make($retryCfg);
        $retry->Subject = $mail->Subject;
        $retry->Body = $mail->Body;
        $retry->AltBody = $mail->AltBody;
        $retry->isHTML($mail->ContentType === 'text/html');
        foreach ($mail->getToAddresses() as $to) {
            $retry->addAddress($to[0], $to[1] ?? '');
        }

        try {
            $retry->send();
        } catch (PHPMailer\PHPMailer\Exception $second) {
            throw new RuntimeException($second->getMessage(), 0, $second);
        }
    }
}

/**
 * Envia e-mail de recuperação de senha (RF46).
 *
 * @throws RuntimeException quando SMTP ou PHPMailer não estão disponíveis
 */
function ebd_send_password_reset_email(string $toEmail, string $resetLink, ?int $congregacaoId = null): void
{
    require_once ebd_mailer_vendor_autoload();

    $pdo = ebd_get_pdo();
    $cfg = ebd_load_smtp_config($pdo, $congregacaoId);
    if ($cfg === null) {
        throw new RuntimeException(
            'SMTP não configurado. Defina o envio de e-mail no .env do servidor.',
        );
    }

    if (($cfg['pass'] ?? '') === '') {
        throw new RuntimeException('Senha SMTP em falta no servidor.');
    }

    $mail = ebd_phpmailer_make($cfg);
    $mail->addAddress($toEmail);
    $mail->Subject = 'Recuperação de senha — EBD Prime';
    $mail->isHTML(true);
    $linkEsc = htmlspecialchars($resetLink, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $mail->Body = <<<HTML
<div style="margin:0;padding:32px 16px;background:#E8ECF1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:440px;margin:0 auto;text-align:center;">
    <p style="margin:0 0 24px;font-size:22px;font-weight:800;letter-spacing:0.04em;color:#0078D4;">EBD PRIME</p>
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:20px;padding:32px 28px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <p style="margin:0 0 16px;font-size:16px;color:#1F2937;">Olá,</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#6B7280;">Para recuperar o seu acesso ao aplicativo <strong style="color:#0078D4;">EBD Prime</strong>, clique no link abaixo e crie uma nova senha (válido por 30 minutos):</p>
      <p style="margin:0 0 20px;"><a href="{$linkEsc}" style="font-size:16px;font-weight:700;color:#0078D4;text-decoration:none;">Redefinir senha</a></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#9CA3AF;">Caso esta alteração não tenha sido solicitada por si, ignore este e-mail. Verifique também a pasta de spam.</p>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">EBD Prime · Recuperação de acesso segura</p>
  </div>
</div>
HTML;
    $mail->AltBody = "Recuperação de senha EBD Prime\n\nAbra o link no navegador:\n{$resetLink}\n\n(válido 30 minutos)";

    ebd_phpmailer_send($mail, $cfg);
}

/**
 * @param array<string, string|null> $cfg
 * @throws RuntimeException
 */
function ebd_send_smtp_test_email(array $cfg, string $toEmail): void
{
    require_once ebd_mailer_vendor_autoload();

    if (($cfg['pass'] ?? '') === '') {
        throw new RuntimeException('Senha SMTP em falta.');
    }

    $mail = ebd_phpmailer_make($cfg);
    $mail->addAddress($toEmail);
    $mail->Subject = 'Teste SMTP — EBD Prime';
    $mail->Body = '<p>Este é um e-mail de teste do Portal EBD. O envio SMTP está a funcionar.</p>';
    $mail->AltBody = 'Teste SMTP EBD Prime — envio OK.';
    ebd_phpmailer_send($mail, $cfg);
}
