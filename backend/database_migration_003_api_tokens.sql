-- Sessões mobile/API: token opaco armazenado como SHA-256 (nunca o valor em claro).
CREATE TABLE IF NOT EXISTS `api_tokens` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id`    INT UNSIGNED NOT NULL,
    `token_hash`    CHAR(64) NOT NULL COMMENT 'SHA-256 hex do token emitido',
    `expires_at`    DATETIME NOT NULL,
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_api_tokens_hash` (`token_hash`),
    KEY `idx_api_tokens_user` (`usuario_id`),
    KEY `idx_api_tokens_expires` (`expires_at`),
    CONSTRAINT `fk_api_tokens_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
