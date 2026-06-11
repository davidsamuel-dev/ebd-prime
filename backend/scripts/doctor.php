<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/db_connection.php';

/**
 * Diagnóstico local de ambiente backend.
 * Uso: php backend/scripts/doctor.php
 */

function line(string $s): void
{
    fwrite(STDOUT, $s . PHP_EOL);
}

function fail(string $s): void
{
    fwrite(STDERR, $s . PHP_EOL);
}

line('== EBD Prime Doctor ==');
line('PHP: ' . PHP_VERSION);
line('PDO_MYSQL: ' . (extension_loaded('pdo_mysql') ? 'OK' : 'FALTA'));
line('ENV DB: host=' . ebd_env_string('EBD_DB_HOST', '(vazio)') . ' port=' . ebd_env_string('EBD_DB_PORT', '(vazio)') . ' db=' . ebd_env_string('EBD_DB_NAME', '(vazio)') . ' user=' . ebd_env_string('EBD_DB_USER', '(vazio)'));

if (!extension_loaded('pdo_mysql')) {
    fail('Erro: extensão pdo_mysql não está ativa no PHP.');
    exit(2);
}

try {
    $pdo = ebd_get_pdo();
    $pdo->query('SELECT 1');
    line('Conexão MySQL: OK');
} catch (Throwable $e) {
    fail('Conexão MySQL: FALHOU');
    fail('Motivo: ' . $e->getMessage());
    fail('Dica: inicie MySQL (Docker/XAMPP/Laragon) e ajuste backend/.env.');
    exit(1);
}

$required = ['congregacoes', 'usuarios', 'api_tokens', 'turmas', 'escala_aulas', 'relatorios_aula', 'frequencia'];
$missing = [];

foreach ($required as $t) {
    $st = $pdo->prepare('SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t');
    $st->execute(['t' => $t]);
    $row = $st->fetch();
    $exists = isset($row['c']) && (int) $row['c'] > 0;
    if (!$exists) {
        $missing[] = $t;
    }
}

if ($missing !== []) {
    fail('Tabelas em falta: ' . implode(', ', $missing));
    fail('Execute: php backend/scripts/import-schema.php');
    exit(1);
}

line('Schema: OK');
line('Tudo pronto para a API local.');
