<?php

declare(strict_types=1);

/**
 * RF45 — máscara do e-mail para exibição.
 */
function ebd_mask_email(string $email): string
{
    $email = trim($email);
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '***@***';
    }

    $parts = explode('@', $email, 2);
    $local = $parts[0];
    $domain = $parts[1] ?? '';

    $len = strlen($local);
    if ($len <= 1) {
        $masked = '*';
    } elseif ($len === 2) {
        $masked = $local[0] . '*';
    } else {
        $masked = $local[0] . str_repeat('*', min(5, $len - 2)) . $local[$len - 1];
    }

    return $masked . '@' . $domain;
}

/**
 * Texto "Encontramos sua conta @handle" — login_usuario ou parte local do e-mail.
 *
 * @param array<string, mixed> $row
 */
function ebd_conta_handle(array $row): string
{
    $login = trim((string) ($row['login_usuario'] ?? ''));
    if ($login !== '') {
        return $login;
    }

    $em = (string) ($row['email'] ?? '');
    $p = explode('@', $em, 2);

    return $p[0] !== '' ? $p[0] : 'conta';
}

/**
 * RN13 — concluir redefinição; devolve null em sucesso ou mensagem de erro.
 */
function ebd_complete_password_reset(PDO $pdo, string $plainToken, string $newPassword): ?string
{
    $plainToken = trim($plainToken);
    if (strlen($plainToken) !== 64 || !ctype_xdigit($plainToken)) {
        return 'Token inválido.';
    }

    if (strlen($newPassword) < 6) {
        return 'A nova senha deve ter pelo menos 6 caracteres.';
    }

    $hash = hash('sha256', $plainToken);

    $sql = <<<'SQL'
SELECT r.id, r.usuario_id, r.expires_at, r.used_at
FROM recuperacao_senhas r
INNER JOIN usuarios u ON u.id = r.usuario_id
WHERE r.token_hash = :h
  AND u.deleted_at IS NULL
LIMIT 1
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['h' => $hash]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        return 'Link inválido ou já utilizado.';
    }

    if (!empty($row['used_at'])) {
        return 'Este link já foi utilizado.';
    }

    if (strtotime((string) $row['expires_at']) < time()) {
        return 'Este link expirou. Solicite nova recuperação de senha.';
    }

    $recId = (int) $row['id'];
    $userId = (int) $row['usuario_id'];

    $senhaHash = password_hash($newPassword, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE usuarios SET senha = :s WHERE id = :id')->execute([
            's' => $senhaHash,
            'id' => $userId,
        ]);
        $pdo->prepare('DELETE FROM recuperacao_senhas WHERE id = :id')->execute(['id' => $recId]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();

        return 'Não foi possível atualizar a senha.';
    }

    return null;
}
