-- Adiciona subtítulo opcional da escola (ex.: linha abaixo do nome no resumo geral).
-- Execute uma vez na base existente: mysql ... < database_migration_004_congregacao_subtitulo.sql

ALTER TABLE `congregacoes`
    ADD COLUMN `subtitulo` VARCHAR(255) DEFAULT NULL COMMENT 'Linha abaixo do nome na app (opcional)' AFTER `nome`;
