-- =====================================================================
-- EBD Prime — Atualizar base EXISTENTE na Hostinger (u370088447_ebd_prime)
-- Comparado com backend/database.sql + app atual (mai/2026).
--
-- O teu dump u370088447_ebd_prime.sql já tem TODAS as tabelas:
--   congregacoes, usuarios, turmas, vinculos_turma, escala_aulas,
--   relatorios_aula, frequencia, departamentos, api_tokens,
--   onboarding_verifications, recuperacao_senhas
--
-- Falta só o que está abaixo (execute UMA vez no phpMyAdmin → SQL).
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1) Subtítulo da escola (Dados da escola, login, resumo Geral)
--    Sem isto: login.php e congregacao/get.php falham com "Unknown column subtitulo"
-- ---------------------------------------------------------------------
ALTER TABLE `congregacoes`
    ADD COLUMN IF NOT EXISTS `subtitulo` VARCHAR(255) DEFAULT NULL
        COMMENT 'Linha abaixo do nome na app (opcional)'
        AFTER `nome`;

-- ---------------------------------------------------------------------
-- 2) Opcional: nível super_admin (usado no Firebase / convites; PHP já trata)
--    Só necessário se guardares utilizadores com nivel_acesso = super_admin
-- ---------------------------------------------------------------------
ALTER TABLE `usuarios`
    MODIFY COLUMN `nivel_acesso` ENUM(
        'admin',
        'secretario',
        'professor',
        'sem_login',
        'super_admin'
    ) NOT NULL DEFAULT 'sem_login';

-- ---------------------------------------------------------------------
-- Verificação rápida (deve listar subtitulo em congregacoes)
-- ---------------------------------------------------------------------
-- SHOW COLUMNS FROM congregacoes LIKE 'subtitulo';
-- SHOW TABLES;
