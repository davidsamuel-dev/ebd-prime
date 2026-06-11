# EBD Prime

Aplicativo mobile e ecossistema web para **gestão completa da Escola Bíblica Dominical** — turmas, cadastros, chamada, ofertas, relatórios e painel geral.

**Produção:** [ebd.adparaiso.com.br](https://ebd.adparaiso.com.br)

## Stack

| Camada | Tecnologias |
|--------|-------------|
| **Mobile** | React Native, Expo, TypeScript, Expo Router |
| **Backend** | PHP 8, PDO, REST/JSON, Composer |
| **Dados** | MySQL, migrations SQL |
| **Infra** | Hostinger, HTTPS, SMTP (PHPMailer), deploy FTP |

## Estrutura do repositório

```
ebd-prime/
├── mobile/          # App Expo (Android / iOS)
├── backend/         # API REST PHP + scripts
├── landing/         # Site institucional
├── scripts/         # Deploy FTP e utilitários
├── docs/            # Documentação e especificação
└── apresentacao-ifto/  # Slides da apresentação académica
```

## Começar em desenvolvimento

### 1. Clonar e instalar

```bash
git clone https://github.com/davidsamuel-dev/ebd-prime.git
cd ebd-prime
npm install
cd mobile && npm install && cd ..
```

### 2. Variáveis de ambiente (obrigatório)

Copie os exemplos — **nunca commite os ficheiros `.env` reais**:

```bash
# Backend (API local)
cp backend/.env.example backend/.env

# App mobile
cp mobile/.env.example mobile/.env
```

Para deploy na Hostinger (opcional, só na sua máquina):

```bash
cp backend/.env.deploy.example backend/.env.deploy
# Edite com as credenciais FTP do hPanel
```

### 3. Base de dados local (Docker)

```bash
npm run db:up
npm run db:import:docker
npm run db:seed:demo
```

### 4. Subir API e app

```bash
# Terminal 1 — API em http://localhost:8080
npm run api

# Terminal 2 — Expo
cd mobile && npx expo start
```

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run api` | Servidor PHP de desenvolvimento |
| `npm run db:seed:demo` | Dados fictícios para testes |
| `npm run deploy:hostinger` | Empacota e envia para Hostinger via FTP |
| `npm run build:apk` | Build APK Android (EAS) |
| `node scripts/verify-git-safe.mjs` | Verifica se há segredos antes do `git push` |

## Segurança — o que NÃO vai para o Git

O `.gitignore` exclui automaticamente:

- `backend/.env`, `.env.production`, `.env.deploy`
- `mobile/.env`
- `deploy/` (pacote gerado)
- `node_modules/`, `backend/vendor/`
- dumps SQL de produção (`u370088447_*.sql`)
- chaves, certificados e service accounts

Antes de cada push, execute:

```bash
node scripts/verify-git-safe.mjs
```

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ESTADO_DO_PROJETO.md](docs/ESTADO_DO_PROJETO.md) | Estado actual e backlog |
| [docs/DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md](docs/DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md) | Especificação do sistema |
| [docs/DEPLOY-HOSTINGER-FTP-AUTOMATICO.md](docs/DEPLOY-HOSTINGER-FTP-AUTOMATICO.md) | Deploy automático FTP |
| [docs/api_rest_ebd_prime.md](docs/api_rest_ebd_prime.md) | Endpoints da API REST |

## Autor

**David Samuel Dias de Jesus** — IFTO Campus Paraíso do Tocantins · 2026

Projeto académico — Linguagens e Técnicas de Programação 4.
