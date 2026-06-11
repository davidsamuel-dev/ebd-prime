#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Insere 4 turmas fictícias com 10 alunos cada (MySQL local / Docker).
 *
 * Uso (na raiz do repositório):
 *   npm run db:seed:demo
 *   php backend/scripts/seed-demo-turmas-alunos.php
 *   php backend/scripts/seed-demo-turmas-alunos.php --congregacao-id=1
 *
 * Pré-requisitos: schema importado (npm run db:import) e MySQL a correr.
 */

require_once dirname(__DIR__) . '/db_connection.php';

$turmasDef = [
    ['sigla' => 'JGE', 'faixa' => 'Jovens', 'idade_min' => 18, 'idade_max' => 28],
    ['sigla' => 'JUN', 'faixa' => 'Juniores', 'idade_min' => 12, 'idade_max' => 17],
    ['sigla' => 'ADU', 'faixa' => 'Adultos', 'idade_min' => 35, 'idade_max' => 62],
    ['sigla' => 'INF', 'faixa' => 'Primários', 'idade_min' => 8, 'idade_max' => 11],
];

$primeirosM = [
    'João', 'Pedro', 'Lucas', 'Mateus', 'Gabriel', 'Rafael', 'Bruno', 'Felipe', 'Diego', 'André',
    'Carlos', 'Paulo', 'Marcos', 'Daniel', 'Leonardo', 'Gustavo', 'Henrique', 'Rodrigo', 'Thiago', 'Victor',
];
$primeirosF = [
    'Maria', 'Ana', 'Juliana', 'Fernanda', 'Patrícia', 'Camila', 'Larissa', 'Beatriz', 'Amanda', 'Carla',
    'Paula', 'Renata', 'Mariana', 'Gabriela', 'Letícia', 'Aline', 'Bruna', 'Débora', 'Eliane', 'Vanessa',
];
$sobrenomes = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida',
    'Nascimento', 'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Dias', 'Mendes', 'Barbosa',
];

$congregacaoId = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--congregacao-id=')) {
        $congregacaoId = (int) substr($arg, strlen('--congregacao-id='));
    }
}

try {
    $pdo = ebd_get_pdo();
} catch (Throwable $e) {
    fwrite(STDERR, "Erro MySQL: " . $e->getMessage() . "\n");
    fwrite(STDERR, "Confirme backend/.env e `npm run db:up` + `npm run db:import:docker`.\n");
    exit(1);
}

if ($congregacaoId === null || $congregacaoId <= 0) {
    $congregacaoId = (int) $pdo->query('SELECT id FROM congregacoes ORDER BY id ASC LIMIT 1')->fetchColumn();
}

if ($congregacaoId <= 0) {
    fwrite(STDERR, "Nenhuma congregação encontrada. Execute antes: npm run db:import\n");
    exit(1);
}

$stCid = $pdo->prepare('SELECT cidade FROM congregacoes WHERE id = :id LIMIT 1');
$stCid->execute(['id' => $congregacaoId]);
$cidade = (string) ($stCid->fetchColumn() ?: 'Palmas');

fwrite(STDOUT, "Congregação id={$congregacaoId} ({$cidade})\n");
fwrite(STDOUT, "A inserir 4 turmas × 10 alunos = 40 cadastros fictícios…\n\n");

$pdo->beginTransaction();

