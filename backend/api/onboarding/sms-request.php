<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();
$phoneRaw = trim((string) ($body['telefone'] ?? $body['phone'] ?? ''));

$phone = ebd_normalize_br_phone($phoneRaw);

if ($phone === null) {
    ebd_json_response(['ok' => false, 'error' => 'Telefone inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

$code = (string) random_int(100000, 999999);
$hash = password_hash($code, PASSWORD_DEFAULT);
$expiresAt = (new DateTimeImmutable('+15 minutes'))->format('Y-m-d H:i:s');

$pdo->prepare('DELETE FROM onboarding_verifications WHERE phone_e164 = :p AND verified_at IS NULL')
    ->execute(['p' => $phone]);

$stmt = $pdo->prepare(
    'INSERT INTO onboarding_verifications (phone_e164, code_hash, expires_at) VALUES (:p, :h, :e)'
);
$stmt->execute(['p' => $phone, 'h' => $hash, 'e' => $expiresAt]);

$payload = [
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
];

// Por defeito: apenas simulação — não há envio por SMS real; o código vem na resposta para o app validar.
// Quando integrar um gateway (Twilio, etc.), definir EBD_SMS_REAL=1 no .env e implementar o envio aqui.
$realSms = ebd_env_string('EBD_SMS_REAL');
$isSimulation = $realSms !== '1' && strtolower($realSms) !== 'true';

if ($isSimulation) {
    $payload['simulated'] = true;
    $payload['dev_code'] = $code;
    $payload['message'] = 'SMS simulado — sem envio real; use o código devolvido para continuar.';
} else {
    $payload['simulated'] = false;
    $payload['message'] = 'SMS de verificação solicitado.';
    // TODO: enviar código via gateway quando EBD_SMS_REAL=1.
}

ebd_json_response($payload);
