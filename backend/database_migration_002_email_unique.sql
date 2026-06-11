-- Opcional: garantir e-mail único para login (vários NULL permitidos no MySQL).
ALTER TABLE `usuarios`
  ADD UNIQUE KEY `uk_usuarios_email` (`email`);