try {
    $insDepto = $pdo->prepare(
        'INSERT INTO departamentos (congregacao_id, nome, ordem) VALUES (:cid, :nome, 0)',
    );
    $selDepto = $pdo->prepare(
        'SELECT id FROM departamentos WHERE congregacao_id = :cid AND nome = :nome LIMIT 1',
    );
    $insTurma = $pdo->prepare(
        'INSERT INTO turmas (congregacao_id, departamento_id, nome_turma) VALUES (:cid, :did, :nome)',
    );
    $insUsuario = $pdo->prepare(
        'INSERT INTO usuarios (
            congregacao_id, nome_real, sexo, data_nascimento, telefone, email,
            escolaridade, cidade, estado, data_matricula, is_admin, nivel_acesso
        ) VALUES (
            :cid, :nome, :sexo, :dn, :tel, NULL,
            :esc, :cidade, :uf, CURDATE(), 0, \'sem_login\'
        )',
    );
    $insVinculo = $pdo->prepare(
        'INSERT INTO vinculos_turma (usuario_id, turma_id, papel, ativo, data_inicio)
         VALUES (:uid, :tid, \'aluno\', 1, CURDATE())
         ON DUPLICATE KEY UPDATE ativo = 1, data_fim = NULL',
    );

    $totalAlunos = 0;
    $turmaIdx = 0;

    foreach ($turmasDef as $def) {
        $turmaIdx++;
        $nomeTurma = $def['sigla'];
        $faixa = $def['faixa'];

        $selDepto->execute(['cid' => $congregacaoId, 'nome' => $faixa]);
        $deptoId = $selDepto->fetchColumn();
        if ($deptoId === false) {
            $insDepto->execute(['cid' => $congregacaoId, 'nome' => $faixa]);
            $deptoId = (int) $pdo->lastInsertId();
        } else {
            $deptoId = (int) $deptoId;
        }

        $insTurma->execute([
            'cid' => $congregacaoId,
            'did' => $deptoId,
            'nome' => $nomeTurma,
        ]);
        $turmaId = (int) $pdo->lastInsertId();

        fwrite(STDOUT, "Turma {$turmaIdx}: {$nomeTurma} • {$faixa} (id turma {$turmaId})\n");

        for ($i = 1; $i <= 10; $i++) {
            $sexo = ($i % 2 === 0) ? 'F' : 'M';
            $primeiro = $sexo === 'M'
                ? $primeirosM[($turmaIdx * 3 + $i) % count($primeirosM)]
                : $primeirosF[($turmaIdx * 5 + $i) % count($primeirosF)];
            $sobrenome = $sobrenomes[($turmaIdx * 7 + $i * 2) % count($sobrenomes)];
            $segundo = $sobrenomes[($turmaIdx + $i) % count($sobrenomes)];
            $nomeReal = "{$primeiro} {$sobrenome} {$segundo}";

            $idade = random_int($def['idade_min'], $def['idade_max']);
            $anoNasc = (int) date('Y') - $idade;
            $mes = random_int(1, 12);
            $dia = random_int(1, 28);
            $dataNasc = sprintf('%04d-%02d-%02d', $anoNasc, $mes, $dia);

            $ddd = '63';
            $tel = sprintf('(%s) 9%04d-%04d', $ddd, random_int(1000, 9999), random_int(1000, 9999));

            $insUsuario->execute([
                'cid' => $congregacaoId,
                'nome' => $nomeReal,
                'sexo' => $sexo,
                'dn' => $dataNasc,
                'tel' => $tel,
                'esc' => $idade < 15 ? 'Ensino fundamental' : ($idade < 25 ? 'Ensino médio' : 'Ensino superior'),
                'cidade' => $cidade,
                'uf' => 'TO',
            ]);
            $usuarioId = (int) $pdo->lastInsertId();

            $insVinculo->execute(['uid' => $usuarioId, 'tid' => $turmaId]);
            $totalAlunos++;
            fwrite(STDOUT, "   - {$nomeReal} ({$sexo}, {$idade} anos)\n");
        }
        fwrite(STDOUT, "\n");
    }

    $pdo->commit();

    fwrite(STDOUT, "Concluído: 4 turmas e {$totalAlunos} alunos inseridos.\n");
    fwrite(STDOUT, "Abra a app → Turmas / Cadastros para ver os dados.\n");
    exit(0);
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Falha ao inserir: ' . $e->getMessage() . "\n");
    exit(1);
}
