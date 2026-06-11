<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ebd_json_response(['ok' => false, 'error' => 'Método não permitido', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

$body = ebd_read_json_body();

$updateUid = isset($body['usuario_id']) ? (int) $body['usuario_id'] : 0;
if ($updateUid <= 0 && isset($body['id'])) {
    $updateUid = (int) $body['id'];
}
$inativarVinculo = !empty($body['inativar_vinculo_aluno']) || !empty($body['inativar']);

if ($inativarVinculo) {
    if ($updateUid <= 0) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Indique usuario_id para inativar o cadastro.',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }

    try {
        $pdo = ebd_get_pdo();
    } catch (Throwable $e) {
        ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
    }

    require_once dirname(__DIR__) . '/auth/bearer.php';
    $auth = ebd_require_authenticated_user($pdo);

    $scopeCid = ebd_resolve_congregacao_scope(
        $pdo,
        $auth,
        isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0,
    );
    if ($scopeCid <= 0) {
        ebd_json_response(['ok' => false, 'error' => 'Congregação em falta', 'code' => 'NO_CONGREGACAO'], 400);
    }

    if (function_exists('ebd_inativar_cadastro_ebd')) {
        ebd_inativar_cadastro_ebd($pdo, $auth, $updateUid, $scopeCid);
    } else {
        $usuario = ebd_fetch_usuario_in_congregacao($pdo, $updateUid, $scopeCid);
        if ($usuario === false) {
            ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
        }
        if (ebd_usuario_is_protected_staff($usuario)) {
            ebd_json_response([
                'ok' => false,
                'error' => 'Não é possível inativar este tipo de conta.',
                'code' => 'FORBIDDEN',
            ], 403);
        }
        $nivelInativar = strtolower((string) ($usuario['nivel_acesso'] ?? 'sem_login'));
        $papelInativar = $nivelInativar === 'professor' ? 'professor' : 'aluno';
        $ativosInativar = $papelInativar === 'professor'
            ? ebd_fetch_active_professor_vinculos($pdo, $updateUid)
            : ebd_fetch_active_aluno_vinculos($pdo, $updateUid);
        if (count($ativosInativar) > 0) {
            $pdo->prepare(
                'UPDATE vinculos_turma SET ativo = 0, data_fim = CURDATE(), updated_at = CURRENT_TIMESTAMP
                 WHERE usuario_id = :uid AND papel = :papel AND ativo = 1'
            )->execute(['uid' => $updateUid, 'papel' => $papelInativar]);
        }
    }

    ebd_json_response([
        'ok' => true,
        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
        'id' => $updateUid,
        'message' => 'Cadastro inativado nas chamadas.',
    ]);
}

$nomeReal = trim((string) ($body['nome_real'] ?? $body['nome'] ?? ''));
$sexo = strtoupper(trim((string) ($body['sexo'] ?? '')));

if ($nomeReal === '' || !in_array($sexo, ['M', 'F'], true)) {
    ebd_json_response(['ok' => false, 'error' => 'Nome e sexo (M/F) são obrigatórios', 'code' => 'VALIDATION_ERROR'], 400);
}

$dataNascimento = parse_date_field($body['data_nascimento'] ?? null);
$dataMatricula = parse_date_field($body['data_matricula'] ?? null) ?? date('Y-m-d');

$email = trim((string) ($body['email'] ?? ''));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ebd_json_response(['ok' => false, 'error' => 'E-mail inválido', 'code' => 'VALIDATION_ERROR'], 400);
}

$nivel = !empty($body['cadastrar_como_professor']) ? 'professor' : 'sem_login';

$congregacaoId = isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : null;

if ($updateUid <= 0) {
    if ($nivel === 'sem_login' && (!isset($body['turma_id']) || (int) $body['turma_id'] <= 0)) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Alunos devem ser matriculados numa turma. Indique turma_id.',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }

    if ($nivel === 'professor' && (!isset($body['turma_id']) || (int) $body['turma_id'] <= 0)) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Professores devem ser vinculados a uma turma. Indique turma_id.',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    ebd_json_response(['ok' => false, 'error' => 'Servidor indisponível', 'code' => 'DB_UNAVAILABLE'], 503);
}

require_once dirname(__DIR__) . '/auth/bearer.php';
$auth = ebd_require_authenticated_user($pdo);

if ($updateUid > 0) {
    $congregacaoId = ebd_resolve_congregacao_scope(
        $pdo,
        $auth,
        isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0,
    );

    $usuario = ebd_fetch_usuario_in_congregacao($pdo, $updateUid, $congregacaoId);
    if ($usuario === false) {
        ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
    }

    $nivel = strtolower((string) ($usuario['nivel_acesso'] ?? 'sem_login'));
    $ativos = ebd_fetch_active_aluno_vinculos($pdo, $updateUid);

    $pdo->prepare(
        <<<'SQL'
UPDATE usuarios SET
    nome_real = :nome_real,
    sexo = :sexo,
    data_nascimento = :data_nascimento,
    telefone = :telefone,
    email = :email,
    escolaridade = :escolaridade,
    estado_civil = :estado_civil,
    logradouro = :logradouro,
    numero = :numero,
    bairro = :bairro,
    cidade = :cidade,
    estado = :estado,
    responsavel_1_nome = :r1n,
    responsavel_1_tel = :r1t,
    responsavel_2_nome = :r2n,
    responsavel_2_tel = :r2t
WHERE id = :id
SQL
    )->execute([
        'nome_real' => $nomeReal,
        'sexo' => $sexo,
        'data_nascimento' => $dataNascimento,
        'telefone' => nullify_empty($body['telefone'] ?? null),
        'email' => $email !== '' ? $email : null,
        'escolaridade' => nullify_empty($body['escolaridade'] ?? null),
        'estado_civil' => nullify_empty($body['estado_civil'] ?? null),
        'logradouro' => nullify_empty($body['logradouro'] ?? null),
        'numero' => nullify_empty($body['numero'] ?? null),
        'bairro' => nullify_empty($body['bairro'] ?? null),
        'cidade' => nullify_empty($body['cidade'] ?? null),
        'estado' => nullify_empty($body['estado'] ?? null),
        'r1n' => nullify_empty($body['responsavel_1_nome'] ?? null),
        'r1t' => nullify_empty($body['responsavel_1_tel'] ?? null),
        'r2n' => nullify_empty($body['responsavel_2_nome'] ?? null),
        'r2t' => nullify_empty($body['responsavel_2_tel'] ?? null),
        'id' => $updateUid,
    ]);

    if ($nivel === 'professor') {
        $profAtivos = ebd_fetch_active_professor_vinculos($pdo, $updateUid);
        $newTid = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;
        try {
            ebd_apply_turma_vinculo_change($pdo, $auth, $updateUid, $profAtivos, $newTid, 'professor');
        } catch (Throwable $e) {
            ebd_json_response(['ok' => false, 'error' => 'Erro ao atualizar cadastro', 'code' => 'STORE_FAILED'], 500);
        }
        ebd_json_response([
            'ok' => true,
            'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
            'id' => $updateUid,
            'message' => 'Cadastro atualizado.',
        ]);
    }

    if (ebd_usuario_is_protected_staff($usuario)) {
        ebd_json_response([
            'ok' => true,
            'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
            'id' => $updateUid,
            'message' => 'Cadastro atualizado.',
        ]);
    }

    $newTid = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;

    try {
        ebd_apply_turma_vinculo_change($pdo, $auth, $updateUid, $ativos, $newTid, 'aluno');
    } catch (Throwable $e) {
        ebd_json_response(['ok' => false, 'error' => 'Erro ao atualizar cadastro', 'code' => 'STORE_FAILED'], 500);
    }

    ebd_json_response([
        'ok' => true,
        'meta' => ['service' => EbdApiMeta::SERVICE, 'version' => EbdApiMeta::VERSION],
        'id' => $updateUid,
        'message' => 'Cadastro atualizado.',
    ]);
}

$congregacaoId = ebd_resolve_congregacao_scope(
    $pdo,
    $auth,
    isset($body['congregacao_id']) ? (int) $body['congregacao_id'] : 0,
);

$turmaIdOpt = isset($body['turma_id']) ? (int) $body['turma_id'] : 0;
if ($turmaIdOpt > 0) {
    $turmaRow = ebd_require_turma_in_scope($pdo, $auth, $turmaIdOpt);
    if ($turmaRow['congregacao_id'] !== $congregacaoId) {
        ebd_json_response([
            'ok' => false,
            'error' => 'A turma não pertence à sua igreja',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }
}

$insert = <<<'SQL'
INSERT INTO usuarios (
    congregacao_id, nome_real, sexo, data_nascimento, telefone, email, senha,
    escolaridade, estado_civil, logradouro, numero, bairro, cidade, estado,
    responsavel_1_nome, responsavel_1_tel, responsavel_2_nome, responsavel_2_tel,
    data_matricula, is_admin, nivel_acesso
) VALUES (
    :congregacao_id, :nome_real, :sexo, :data_nascimento, :telefone, :email, NULL,
    :escolaridade, :estado_civil, :logradouro, :numero, :bairro, :cidade, :estado,
    :r1n, :r1t, :r2n, :r2t,
    :data_matricula, 0, :nivel_acesso
)
SQL;

$params = [
    'congregacao_id' => $congregacaoId,
    'nome_real' => $nomeReal,
    'sexo' => $sexo,
    'data_nascimento' => $dataNascimento,
    'telefone' => nullify_empty($body['telefone'] ?? null),
    'email' => $email !== '' ? $email : null,
    'escolaridade' => nullify_empty($body['escolaridade'] ?? null),
    'estado_civil' => nullify_empty($body['estado_civil'] ?? null),
    'logradouro' => nullify_empty($body['logradouro'] ?? null),
    'numero' => nullify_empty($body['numero'] ?? null),
    'bairro' => nullify_empty($body['bairro'] ?? null),
    'cidade' => nullify_empty($body['cidade'] ?? null),
    'estado' => nullify_empty($body['estado'] ?? null),
    'r1n' => nullify_empty($body['responsavel_1_nome'] ?? null),
    'r1t' => nullify_empty($body['responsavel_1_tel'] ?? null),
    'r2n' => nullify_empty($body['responsavel_2_nome'] ?? null),
    'r2t' => nullify_empty($body['responsavel_2_tel'] ?? null),
    'data_matricula' => $dataMatricula,
    'nivel_acesso' => $nivel,
];

$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare($insert);
    $stmt->execute($params);
    $id = (int) $pdo->lastInsertId();

    if ($turmaIdOpt > 0 && $id > 0) {
        $papel = $nivel === 'professor' ? 'professor' : 'aluno';
        $vSql = <<<'SQL'
INSERT INTO vinculos_turma (usuario_id, turma_id, papel, ativo, data_inicio)
VALUES (:uid, :tid, :papel, 1, CURDATE())
ON DUPLICATE KEY UPDATE
    ativo = 1,
    data_fim = NULL,
    updated_at = CURRENT_TIMESTAMP
SQL;
        $vStmt = $pdo->prepare($vSql);
        $vStmt->execute([
            'uid' => $id,
            'tid' => $turmaIdOpt,
            'papel' => $papel,
        ]);
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    $sqlState = $e->errorInfo[0] ?? '';
    if ($sqlState === '23000') {
        ebd_json_response([
            'ok' => false,
            'error' => 'E-mail já registado ou dados em conflito',
            'code' => 'DUPLICATE_ENTRY',
        ], 409);
    }
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar cadastro', 'code' => 'STORE_FAILED'], 500);
} catch (Throwable $e) {
    $pdo->rollBack();
    ebd_json_response(['ok' => false, 'error' => 'Erro ao guardar cadastro', 'code' => 'STORE_FAILED'], 500);
}

ebd_json_response([
    'ok' => true,
    'meta' => [
        'service' => EbdApiMeta::SERVICE,
        'version' => EbdApiMeta::VERSION,
    ],
    'id' => $id,
    'message' => 'Cadastro criado',
]);

/**
 * @param mixed $value
 */
function nullify_empty(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    $s = trim((string) $value);

    return $s === '' ? null : $s;
}

/**
 * Aceita "Y-m-d" ou null.
 *
 * @param mixed $value
 */
function parse_date_field(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    $s = trim((string) $value);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) !== 1) {
        return null;
    }

    return $s;
}
