<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$phoneRaw = trim((string) ($body['telefone'] ?? $body['phone'] ?? ''));
$code = preg_replace('/\D+/', '', (string) ($body['codigo'] ?? $body['code'] ?? ''));

$phone = ebd_normalize_br_phone($phoneRaw);

if ($phone === null || strlen($code) !== 6) {
    ebd_json_response(['ok' => false, 'error' => 'Telefone ou código inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$sql = <<<'SQL'
SELECT id, code_hash, expires_at, verified_at
FROM onboarding_verifications
WHERE phone_e164 = :p
  AND verified_at IS NULL
ORDER BY id DESC
LIMIT 1
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute(['p' => $phone]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row === false) {
    ebd_json_response(['ok' => false, 'error' => 'Nenhum código pendente para este número', 'code' => 'NOT_FOUND'], 404);
}

if (strtotime((string) $row['expires_at']) < time()) {
    ebd_json_response(['ok' => false, 'error' => 'Código expirado', 'code' => 'VALIDATION_ERROR'], 400);
}

if (!password_verify($code, (string) $row['code_hash'])) {
    ebd_json_response(['ok' => false, 'error' => 'Código incorreto', 'code' => 'AUTH_INVALID'], 401);
}

$preToken = bin2hex(random_bytes(32));
$preExp = (new DateTimeImmutable('+2 hours'))->format('Y-m-d H:i:s');
$id = (int) $row['id'];

$upd = $pdo->prepare(
    'UPDATE onboarding_verifications SET verified_at = NOW(), pre_token = :t, pre_token_expires_at = :e WHERE id = :id'
);
$upd->execute(['t' => $preToken, 'e' => $preExp, 'id' => $id]);

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'pre_token' => $preToken,
    'pre_token_expires_at' => $preExp,
]);
