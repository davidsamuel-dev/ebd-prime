-- Dados de teste — Hostinger / u370088447_ebd_prime
-- Senha de todos os utilizadores com login: demo123

INSERT INTO `congregacoes` (`nome`, `subtitulo`, `setor`, `cidade`, `bairro`, `estado`, `status`)
VALUES (
    'EBD Ad Paraíso (teste)',
    'Escola dominical — ambiente de demonstração',
    'Setor 1',
    'Paraíso',
    'Centro',
    'TO',
    'ativo'
);

SET @cid = LAST_INSERT_ID();

-- bcrypt demo123
SET @hash = '$2y$10$/6Tdre789NJTwRKRuw1OweOSpiCiRm5CeGMiDOBtnivYopzFAxJvu';

INSERT INTO `usuarios` (
    `congregacao_id`, `nome_real`, `sexo`, `email`, `login_usuario`, `senha`,
    `nivel_acesso`, `is_admin`, `data_matricula`
) VALUES
(@cid, 'Administrador Demo', 'M', 'admin@demo.local', 'admin', @hash, 'admin', 1, CURDATE()),
(@cid, 'Professor Demo', 'M', 'professor@demo.local', 'professor', @hash, 'professor', 0, CURDATE()),
(@cid, 'Secretário Demo', 'F', 'secretario@demo.local', 'secretario', @hash, 'secretario', 0, CURDATE());

SET @admin_id = (SELECT id FROM usuarios WHERE email = 'admin@demo.local' LIMIT 1);
SET @prof_id = (SELECT id FROM usuarios WHERE email = 'professor@demo.local' LIMIT 1);

INSERT INTO `departamentos` (`congregacao_id`, `nome`, `ordem`)
VALUES (@cid, 'Infantil', 1), (@cid, 'Adolescentes', 2);

SET @dept_inf = (SELECT id FROM departamentos WHERE congregacao_id = @cid AND nome = 'Infantil' LIMIT 1);

INSERT INTO `turmas` (`congregacao_id`, `departamento_id`, `nome_turma`)
VALUES
(@cid, @dept_inf, 'Berçário'),
(@cid, @dept_inf, 'Primários');

SET @turma_berc = (SELECT id FROM turmas WHERE congregacao_id = @cid AND nome_turma = 'Berçário' LIMIT 1);
SET @turma_prim = (SELECT id FROM turmas WHERE congregacao_id = @cid AND nome_turma = 'Primários' LIMIT 1);

INSERT INTO `usuarios` (
    `congregacao_id`, `nome_real`, `sexo`, `email`, `nivel_acesso`, `data_matricula`
) VALUES
(@cid, 'Aluno Ana Demo', 'F', 'aluno1@demo.local', 'sem_login', CURDATE()),
(@cid, 'Aluno Bruno Demo', 'M', 'aluno2@demo.local', 'sem_login', CURDATE()),
(@cid, 'Aluno Carla Demo', 'F', 'aluno3@demo.local', 'sem_login', CURDATE());

SET @aluno1 = (SELECT id FROM usuarios WHERE email = 'aluno1@demo.local' LIMIT 1);
SET @aluno2 = (SELECT id FROM usuarios WHERE email = 'aluno2@demo.local' LIMIT 1);
SET @aluno3 = (SELECT id FROM usuarios WHERE email = 'aluno3@demo.local' LIMIT 1);

INSERT INTO `vinculos_turma` (`usuario_id`, `turma_id`, `papel`, `ativo`, `data_inicio`)
VALUES
(@prof_id, @turma_berc, 'professor', 1, CURDATE()),
(@prof_id, @turma_prim, 'professor', 1, CURDATE()),
(@aluno1, @turma_berc, 'aluno', 1, CURDATE()),
(@aluno2, @turma_berc, 'aluno', 1, CURDATE()),
(@aluno3, @turma_prim, 'aluno', 1, CURDATE());

INSERT INTO `escala_aulas` (`turma_id`, `data_aula`, `numero_licao`, `professor_usuario_id`, `tema_licao`)
VALUES
(@turma_berc, CURDATE(), 12, @prof_id, 'Deus cuida de mim'),
(@turma_prim, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 13, @prof_id, 'Jesus e os discípulos');
