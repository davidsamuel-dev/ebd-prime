<?php

declare(strict_types=1);

/**
 * Carrega `backend/.env` (formato KEY=VAL) em putenv/$_ENV.
 * Comentários (#) e linhas vazias são ignorados. Idempotente.
 */
function ebd_load_dotenv(): void
{
    static $done = false;

    if ($done) {
        return;
    }

    $done = true;
    $path = __DIR__ . DIRECTORY_SEPARATOR . '.env';

    if (!is_readable($path)) {
        return;
    }

    $raw = file_get_contents($path);

    if ($raw === false) {
        return;
    }

    if (str_starts_with($raw, "\xEF\xBB\xBF")) {
        $raw = substr($raw, 3);
    }

    $lines = preg_split('/\R/', $raw) ?: [];

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (!str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        if ($key === '') {
            continue;
        }

        if (
            strlen($value) >= 2
            && (
                ($value[0] === '"' && str_ends_with($value, '"'))
                || ($value[0] === "'" && str_ends_with($value, "'"))
            )
        ) {
            $value = stripcslashes(substr($value, 1, -1));
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}
