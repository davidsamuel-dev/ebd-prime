-- =====================================================================
-- EBD Prime — Schema MySQL (utf8mb4)
-- Congregações, departamentos, turmas, usuários, escala, frequência e relatórios
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `frequencia`;
DROP TABLE IF EXISTS `relatorios_aula`;
DROP TABLE IF EXISTS `escala_aulas`;
DROP TABLE IF EXISTS `vinculos_turma`;
DROP TABLE IF EXISTS `turmas`;
DROP TABLE IF EXISTS `departamentos`;
DROP TABLE IF EXISTS `api_tokens`;
DROP TABLE IF EXISTS `recuperacao_senhas`;
DROP TABLE IF EXISTS `onboarding_verifications`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `congregacoes`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Congregações (sedes/filiais)
-- ---------------------------------------------------------------------
CREATE TABLE `congregacoes` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome`          VARCHAR(255) NOT NULL,
    `subtitulo`     VARCHAR(255) DEFAULT NULL COMMENT 'Linha abaixo do nome na app (opcional)',
    `setor`         VARCHAR(120) DEFAULT NULL,
    `cidade`        VARCHAR(120) DEFAULT NULL,
    `logradouro`    VARCHAR(255) DEFAULT NULL,
    `numero`        VARCHAR(20) DEFAULT NULL,
    `bairro`        VARCHAR(120) DEFAULT NULL,
    `estado`        CHAR(2) DEFAULT NULL COMMENT 'UF',
    `status`        ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
    `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_congregacoes_status` (`status`),
    KEY `idx_congregacoes_cidade` (`cidade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Usuários (cadastro conforme formulário / dicionário de dados + acesso)
