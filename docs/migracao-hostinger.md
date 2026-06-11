# Migração da base de dados para a Hostinger (MySQL + API PHP)

O EBD Prime suporta **dois backends**. Hoje o app mobile está em **Firebase**; na Hostinger passa a usar **MySQL + API REST (PHP)** — é o desenho descrito em `docs/documentacao_ebd_prime.md` (ex.: `ebd.adparaiso.com.br`).

## O que vai para onde

| Componente | Onde fica na Hostinger |
|------------|-------------------------|
| **Base de dados** | MySQL remoto (hPanel → Bases de dados) |
| **API** | Pasta `backend/` no alojamento (PHP 8+, Apache) |
| **App mobile** | Continua na Expo; só muda o `.env` para apontar à API |

**Importante:** importar o `database.sql` cria a **estrutura** (tabelas vazias). Os dados que já estão no **Firebase não são copiados automaticamente** — ver secção [Dados do Firebase](#dados-que-estão-no-firebase).

---

## Passo 1 — Criar a base MySQL no hPanel

1. Entrar em [hPanel](https://hpanel.hostinger.com/) → **Websites** → o teu site.
2. **Bases de dados MySQL** → **Criar base de dados**.
3. Anotar:
   - **Nome da base** (ex.: `u123456789_ebd`)
   - **Utilizador** (ex.: `u123456789_ebduser`)
   - **Palavra-passe**
   - **Servidor MySQL** no hPanel: muitas vezes aparece `127.0.0.1:3306` — isso vale **só para PHP no mesmo servidor**. No teu PC usa o host do phpMyAdmin (ex.: `auth-db1664.hstgr.io`, sem `/index.php`).

### Ligação a partir do teu PC (opcional)

No hPanel: **Bases de dados** → **Remoto MySQL** → ativar e adicionar o **IP público** do teu PC (o erro `Access denied for user '…'@'SEU_IP'` indica que o MySQL remoto respondeu, mas o IP ainda não está autorizado ou a senha não coincide).

No `backend/.env` do PC:

```env
EBD_DB_HOST=auth-db1664.hstgr.io
EBD_DB_NAME=u370088447_ebd_prime
EBD_DB_USER=u370088447_adparaiso
EBD_DB_PASS="senha_com_#_entre_aspas"
```

No **servidor** (ficheiro `.env` via FTP), para a API PHP:

```env
EBD_DB_HOST=127.0.0.1
```

---

## Já tens base na Hostinger (`u370088447_ebd_prime`)

Se o phpMyAdmin já mostra as 11 tabelas (`usuarios`, `turmas`, `api_tokens`, etc.), **não** importes de novo o `database.sql` inteiro (apagaria dados).

Execute só o patch:

`backend/database_migration_hostinger_u370088447.sql`

No phpMyAdmin: base `u370088447_ebd_prime` → **SQL** → colar o ficheiro → Executar.

O que falta em relação ao app atual: sobretudo a coluna **`congregacoes.subtitulo`** (e opcionalmente `super_admin` no enum `nivel_acesso`).

---

## Passo 2 — Importar o schema (phpMyAdmin) — base NOVA ou vazia

1. hPanel → **phpMyAdmin** → selecionar a base criada.
2. Separador **Importar** → escolher o ficheiro:

   `backend/database.sql`

3. Executar. Deve criar todas as tabelas (`congregacoes`, `usuarios`, `turmas`, `api_tokens`, etc.).

> **Base já existente?** Não voltes a importar `database.sql` (apaga dados). Usa só os ficheiros `database_migration_*.sql` que ainda não tenhas aplicado.

**Alternativa (linha de comando, a partir do PC):**

```powershell
cd "c:\EBD Prime\backend"
php scripts/import-schema-hostinger.php
```

(Requer `backend/.env` já com credenciais da Hostinger e rede que permita ligação remota ao MySQL, se a Hostinger o permitir.)

---

## Passo 3 — Publicar a API PHP

### Ficheiros a enviar (FTP ou Gestor de ficheiros)

Enviar para a pasta do subdomínio (ex.: `public_html/ebd/` ou a raiz de `ebd.adparaiso.com.br`):

```
backend/
  api/              ← endpoints (health.php, auth/login.php, …)
  lib/
  vendor/           ← após `composer install` (ver abaixo)
  db_connection.php
  load_env.php
  ebd_normalize_request.php
  .env              ← criar no servidor (NÃO commitar)
```

**Não** enviar: `backend/.env` do teu PC com passwords locais — cria um `.env` **novo** no servidor (ver `backend/.env.hostinger.example`).

### Composer (PHPMailer)

No servidor (SSH) ou no PC antes do upload:

```bash
cd backend
composer install --no-dev
```

Envia a pasta `vendor/` completa.

### URL da API

Com a estrutura acima, o health check fica em:

`https://SEU-DOMINIO/api/health.php`

Exemplo da documentação: `https://ebd.adparaiso.com.br/api/health.php`

Resposta esperada: JSON com `"ok": true` e `"database": { "status": "up" }`.

---

## Passo 4 — Configurar `backend/.env` na Hostinger

Copia o modelo `backend/.env.hostinger.example` para `backend/.env` no servidor e preenche:

```env
EBD_DB_HOST=mysqlXXXX.hostinger.com
EBD_DB_PORT=3306
EBD_DB_NAME=u123456789_ebd
EBD_DB_CHARSET=utf8mb4
EBD_DB_USER=u123456789_ebduser
EBD_DB_PASS=sua_senha_segura

# Opcional: origem do Expo web em produção
EBD_CORS_ORIGIN=https://seu-dominio.com

# Recuperação de senha (SMTP Hostinger)
EBD_PASSWORD_RESET_LINK_BASE=https://SEU-DOMINIO/api/auth/reset-form.php
EBD_SMTP_HOST=smtp.hostinger.com
EBD_SMTP_PORT=465
EBD_SMTP_SECURE=ssl
EBD_SMTP_USER=email@seu-dominio.com
EBD_SMTP_PASS=senha_do_email
EBD_SMTP_FROM_EMAIL=email@seu-dominio.com
EBD_SMTP_FROM_NAME=EBD Prime
```

Testa no browser: `https://SEU-DOMINIO/api/health.php`

### E-mail — redefinição de senha (Hostinger Email)

1. hPanel → **E-mails** → criar caixa (ex.: `suporte@adparaiso.com.br`) e definir a **senha da caixa** (não é a senha do hPanel).
2. No `.env` do servidor (e no PC para testar):

| Variável | Valor |
|----------|--------|
| `EBD_SMTP_HOST` | `smtp.hostinger.com` |
| `EBD_SMTP_PORT` | `465` |
| `EBD_SMTP_SECURE` | `ssl` |
| `EBD_SMTP_USER` | e-mail completo (`suporte@adparaiso.com.br`) |
| `EBD_SMTP_PASS` | senha da caixa |
| `EBD_SMTP_FROM_EMAIL` | igual ao `EBD_SMTP_USER` |
| `EBD_PASSWORD_RESET_LINK_BASE` | `https://ebd.adparaiso.com.br/api/auth/reset-form.php` |

Se **465/SSL** falhar no PHPMailer, use porta **587** e `EBD_SMTP_SECURE=tls`.

3. Na pasta `backend/`, instalar dependências e testar (substitua o e-mail):

```powershell
cd "c:\EBD Prime\backend"
composer install --no-dev
cd ..
php backend/scripts/test-smtp.php seu@gmail.com
```

4. No app: **Esqueci minha senha** → utilizador `admin` ou `admin@demo.local` + e-mail `admin@demo.local` (conta demo na base).

**Receção (opcional):** IMAP `imap.hostinger.com:993` SSL — não é usado pela API, só para ler a caixa no telemóvel/Outlook.

---

## Passo 5 — Apontar o app mobile para a Hostinger

Edita `mobile/.env` (modelo: `mobile/.env.hostinger.example`):

```env
EXPO_PUBLIC_DATA_BACKEND=rest
EXPO_PUBLIC_API_URL=https://ebd.adparaiso.com.br

# Deixa vazio ou comenta as variáveis EXPO_PUBLIC_FIREBASE_* para não usar Firebase
```

Reinicia o bundler:

```powershell
cd mobile
npx expo start -c
```

No ecrã de login, a faixa de estado deve indicar **Servidor … MySQL OK**.

### Primeiro utilizador

Com a base vazia, cria a escola pelo fluxo **Cadastro de escola** no app ou insere manualmente em `usuarios` / `congregacoes` (com senha em hash `password_hash` no PHP).

Opcional em **desenvolvimento local** (não em produção): `backend/seed_demo.sql` — utilizador demo; ver comentários no ficheiro.

---

## Passo 6 — SSL e segurança

- Ativa **SSL** no domínio/subdomínio (Hostinger → SSL).
- Usa sempre `https://` em `EXPO_PUBLIC_API_URL`.
- Não commits `backend/.env` nem passwords no Git.

---

## Dados que estão no Firebase

### Exportação `gcloud` (o que o site do Google descreve)

```bash
gcloud firestore export gs://SEU-BUCKET/backups --project=ebd-madureira
```

- Exporta para **Cloud Storage** em formato **LevelDB** — **não** é SQL nem MySQL.
- Neste PC o comando `gcloud` **não está instalado**; terias de instalar o [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) e autenticar.
- Converter LevelDB → MySQL exige ferramentas extra; **não é o caminho usado neste projeto**.

### Caminho recomendado: script do repositório (Firestore → MySQL direto)

1. **Chave de conta de serviço** (uma vez):  
   Firebase Console → Definições do projeto → **Contas de serviço** → **Gerar nova chave privada**  
   → guardar como `backend/firebase-service-account.json` (já está no `.gitignore`).

2. **MySQL** com tabelas criadas (`database.sql` na Hostinger ou local).

3. **`backend/.env`** com credenciais MySQL (Hostinger ou Docker).

4. Na raiz do projeto:

```powershell
cd "c:\EBD Prime"
npm install
npm run migrate:firestore:dry
npm run migrate:firestore
```

- `--dry-run` só **lê** o Firestore e mostra contagens (não grava).
- Sem `--dry-run` faz **TRUNCATE** nas tabelas principais e **INSERT** dos documentos (mantém os IDs numéricos).

**Senhas de login:** no Firestore a senha de quem entra com Firebase Auth **não** fica no documento `usuarios`. Após migrar, administradores devem usar **Esqueci minha senha** (SMTP Hostinger) ou definir `senha` com `password_hash()` no PHP.

### Outras opções

1. **Começar limpo** na Hostinger (sem migrar dados).
2. **Manter Firebase** — não alterar `EXPO_PUBLIC_DATA_BACKEND`.

---

## Checklist rápido

- [ ] Base MySQL criada no hPanel
- [ ] `database.sql` importado no phpMyAdmin
- [ ] `backend/` publicado com `vendor/`
- [ ] `backend/.env` no servidor com host MySQL da Hostinger
- [ ] `https://…/api/health.php` responde OK
- [ ] `mobile/.env` com `rest` + `EXPO_PUBLIC_API_URL`
- [ ] `npx expo start -c` e login testado
- [ ] SMTP configurado (recuperação de senha), se necessário

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| `DB_UNAVAILABLE` no health | Host/porta/user/pass no `.env`; utilizador com permissão na base |
| App não liga à API | URL sem barra final; SSL ativo; telemóvel na mesma rede / DNS público |
| CORS no Expo web | Definir `EBD_CORS_ORIGIN` com o URL do Expo ou do site |
| 404 em `/api/...` | Confirmar que a pasta `api/` está no caminho certo do domínio |
