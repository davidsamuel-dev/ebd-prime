<?php

declare(strict_types=1);

/**
 * Normaliza telefone BR para dígitos (55 + DDD + número, 12–13 dígitos).
 */
function ebd_normalize_br_phone(string $raw): ?string
{
    $d = preg_replace('/\D+/', '', $raw) ?? '';

    if ($d === '') {
        return null;
    }

    if (strlen($d) >= 12 && str_starts_with($d, '55')) {
        return $d;
    }

    if (strlen($d) === 11 && str_starts_with($d, '0')) {
        $d = substr($d, 1);
    }

    if (strlen($d) === 10 || strlen($d) === 11) {
        return '55' . $d;
    }

    return null;
}