-- ---------------------------------------------------------------------
CREATE TABLE `usuarios` (
    `id`                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `congregacao_id`        INT UNSIGNED DEFAULT NULL COMMENT 'Congregação de vínculo principal',
    `nome_real`             VARCHAR(255) NOT NULL COMMENT 'Nome completo (obrigatório)',
    `sexo`                  ENUM('M','F') NOT NULL,
    `data_nascimento`       DATE DEFAULT NULL,
    `telefone`              VARCHAR(40) DEFAULT NULL,
    `email`                 VARCHAR(255) DEFAULT NULL COMMENT 'Obrigatório na aplicação se o usuário tiver login',
    `login_usuario`         VARCHAR(80) DEFAULT NULL COMMENT 'Nome de utilizador para login (alternativa ao e-mail)',
    `senha`                 VARCHAR(255) DEFAULT NULL COMMENT 'Hash; apenas para quem acessa o app',
    `escolaridade`          VARCHAR(120) DEFAULT NULL,
    `estado_civil`          VARCHAR(80) DEFAULT NULL,
    `logradouro`            VARCHAR(255) DEFAULT NULL,
    `numero`                VARCHAR(20) DEFAULT NULL,
    `bairro`                VARCHAR(120) DEFAULT NULL,
    `cidade`                VARCHAR(120) DEFAULT NULL,
    `estado`                CHAR(2) DEFAULT NULL COMMENT 'UF',
    `responsavel_1_nome`    VARCHAR(255) DEFAULT NULL,
    `responsavel_1_tel`     VARCHAR(40) DEFAULT NULL,
    `responsavel_2_nome`    VARCHAR(255) DEFAULT NULL,
    `responsavel_2_tel`     VARCHAR(40) DEFAULT NULL,
    `data_matricula`        DATE DEFAULT NULL COMMENT 'Preenchido na criação do cadastro',
    `is_admin`              TINYINT(1) NOT NULL DEFAULT 0,
    `nivel_acesso`          ENUM('admin','secretario','professor','sem_login') NOT NULL DEFAULT 'sem_login',
    `deleted_at`            TIMESTAMP NULL DEFAULT NULL COMMENT 'Soft delete / cadastros inativos',
    `created_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_usuarios_congregacao` (`congregacao_id`),
    KEY `idx_usuarios_email` (`email`),
    KEY `idx_usuarios_nascimento` (`data_nascimento`),
    KEY `idx_usuarios_deleted` (`deleted_at`),
    UNIQUE KEY `uk_usuarios_email` (`email`),
    UNIQUE KEY `uk_usuarios_login_usuario` (`login_usuario`),
    CONSTRAINT `fk_usuarios_congregacao`
        FOREIGN KEY (`congregacao_id`) REFERENCES `congregacoes` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Verificação SMS onboarding (cadastro nova escola)
-- ---------------------------------------------------------------------
CREATE TABLE `onboarding_verifications` (
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

-- ---------------------------------------------------------------------
-- Recuperação de senha (RF46 / RN13)
-- ---------------------------------------------------------------------
CREATE TABLE `recuperacao_senhas` (
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

-- ---------------------------------------------------------------------
-- Tokens de API (sessão mobile / Bearer)
-- ---------------------------------------------------------------------
CREATE TABLE `api_tokens` (
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

-- ---------------------------------------------------------------------
-- Departamentos (ex.: Infantil, Adolescentes, Adultos) por congregação
-- ---------------------------------------------------------------------
CREATE TABLE `departamentos` (
    `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `congregacao_id`    INT UNSIGNED NOT NULL,
    `nome`              VARCHAR(120) NOT NULL,
    `ordem`             SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_depto_congregacao_nome` (`congregacao_id`, `nome`),
    KEY `idx_departamentos_congregacao` (`congregacao_id`),
    CONSTRAINT `fk_departamentos_congregacao`
        FOREIGN KEY (`congregacao_id`) REFERENCES `congregacoes` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Turmas
-- ---------------------------------------------------------------------
CREATE TABLE `turmas` (
    `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `congregacao_id`    INT UNSIGNED NOT NULL,
    `departamento_id`   INT UNSIGNED DEFAULT NULL,
    `nome_turma`        VARCHAR(120) NOT NULL,
    `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_turmas_congregacao` (`congregacao_id`),
    KEY `idx_turmas_departamento` (`departamento_id`),
    CONSTRAINT `fk_turmas_congregacao`
        FOREIGN KEY (`congregacao_id`) REFERENCES `congregacoes` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_turmas_departamento`
        FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Vínculos usuário × turma (papéis: aluno / professor — RF18)
-- ---------------------------------------------------------------------
CREATE TABLE `vinculos_turma` (
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

-- ---------------------------------------------------------------------
-- Escala de aulas (professor cadastrado ou visitante — RF16)
-- ---------------------------------------------------------------------
CREATE TABLE `escala_aulas` (
    `id`                            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `turma_id`                      INT UNSIGNED NOT NULL,
    `data_aula`                     DATE NOT NULL,
    `numero_licao`                  SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Número da lição',
    `professor_usuario_id`          INT UNSIGNED DEFAULT NULL,
    `professor_visitante_nome`      VARCHAR(255) DEFAULT NULL,
    `tema_licao`                    VARCHAR(255) DEFAULT NULL,
    `created_at`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_escala_turma_data` (`turma_id`, `data_aula`),
    KEY `idx_escala_professor_usuario` (`professor_usuario_id`),
    KEY `idx_escala_data` (`data_aula`),
    CONSTRAINT `fk_escala_turma`
        FOREIGN KEY (`turma_id`) REFERENCES `turmas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_escala_professor_usuario`
        FOREIGN KEY (`professor_usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Regra de negócio (RF16): professor cadastrado OU nome de visitante — validar na aplicação.

-- ---------------------------------------------------------------------
-- Relatório da aula (cabeçalho: contagens pedagógicas, oferta, observações — RF28–RF30)
-- ---------------------------------------------------------------------
CREATE TABLE `relatorios_aula` (
    `id`                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `turma_id`              INT UNSIGNED NOT NULL,
    `professor_usuario_id`  INT UNSIGNED DEFAULT NULL COMMENT 'Quem ministrou / enviou',
    `data_aula`             DATE NOT NULL,
    `tema_licao`            VARCHAR(255) DEFAULT NULL,
    `total_biblias`         INT UNSIGNED NOT NULL DEFAULT 0,
    `total_revistas`        INT UNSIGNED NOT NULL DEFAULT 0,
    `total_visitantes`      INT UNSIGNED NOT NULL DEFAULT 0,
    `valor_oferta`          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `observacoes`           TEXT,
    `status`                ENUM('rascunho','enviado') NOT NULL DEFAULT 'rascunho',
    `created_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_relatorio_turma_data` (`turma_id`, `data_aula`),
    KEY `idx_relatorios_professor` (`professor_usuario_id`),
    KEY `idx_relatorios_status` (`status`),
    CONSTRAINT `fk_relatorios_turma`
        FOREIGN KEY (`turma_id`) REFERENCES `turmas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_relatorios_professor`
        FOREIGN KEY (`professor_usuario_id`) REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Frequência (detalhe por aluno ligado ao relatório da aula)
-- ---------------------------------------------------------------------
CREATE TABLE `frequencia` (
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
