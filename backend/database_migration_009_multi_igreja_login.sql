-- Multi-igreja na mesma base: login único por igreja (não global).
-- Executar uma vez no phpMyAdmin se o índice antigo ainda existir.

ALTER TABLE `usuarios` DROP INDEX `uk_usuarios_login_usuario`;

ALTER TABLE `usuarios`
    ADD UNIQUE KEY `uk_usuarios_congregacao_login` (`congregacao_id`, `login_usuario`);
