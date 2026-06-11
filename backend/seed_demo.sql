-- Dados mínimos para testar login na API (após importar database.sql)
-- Senha do utilizador demo: demo123  (hash bcrypt gerado em PHP)

INSERT INTO `congregacoes` (`nome`, `setor`, `cidade`, `status`)
VALUES ('Congregação Demo', 'Centro', 'São Paulo', 'ativo');

SET @cid = LAST_INSERT_ID();

INSERT INTO `usuarios` (
    `congregacao_id`,
    `nome_real`,
    `sexo`,
    `email`,
    `senha`,
    `nivel_acesso`,
    `data_matricula`
) VALUES (
    @cid,
    'Administrador Demo',
    'M',
    'admin@demo.local',
    '$2y$10$/6Tdre789NJTwRKRuw1OweOSpiCiRm5CeGMiDOBtnivYopzFAxJvu',
    'admin',
    CURDATE()
);
