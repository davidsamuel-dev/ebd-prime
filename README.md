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
├── mobile/              # App Expo (Android / iOS)
├── backend/             # API REST PHP + scripts
├── landing/             # Site institucional
├── scripts/             # Deploy FTP e utilitários
├── docs/                # Documentação (PDF, requisitos, API)
└── apresentacao-ifto/   # Slides da apresentação académica
```

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/DOCUMENTACAO_APP_EBD_PRIME.pdf](docs/DOCUMENTACAO_APP_EBD_PRIME.pdf) | **Documentação completa** (entrega IFTO) |
| [docs/modelo-logico-dados.jpg](docs/modelo-logico-dados.jpg) | Modelo lógico de dados (ER) |
| [docs/requisitos.txt](docs/requisitos.txt) | Requisitos RF/RNF/RN e estado do projeto |
| [docs/api_rest_ebd_prime.md](docs/api_rest_ebd_prime.md) | Endpoints da API REST |
| [docs/DEPLOY-HOSTINGER-FTP-AUTOMATICO.md](docs/DEPLOY-HOSTINGER-FTP-AUTOMATICO.md) | Deploy para produção |

Índice completo: [docs/README.md](docs/README.md)

## Começar em desenvolvimento

### 1. Clonar e instalar

```bash
git clone https://github.com/davidsamuel-dev/ebd-prime.git
cd ebd-prime
npm install
cd mobile && npm install && cd ..
```

### 2. Variáveis de ambiente

Copie os exemplos — **nunca commite os ficheiros `.env` reais**:

```bash
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

Para deploy na Hostinger (opcional, só na sua máquina):

```bash
cp backend/.env.deploy.example backend/.env.deploy
```

### 3. Base de dados local (opcional)

Para testar a API no computador, use **MySQL instalado** (XAMPP, Laragon ou MariaDB) ou aponte o `backend/.env` para a base da Hostinger.

```bash
# Com cliente mysql no PATH (ex.: XAMPP)
npm run db:import

# Ou via PHP
npm run db:import:php
npm run db:seed:demo
```

### 4. Subir API e app

```bash
# Terminal 1 — API em http://localhost:8080
npm run api

# Terminal 2 — Expo (use a URL da API no mobile/.env)
cd mobile && npx expo start
```

Em desenvolvimento rápido, o app pode apontar directamente para **produção** (`EXPO_PUBLIC_API_URL=https://ebd.adparaiso.com.br`) sem base local.

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run api` | Servidor PHP de desenvolvimento |
| `npm run db:import` | Importa schema SQL (MySQL local) |
| `npm run db:seed:demo` | Dados fictícios para testes |
| `npm run deploy:hostinger` | Empacota e envia para Hostinger via FTP |
| `npm run build:apk` | Build APK Android (EAS) |
| `npm run verify:git` | Verifica se há segredos antes do `git push` |

## Segurança — o que NÃO vai para o Git

O `.gitignore` exclui automaticamente:

- `backend/.env`, `.env.production`, `.env.deploy`
- `mobile/.env`
- `deploy/` (pacote gerado)
- `node_modules/`, `backend/vendor/`
- dumps SQL de produção (`u370088447_*.sql`)

Antes de cada push:

```bash
npm run verify:git
```

## Autor

**David Samuel Dias de Jesus** — IFTO Campus Paraíso do Tocantins · 2026

Projeto académico — Linguagens e Técnicas de Programação 4.
