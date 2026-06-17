-- =====================================================================
-- EBD Prime — Migração 010 (phpMyAdmin / MySQL)
-- Manutenção de integridade: limpeza de tokens/códigos expirados e
-- preenchimento de escala_aulas para relatórios já existentes.
--
-- Quando usar:
--   • Execute UMA vez na base de produção (ex.: u370088447_ebd_prime).
--   • Idempotente: pode reexecutar sem duplicar escala (uk_escala_turma_data).
--
-- Nota: relatório em status "rascunho" com frequência gravada é fluxo
-- normal do app (chamada guardada antes do envio final) — não alteramos.
-- =====================================================================

SET NAMES utf8mb4;

-- 1) Tokens de API expirados (acúmulo por login sem limpeza)
DELETE FROM api_tokens WHERE expires_at < NOW();

-- 2) Códigos de recuperação de senha já usados ou expirados
DELETE FROM recuperacao_senhas WHERE used_at IS NOT NULL OR expires_at < NOW();

-- 3) Verificações de onboarding expiradas ou verificadas há mais de 7 dias
DELETE FROM onboarding_verifications
WHERE expires_at < NOW()
   OR (verified_at IS NOT NULL AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY));

-- 4) Relatórios sem linha correspondente em escala_aulas (backfill)
INSERT INTO escala_aulas (turma_id, data_aula, professor_usuario_id)
SELECT r.turma_id, r.data_aula, r.professor_usuario_id
FROM relatorios_aula r
LEFT JOIN escala_aulas e ON e.turma_id = r.turma_id AND e.data_aula = r.data_aula
WHERE e.id IS NULL;
