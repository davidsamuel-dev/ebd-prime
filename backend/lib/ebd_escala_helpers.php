<?php

declare(strict_types=1);

/**
 * Garante linha em escala_aulas antes de criar/usar relatório da mesma turma/data.
 */
function ebd_ensure_escala_aula(
    PDO $pdo,
    int $turmaId,
    string $dataAula,
    ?int $professorUsuarioId = null,
): void {
    if ($turmaId <= 0 || $dataAula === '') {
        return;
    }

    $find = $pdo->prepare(
        'SELECT id FROM escala_aulas WHERE turma_id = :tid AND data_aula = :d LIMIT 1'
    );
    $find->execute(['tid' => $turmaId, 'd' => $dataAula]);

    if ($find->fetchColumn() !== false) {
        return;
    }

    $ins = $pdo->prepare(
        'INSERT INTO escala_aulas (turma_id, data_aula, professor_usuario_id) VALUES (:tid, :d, :pid)'
    );
    $ins->execute([
        'tid' => $turmaId,
        'd' => $dataAula,
        'pid' => $professorUsuarioId !== null && $professorUsuarioId > 0 ? $professorUsuarioId : null,
    ]);
}
