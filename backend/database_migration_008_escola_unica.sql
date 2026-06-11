-- EBD Prime — uma igreja por instalação (unificar linhas em `congregacoes`)
-- Executar no phpMyAdmin da Hostinger se existirem várias linhas em congregacoes.

SET @escola := (SELECT id FROM congregacoes ORDER BY id ASC LIMIT 1);

UPDATE usuarios SET congregacao_id = @escola WHERE congregacao_id IS NULL OR congregacao_id <> @escola;
UPDATE turmas SET congregacao_id = @escola WHERE congregacao_id IS NULL OR congregacao_id <> @escola;
UPDATE departamentos SET congregacao_id = @escola WHERE congregacao_id IS NULL OR congregacao_id <> @escola;

DELETE FROM congregacoes WHERE id <> @escola;
