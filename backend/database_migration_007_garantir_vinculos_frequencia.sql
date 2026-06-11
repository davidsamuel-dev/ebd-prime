-- =====================================================================
-- EBD Prime — Migração 007 (phpMyAdmin / MySQL)
-- Garante as tabelas `vinculos_turma` e `frequencia` se ainda não existirem.
--
-- Quando usar:
--   • Base nova: prefira importar o ficheiro completo `database.sql`.
--   • Base antiga sem estas tabelas: execute este script UMA vez na base
--     correta (ex.: u370088447_ebd_prime).
--
-- Requisito: já existirem `usuarios`, `turmas`, `relatorios_aula` (como no
-- `database.sql` principal). Se faltar alguma tabela-mãe, importe antes o
-- `database.sql` completo.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `vinculos_turma` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id`      INT UNSIGNED NOT NULL,
    `turma_id`        INT UNSIGNED NOT NULL,
    `papel`           ENUM('aluno','professor') NOT NULL,
    `ativo`           TINYINT(1) NOT NULL DEFAULT 1,
    `data_inicio`     DATE DEFAULT NULL,
    `data_fim`        DATE DEFAULT NULL,
    `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_vinculo_usuario_turma_papel` (`usuario_id`, `turma_id`, `papel`),
    KEY `idx_vinculos_turma` (`turma_id`),
    KEY `idx_vinculos_papel` (`papel`, `ativo`),
    CONSTRAINT `fk_vinculos_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_vinculos_turma`
        FOREIGN KEY (`turma_id`) REFERENCES `turmas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `frequencia` (
    `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `relatorio_aula_id`   INT UNSIGNED NOT NULL,
    `usuario_id`          INT UNSIGNED NOT NULL COMMENT 'Aluno (deve estar vinculado à turma como aluno)',
    `presenca`            TINYINT(1) NOT NULL DEFAULT 0,
    `biblia`              TINYINT(1) NOT NULL DEFAULT 0,
    `revista`             TINYINT(1) NOT NULL DEFAULT 0,
    `pontuacao_total`     INT NOT NULL DEFAULT 0 COMMENT 'Somatório aplicado pela regra de negócio',
    `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_freq_relatorio_usuario` (`relatorio_aula_id`, `usuario_id`),
    KEY `idx_frequencia_usuario` (`usuario_id`),
    CONSTRAINT `fk_frequencia_relatorio`
        FOREIGN KEY (`relatorio_aula_id`) REFERENCES `relatorios_aula` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_frequencia_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
