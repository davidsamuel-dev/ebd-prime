<?php

declare(strict_types=1);

/**
 * @return array<string, mixed>|false
 */
function ebd_fetch_usuario_in_congregacao(PDO $pdo, int $usuarioId, int $congregacaoId): array|false
{
    $stmt = $pdo->prepare(
        'SELECT id, congregacao_id, nome_real, sexo, nivel_acesso, is_admin, deleted_at
         FROM usuarios
         WHERE id = :id AND congregacao_id = :cid
         LIMIT 1'
    );
    $stmt->execute(['id' => $usuarioId, 'cid' => $congregacaoId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false || !empty($row['deleted_at'])) {
        return false;
    }

    $row['id'] = (int) $row['id'];
    $row['congregacao_id'] = (int) $row['congregacao_id'];
    $row['is_admin'] = (int) ($row['is_admin'] ?? 0);

    return $row;
}

function ebd_usuario_is_protected_staff(array $usuario): bool
{
    if (((int) ($usuario['is_admin'] ?? 0)) === 1) {
        return true;
    }

    $nivel = strtolower((string) ($usuario['nivel_acesso'] ?? ''));

    return in_array($nivel, ['admin', 'secretario'], true);
}

/**
 * @return list<array<string, mixed>>
 */
function ebd_fetch_active_aluno_vinculos(PDO $pdo, int $usuarioId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, turma_id, ativo
         FROM vinculos_turma
         WHERE usuario_id = :uid AND papel = \'aluno\' AND ativo = 1'
    );
    $stmt->execute(['uid' => $usuarioId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/**
 * @return list<array<string, mixed>>
 */
function ebd_fetch_active_professor_vinculos(PDO $pdo, int $usuarioId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, turma_id, ativo
         FROM vinculos_turma
         WHERE usuario_id = :uid AND papel = \'professor\' AND ativo = 1'
    );
    $stmt->execute(['uid' => $usuarioId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/**
 * @param list<array<string, mixed>> $ativos
 */
function ebd_apply_turma_vinculo_change(
    PDO $pdo,
    array $auth,
    int $usuarioId,
    array $ativos,
    int $newTid,
    string $papel,
): void {
    if ($newTid <= 0) {
        return;
    }

    $currentTid = count($ativos) > 0 ? (int) $ativos[0]['turma_id'] : 0;
    if ($newTid === $currentTid) {
        return;
    }

    ebd_require_turma_in_scope($pdo, $auth, $newTid);

    $pdo->beginTransaction();
    try {
        if (count($ativos) > 0) {
            $pdo->prepare(
                'UPDATE vinculos_turma SET ativo = 0, data_fim = CURDATE(), updated_at = CURRENT_TIMESTAMP
                 WHERE usuario_id = :uid AND papel = :papel AND ativo = 1'
            )->execute(['uid' => $usuarioId, 'papel' => $papel]);
        }

        $findAny = $pdo->prepare(
            'SELECT id, ativo FROM vinculos_turma
             WHERE usuario_id = :uid AND turma_id = :tid AND papel = :papel
             LIMIT 1'
        );
        $findAny->execute(['uid' => $usuarioId, 'tid' => $newTid, 'papel' => $papel]);
        $existing = $findAny->fetch(PDO::FETCH_ASSOC);

        if ($existing !== false) {
            $pdo->prepare(
                'UPDATE vinculos_turma
                 SET ativo = 1, data_fim = NULL, data_inicio = COALESCE(data_inicio, CURDATE()), updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute(['id' => (int) $existing['id']]);
        } else {
            $pdo->prepare(
                'INSERT INTO vinculos_turma (usuario_id, turma_id, papel, ativo, data_inicio)
                 VALUES (:uid, :tid, :papel, 1, CURDATE())'
            )->execute(['uid' => $usuarioId, 'tid' => $newTid, 'papel' => $papel]);
        }

        ebd_desmarcar_cadastro_ebd_inativo($pdo, $usuarioId, $papel);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function ebd_papel_cadastro_ebd(string $nivelAcesso): string
{
    return strtolower($nivelAcesso) === 'professor' ? 'professor' : 'aluno';
}

function ebd_has_cadastros_ebd_inativos_table(PDO $pdo): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'cadastros_ebd_inativos'");
        $cached = $stmt !== false && $stmt->fetchColumn() !== false;
    } catch (Throwable) {
        $cached = false;
    }

    return $cached;
}

function ebd_sql_exclude_cadastros_ebd_inativos(string $usuarioAlias = 'u'): string
{
    return <<<SQL
  AND NOT EXISTS (
    SELECT 1 FROM cadastros_ebd_inativos ci
    WHERE ci.usuario_id = {$usuarioAlias}.id
      AND ci.papel = (CASE WHEN LOWER({$usuarioAlias}.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)
  )
SQL;
}

/**
 * Exclui cadastros marcados como inativos nas chamadas (aluno ou professor).
 */
function ebd_sql_exclude_cadastro_inativo_papel(string $usuarioAlias, string $papel): string
{
    $papelSql = $papel === 'professor' ? 'professor' : 'aluno';

    return <<<SQL
  AND NOT EXISTS (
    SELECT 1 FROM cadastros_ebd_inativos ci
    WHERE ci.usuario_id = {$usuarioAlias}.id
      AND ci.papel = '{$papelSql}'
  )
SQL;
}

function ebd_sql_exclude_cadastro_inativo_papel_if_table(PDO $pdo, string $usuarioAlias, string $papel): string
{
    if (!ebd_has_cadastros_ebd_inativos_table($pdo)) {
        return '';
    }

    return ebd_sql_exclude_cadastro_inativo_papel($usuarioAlias, $papel);
}

function ebd_sql_exclude_somente_vinculos_inativos(string $usuarioAlias = 'u'): string
{
    return <<<SQL
  AND NOT (
    EXISTS (
      SELECT 1 FROM vinculos_turma v
      WHERE v.usuario_id = {$usuarioAlias}.id
        AND v.papel = (CASE WHEN LOWER({$usuarioAlias}.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)
        AND v.ativo = 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM vinculos_turma v
      WHERE v.usuario_id = {$usuarioAlias}.id
        AND v.papel = (CASE WHEN LOWER({$usuarioAlias}.nivel_acesso) = 'professor' THEN 'professor' ELSE 'aluno' END)
        AND v.ativo = 1
    )
  )
SQL;
}

function ebd_is_cadastro_ebd_inativo(PDO $pdo, int $usuarioId, string $papel): bool
{
    if (!ebd_has_cadastros_ebd_inativos_table($pdo)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1 FROM cadastros_ebd_inativos WHERE usuario_id = :uid AND papel = :papel LIMIT 1'
    );
    $stmt->execute(['uid' => $usuarioId, 'papel' => $papel]);

    return $stmt->fetchColumn() !== false;
}

function ebd_marcar_cadastro_ebd_inativo(PDO $pdo, int $usuarioId, string $papel): void
{
    if (!ebd_has_cadastros_ebd_inativos_table($pdo)) {
        return;
    }

    $pdo->prepare(
        'INSERT INTO cadastros_ebd_inativos (usuario_id, papel)
         VALUES (:uid, :papel)
         ON DUPLICATE KEY UPDATE inativado_em = CURRENT_TIMESTAMP'
    )->execute(['uid' => $usuarioId, 'papel' => $papel]);
}

function ebd_desmarcar_cadastro_ebd_inativo(PDO $pdo, int $usuarioId, string $papel): void
{
    if (!ebd_has_cadastros_ebd_inativos_table($pdo)) {
        return;
    }

    $pdo->prepare(
        'DELETE FROM cadastros_ebd_inativos WHERE usuario_id = :uid AND papel = :papel'
    )->execute(['uid' => $usuarioId, 'papel' => $papel]);
}

/**
 * Reativa cadastro nas chamadas (aluno ou professor) com turma.
 */
function ebd_ativar_cadastro_ebd(
    PDO $pdo,
    array $auth,
    int $usuarioId,
    int $congregacaoId,
    int $turmaId,
    string $nomeReal = '',
): void {
    $usuario = ebd_fetch_usuario_in_congregacao($pdo, $usuarioId, $congregacaoId);
    if ($usuario === false) {
        ebd_json_response(['ok' => false, 'error' => 'Cadastro não encontrado', 'code' => 'NOT_FOUND'], 404);
    }

    if (ebd_usuario_is_protected_staff($usuario)) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Operação não permitida nesta conta.',
            'code' => 'FORBIDDEN',
        ], 403);
    }

    $papel = ebd_papel_cadastro_ebd((string) ($usuario['nivel_acesso'] ?? 'sem_login'));
    $ativos = $papel === 'professor'
        ? ebd_fetch_active_professor_vinculos($pdo, $usuarioId)
        : ebd_fetch_active_aluno_vinculos($pdo, $usuarioId);

    if (count($ativos) > 0) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Este cadastro já está ativo nas chamadas. Atualize a lista.',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }

    $turmaRow = ebd_require_turma_in_scope($pdo, $auth, $turmaId);
    if ($turmaRow['congregacao_id'] !== $congregacaoId) {
        ebd_json_response([
            'ok' => false,
            'error' => 'Turma inválida para esta congregação.',
            'code' => 'VALIDATION_ERROR',
        ], 400);
    }

    $pdo->beginTransaction();

    try {
        if ($nomeReal !== '') {
            $pdo->prepare('UPDATE usuarios SET nome_real = :n WHERE id = :id')->execute([
                'n' => $nomeReal,
                'id' => $usuarioId,
            ]);
        }

        $findAny = $pdo->prepare(
            'SELECT id FROM vinculos_turma
             WHERE usuario_id = :uid AND turma_id = :tid AND papel = :papel
             LIMIT 1'
        );
        $findAny->execute(['uid' => $usuarioId, 'tid' => $turmaId, 'papel' => $papel]);
        $existingId = $findAny->fetchColumn();

        if ($existingId !== false) {
            $pdo->prepare(
                'UPDATE vinculos_turma
                 SET ativo = 1, data_fim = NULL, data_inicio = COALESCE(data_inicio, CURDATE()), updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute(['id' => (int) $existingId]);
        } else {
            $pdo->prepare(
                'INSERT INTO vinculos_turma (usuario_id, turma_id, papel, ativo, data_inicio)
                 VALUES (:uid, :tid, :papel, 1, CURDATE())'
            )->execute(['uid' => $usuarioId, 'tid' => $turmaId, 'papel' => $papel]);
        }

        ebd_desmarcar_cadastro_ebd_inativo($pdo, $usuarioId, $papel);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        ebd_json_response(['ok' => false, 'error' => 'Erro ao ativar', 'code' => 'STORE_FAILED'], 500);
    }
}

/**
 * Inativa cadastro nas chamadas (com ou sem turma ativa).
 */
function ebd_inativar_cadastro_ebd(PDO $pdo, array $auth, int $usuarioId, int $congregacaoId): void
{
    $usuario = ebd_fetch_usuario_in_congregacao($pdo, $usuarioId, $congregacaoId);
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

    $nivel = strtolower((string) ($usuario['nivel_acesso'] ?? 'sem_login'));
    $papelInativar = ebd_papel_cadastro_ebd($nivel);
    $ativosInativar = $papelInativar === 'professor'
        ? ebd_fetch_active_professor_vinculos($pdo, $usuarioId)
        : ebd_fetch_active_aluno_vinculos($pdo, $usuarioId);

    if (count($ativosInativar) > 0) {
        $pdo->prepare(
            'UPDATE vinculos_turma SET ativo = 0, data_fim = CURDATE(), updated_at = CURRENT_TIMESTAMP
             WHERE usuario_id = :uid AND papel = :papel AND ativo = 1'
        )->execute(['uid' => $usuarioId, 'papel' => $papelInativar]);
    }

    try {
        ebd_marcar_cadastro_ebd_inativo($pdo, $usuarioId, $papelInativar);
    } catch (Throwable $e) {
        if (ebd_has_cadastros_ebd_inativos_table($pdo)) {
            ebd_json_response([
                'ok' => false,
                'error' => 'Erro ao gravar cadastro inativo.',
                'code' => 'DB_UNAVAILABLE',
            ], 503);
        }
    }
}

/**
 * Fragmento SQL: restringe linhas de frequência a chamada de alunos (não professores).
 */
function ebd_sql_frequencia_somente_alunos(string $fAlias = 'f', ?PDO $pdo = null): string
{
    $excludeInativos = '';
    if ($pdo !== null && ebd_has_cadastros_ebd_inativos_table($pdo)) {
        $excludeInativos = <<<'SQL'
AND NOT EXISTS (
    SELECT 1 FROM cadastros_ebd_inativos ci
    WHERE ci.usuario_id = u_fa.id AND ci.papel = 'aluno'
)
SQL;
    }

    return <<<SQL
INNER JOIN relatorios_aula ra_fa ON ra_fa.id = {$fAlias}.relatorio_aula_id
INNER JOIN usuarios u_fa ON u_fa.id = {$fAlias}.usuario_id AND u_fa.deleted_at IS NULL
INNER JOIN vinculos_turma v_fa
    ON v_fa.usuario_id = {$fAlias}.usuario_id
   AND v_fa.turma_id = ra_fa.turma_id
   AND v_fa.papel = 'aluno'
   AND v_fa.ativo = 1
   AND LOWER(u_fa.nivel_acesso) NOT IN ('professor', 'admin', 'secretario')
AND NOT EXISTS (
    SELECT 1 FROM vinculos_turma v_fp
    WHERE v_fp.usuario_id = {$fAlias}.usuario_id
      AND v_fp.turma_id = ra_fa.turma_id
      AND v_fp.papel = 'professor'
      AND v_fp.ativo = 1
)
AND NOT EXISTS (
    SELECT 1 FROM escala_aulas ea_fp
    WHERE ea_fp.turma_id = ra_fa.turma_id
      AND ea_fp.data_aula = ra_fa.data_aula
      AND ea_fp.professor_usuario_id = {$fAlias}.usuario_id
)
{$excludeInativos}
SQL;
}

function ebd_count_frequencia_alunos_relatorio(PDO $pdo, int $relatorioId, ?bool $presenca = null): int
{
    $sql = 'SELECT COUNT(*) FROM frequencia f ' . ebd_sql_frequencia_somente_alunos('f', $pdo)
        . ' WHERE f.relatorio_aula_id = :rid';
    if ($presenca === true) {
        $sql .= ' AND f.presenca = 1';
    } elseif ($presenca === false) {
        $sql .= ' AND f.presenca = 0';
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['rid' => $relatorioId]);

    return (int) $stmt->fetchColumn();
}
