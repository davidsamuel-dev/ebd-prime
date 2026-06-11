# Deploy imediato — ebd.adparaiso.com.br

## Forma mais simples (recomendado) — FTP automático

Configure `backend/.env.deploy` uma vez e execute:

```powershell
cd "c:\EBD Prime"
npm install
npm run deploy:hostinger
```

Detalhes: **[DEPLOY-HOSTINGER-FTP-AUTOMATICO.md](./DEPLOY-HOSTINGER-FTP-AUTOMATICO.md)**

---

## 1. Gerar pacote no PC (manual)



```powershell

cd "c:\EBD Prime"

php backend/scripts/prepare-hostinger-deploy.php

```



Pasta gerada: `deploy/hostinger-ebd.adparaiso.com.br/` (já inclui `vendor/` e `.env` para o servidor).



## 2. Upload FTP / Gestor de ficheiros



1. hPanel → **Ficheiros** → pasta do subdomínio **ebd.adparaiso.com.br**.

2. Apagar ou mover a página padrão Hostinger (`index.html`, etc.).

3. Enviar **todo** o conteúdo de `deploy/hostinger-ebd.adparaiso.com.br/` para a **raiz** (deve existir `api/`, `lib/`, `vendor/`, `.env`, `index.php`).



## 3. Validar



- https://ebd.adparaiso.com.br/api/health.php → JSON `"ok": true`

- Login app: `admin` / `demo123` (após `npx expo start -c` no `mobile/`)



## 4. E-mail (redefinição de senha)



No `.env` **no servidor**, preencher:



```env

EBD_SMTP_PASS="senha_da_caixa_suporte"

```



Teste: `php backend/scripts/test-smtp.php seu@gmail.com` (no PC, com `.env` remoto ou após deploy).



## 5. App mobile



`mobile/.env` já aponta para `https://ebd.adparaiso.com.br`. Reiniciar Expo com cache limpo.

