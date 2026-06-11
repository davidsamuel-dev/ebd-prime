-- Cadastros inativados sem vínculo de turma + SMTP por congregação (recuperação de senha)
-- Execute uma vez na base existente.

CREATE TABLE IF NOT EXISTS `cadastros_ebd_inativos` (
    `usuario_id`   INT UNSIGNED NOT NULL,
    `papel`        ENUM('aluno','professor') NOT NULL,
    `inativado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`usuario_id`, `papel`),
    CONSTRAINT `fk_cad_ebd_inativos_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `congregacoes`
    ADD COLUMN `smtp_host` VARCHAR(255) NULL DEFAULT NULL,
    ADD COLUMN `smtp_port` SMALLINT UNSIGNED NULL DEFAULT 465,
    ADD COLUMN `smtp_secure` VARCHAR(16) NULL DEFAULT 'ssl',
    ADD COLUMN `smtp_user` VARCHAR(255) NULL DEFAULT NULL,
    ADD COLUMN `smtp_pass` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Senha SMTP (servidor)',
    ADD COLUMN `smtp_from_email` VARCHAR(255) NULL DEFAULT NULL,
    ADD COLUMN `smtp_from_name` VARCHAR(120) NULL DEFAULT 'EBD Prime',
    ADD COLUMN `password_reset_link_base` VARCHAR(512) NULL DEFAULT NULL;
