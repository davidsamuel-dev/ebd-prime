<?php

declare(strict_types=1);

/**
 * Metadados da API REST — única fonte de verdade para versão e nome do serviço.
 * Ao alterar a versão, atualizar também:
 * - backend/openapi.yaml (`info.version`)
 * - docs/api_rest_ebd_prime.md (tabela / texto)
 */
final class EbdApiMeta
{
    public const VERSION = '1.0.0';

    public const SERVICE = 'ebd-prime-api';
}
