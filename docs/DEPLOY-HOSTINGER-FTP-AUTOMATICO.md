# Deploy automático — Hostinger (sem upload manual)

Um comando gera o pacote **e envia por FTP/FTPS** para `ebd.adparaiso.com.br`.

## Configuração (uma vez)

### 1. Credenciais FTP no hPanel

1. [hPanel](https://hpanel.hostinger.com/) → **Websites** → site do domínio.
2. **Ficheiros** → **Contas FTP** (ou FTP Accounts).
3. Anote **host**, **utilizador**, **palavra-passe** e a **pasta** do subdomínio `ebd.adparaiso.com.br` (caminho remoto).

### 2. Ficheiro local `backend/.env.deploy`

```powershell
cd "c:\EBD Prime"
copy backend\.env.deploy.example backend\.env.deploy
```

Edite `backend/.env.deploy`:

```env
HOSTINGER_FTP_HOST=ftp.adparaiso.com.br
HOSTINGER_FTP_PORT=21
HOSTINGER_FTP_USER=u370088447
HOSTINGER_FTP_PASS="sua_senha_ftp"
HOSTINGER_FTP_REMOTE_DIR=/domains/ebd.adparaiso.com.br/public_html
HOSTINGER_FTP_SECURE=true
```

A pasta `HOSTINGER_FTP_REMOTE_DIR` deve ser a **raiz** onde já está `api/`, `.env`, etc. (a mesma que usava no upload manual).

### 3. Produção local para o pacote

O script de empacotamento continua a usar `backend/.env.production` (senhas do servidor). Mantenha esse ficheiro atualizado.

### 4. Instalar dependência Node (raiz do projeto)

```powershell
npm install
```

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm run deploy:hostinger` | Gera pacote + envia tudo por FTP |
| `npm run deploy:hostinger:dry` | Só lista ficheiros (não envia) |
| `npm run deploy:hostinger:pack` | Só gera `deploy/hostinger-ebd.adparaiso.com.br/` |

Equivalente PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-hostinger.ps1
powershell -ExecutionPolicy Bypass -File scripts/deploy-hostinger.ps1 -DryRun
```

## Validar

Abra no browser:

https://ebd.adparaiso.com.br/api/health.php

Deve responder `"ok": true`.

## Problemas comuns

| Erro | Solução |
|------|---------|
| `Login authentication failed` | Utilizador/senha FTP errados no `.env.deploy` |
| `550 Can't change directory` | `HOSTINGER_FTP_REMOTE_DIR` incorreto — copie o caminho do gestor de ficheiros do hPanel |
| `Falta backend/.env.production` | Crie/copie `.env.production` antes do deploy |
| Timeout | Rede/firewall; tente `HOSTINGER_FTP_SECURE=false` ou confirme a porta 21 |

## Segurança

- `backend/.env.deploy` está no `.gitignore` — **não** commitar senhas FTP.
- FTPS (`HOSTINGER_FTP_SECURE=true`) é o recomendado na Hostinger.

## Fluxo resumido

```text
npm run deploy:hostinger
    → php prepare-hostinger-deploy.php  (pacote em deploy/...)
    → FTP upload para HOSTINGER_FTP_REMOTE_DIR
    → API atualizada no servidor
```

Guia rápido antigo (upload manual): [DEPLOY-HOSTINGER-AGORA.md](./DEPLOY-HOSTINGER-AGORA.md).
