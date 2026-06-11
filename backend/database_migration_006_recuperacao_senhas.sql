-- Tokens de recuperação de senha (RF46/RN13)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `recuperacao_senhas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INT UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex do token',
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_recuperacao_token_hash` (`token_hash`),
    KEY `idx_recuperacao_usuario` (`usuario_id`),
    KEY `idx_recuperacao_expires` (`expires_at`),
    CONSTRAINT `fk_recuperacao_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
