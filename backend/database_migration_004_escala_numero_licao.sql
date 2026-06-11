-- Número da lição (caderno / trimestre) — alinhado ao cadastro rápido na app.
ALTER TABLE `escala_aulas`
    ADD COLUMN `numero_licao` SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Número da lição' AFTER `data_aula`;
