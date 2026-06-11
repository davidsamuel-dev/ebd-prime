<?php

declare(strict_types=1);

function ebd_env_smtp_ready(): bool
{
    return ebd_env_string('EBD_SMTP_HOST') !== ''
        && ebd_env_string('EBD_SMTP_USER') !== ''
        && ebd_env_string('EBD_SMTP_PASS') !== ''
        && (ebd_env_string('EBD_SMTP_FROM_EMAIL') !== '' || ebd_env_string('EBD_SMTP_USER') !== '');
}

/**
 * @param array<string, mixed>|null $row
 */
function ebd_smtp_reset_base_from_row(?array $row): string
{
    $fromRow = trim((string) ($row['password_reset_link_base'] ?? ''));

    return $fromRow !== '' ? $fromRow : trim(ebd_env_string('EBD_PASSWORD_RESET_LINK_BASE'));
}

/**
 * @return array<string, string|null>|null
 */
function ebd_load_smtp_config(PDO $pdo, ?int $congregacaoId = null): ?array
{
    $row = null;
    if ($congregacaoId != null && $congregacaoId > 0) {
        try {
            $stmt = $pdo->prepare(
                'SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
                        smtp_from_email, smtp_from_name, password_reset_link_base
                 FROM congregacoes WHERE id = :id LIMIT 1'
            );
            $stmt->execute(['id' => $congregacaoId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Throwable $e) {
            $row = null;
        }
    }

    // Servidor (.env) tem prioridade — evita senha errada guardada na base por engano.
    if (ebd_env_smtp_ready()) {
        $port = (int) ebd_env_string('EBD_SMTP_PORT', '465');

        return [
            'host' => ebd_env_string('EBD_SMTP_HOST'),
            'port' => (string) ($port > 0 ? $port : 465),
            'secure' => ebd_env_string('EBD_SMTP_SECURE', 'ssl'),
            'user' => ebd_env_string('EBD_SMTP_USER'),
            'pass' => ebd_env_string('EBD_SMTP_PASS'),
            'from_email' => ebd_env_string('EBD_SMTP_FROM_EMAIL') ?: ebd_env_string('EBD_SMTP_USER'),
            'from_name' => ebd_env_string('EBD_SMTP_FROM_NAME', 'EBD Prime'),
            'password_reset_link_base' => ebd_smtp_reset_base_from_row($row) ?: null,
        ];
    }

    $host = trim((string) ($row['smtp_host'] ?? ''));
    if ($host === '') {
        $host = ebd_env_string('EBD_SMTP_HOST');
    }

    $user = trim((string) ($row['smtp_user'] ?? ''));
    if ($user === '') {
        $user = ebd_env_string('EBD_SMTP_USER');
    }

    $fromEmail = trim((string) ($row['smtp_from_email'] ?? ''));
    if ($fromEmail === '') {
        $fromEmail = ebd_env_string('EBD_SMTP_FROM_EMAIL');
    }

    if ($host === '' || $user === '' || $fromEmail === '') {
        return null;
    }

    $pass = trim((string) ($row['smtp_pass'] ?? ''));
    if ($pass === '') {
        $pass = ebd_env_string('EBD_SMTP_PASS');
    }

    $portRaw = $row['smtp_port'] ?? null;
    $port = $portRaw !== null && (int) $portRaw > 0
        ? (int) $portRaw
        : (int) ebd_env_string('EBD_SMTP_PORT', '465');

    $secure = trim((string) ($row['smtp_secure'] ?? ''));
    if ($secure === '') {
        $secure = ebd_env_string('EBD_SMTP_SECURE', 'ssl');
    }

    $fromName = trim((string) ($row['smtp_from_name'] ?? ''));
    if ($fromName === '') {
        $fromName = ebd_env_string('EBD_SMTP_FROM_NAME', 'EBD Prime');
    }

    $resetBase = ebd_smtp_reset_base_from_row($row);

    return [
        'host' => $host,
        'port' => (string) $port,
        'secure' => $secure,
        'user' => $user,
        'pass' => $pass,
        'from_email' => $fromEmail,
        'from_name' => $fromName,
        'password_reset_link_base' => $resetBase !== '' ? $resetBase : null,
    ];
}

function ebd_smtp_configured(PDO $pdo, ?int $congregacaoId = null): bool
{
    $cfg = ebd_load_smtp_config($pdo, $congregacaoId);

    return $cfg !== null && ($cfg['pass'] ?? '') !== '';
}
