-- Onboarding cadastro de nova escola / verificação SMS / endereço da congregação
-- Execute após as migrações anteriores.

SET NAMES utf8mb4;

ALTER TABLE `congregacoes`
  ADD COLUMN `logradouro` VARCHAR(255) NULL DEFAULT NULL AFTER `cidade`,
  ADD COLUMN `numero` VARCHAR(20) NULL DEFAULT NULL AFTER `logradouro`,
  ADD COLUMN `bairro` VARCHAR(120) NULL DEFAULT NULL AFTER `numero`,
  ADD COLUMN `estado` CHAR(2) NULL DEFAULT NULL COMMENT 'UF' AFTER `bairro`;

ALTER TABLE `usuarios`
  ADD COLUMN `login_usuario` VARCHAR(80) NULL DEFAULT NULL AFTER `email`;

CREATE UNIQUE INDEX `uk_usuarios_login_usuario` ON `usuarios` (`login_usuario`);

CREATE TABLE IF NOT EXISTS `onboarding_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone_e164` VARCHAR(20) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `verified_at` DATETIME NULL DEFAULT NULL,
  `pre_token` CHAR(64) NULL DEFAULT NULL,
  `pre_token_expires_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_onboarding_pre_token` (`pre_token`),
  KEY `idx_onboarding_phone` (`phone_e164`),
  KEY `idx_onboarding_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
