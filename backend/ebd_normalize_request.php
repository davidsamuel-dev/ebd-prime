<?php

declare(strict_types=1);

/**
 * Garantir HTTP_AUTHORIZATION (Bearer) no servidor embutido do PHP (`php -S`) e alguns CGI.
 * Sem isto o login até pode funcionar mas os endpoints protegidos devolvem sempre 401.
 */
function ebd_normalize_http_authorization(): void
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return;
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];

        return;
    }
    if (!empty($_SERVER['Authorization'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['Authorization'];

        return;
    }

    $headers = [];
    if (function_exists('getallheaders')) {
        $h = getallheaders();
        if (is_array($h)) {
            $headers = $h;
        }
    } elseif (function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        if (is_array($h)) {
            $headers = $h;
        }
    }

    foreach ($headers as $name => $value) {
        if (strcasecmp((string) $name, 'Authorization') === 0 && $value !== '') {
            $_SERVER['HTTP_AUTHORIZATION'] = (string) $value;
            break;
        }
    }
}

ebd_normalize_http_authorization();
