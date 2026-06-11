<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' && ($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

ebd_require_school_admin($auth);

$requested = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0;
$cid = ebd_resolve_congregacao_scope($pdo, $auth, $requested);

$nome = trim((string) ($body['nome'] ?? ''));
if ($nome === '') {
    ebd_json_response(['ok' => false, 'error' => 'O nome da escola é obrigatório.', 'code' => 'VALIDATION_ERROR'], 400);
}

$trimNull = static function (mixed $v): ?string {
    $s = trim((string) ($v ?? ''));
    return $s === '' ? null : $s;
};

$subtitulo = $trimNull($body['subtitulo'] ?? null);
$logradouro = $trimNull($body['logradouro'] ?? null);
$numero = $trimNull($body['numero'] ?? null);
$bairro = $trimNull($body['bairro'] ?? null);
$estadoRaw = strtoupper(trim((string) ($body['estado'] ?? '')));
$estado = $estadoRaw !== '' ? substr($estadoRaw, 0, 2) : null;
$cidade = $trimNull($body['cidade'] ?? null);

$sql = <<<'SQL'
UPDATE congregacoes SET
    nome = :nome,
    subtitulo = :subtitulo,
    logradouro = :logradouro,
    numero = :numero,
    bairro = :bairro,
    estado = :estado,
    cidade = :cidade,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute([
    'nome' => $nome,
    'subtitulo' => $subtitulo,
    'logradouro' => $logradouro,
    'numero' => $numero,
    'bairro' => $bairro,
    'estado' => $estado,
    'cidade' => $cidade,
    'id' => $cid,
]);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'message' => 'Dados da escola atualizados.',
]);
