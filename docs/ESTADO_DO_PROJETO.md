# EBD Prime — Onde estamos e o que falta

Documento de referência rápida (actualizado em **19/05/2026**).

**Especificação completa (modelo IFTO):** [`DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md`](./DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md) · **Índice:** [`README.md`](./README.md) · **Alterações detalhadas:** [`CHANGELOG.md`](./CHANGELOG.md)

Detalhe de requisitos: `requisitos_ebd_prime_publico.txt` (leitura fácil) e `requisitos_ebd_prime.txt` (técnico).

---

## 1. O que já funciona (app + servidor)

| Área | Estado |
|------|--------|
| Login, logout | OK (REST MySQL/PHP — produção Hostinger) |
| **Recuperação de senha (e-mail)** | **OK** — SMTP Hostinger, link web, nova senha, retorno ao app |
| Cadastro de nova escola (onboarding) | OK (SMS real depende da configuração) |
| Turmas: listar, criar, **editar, remover** | OK (REST) |
| Cadastros: alunos/professores (criar/listar/editar/inativar) | OK (REST) |
| **Cadastros inativos** (listar, reativar, excluir, **seleção em lote**) | OK (REST) |
| Convite de admins, resumo turma, histórico, aniversariantes | OK (REST) |
| Início: saudação, checklist, escala; **alterar/remover aula** (long press) | OK |
| Nova aula + sessão de aula (chamada, oferta, relatório) | OK — **dados isolados por data/aula** |
| API PHP na Hostinger (`ebd.adparaiso.com.br`) | Em uso; deploy `npm run deploy:hostinger` |
| Firebase (Firestore + Auth) | Legado no código; produção = **REST** (`AUDITORIA-FIREBASE.md`) |

---

## 2. Onde paramos (prioridade agora)

1. **Painel “Geral”** — UI existe; parte dos rankings/gráficos ainda usa **dados de exemplo** até endpoint agregado completo.
2. **Dados de teste** — `npm run db:seed:demo` (local) ou scripts Hostinger.
3. **Regras finas** — “Todas as turmas enviaram” para desbloquear o Geral; permissões campo/filial; professor+aluno no mesmo horário.
4. **Site web** — export Expo web ainda não publicado na raiz do domínio (`DEPLOY-WEB-HOSTINGER.md`).

---

## 3. Backlog (não implementado)

- Notificações push  
- Exportar PDF / partilhar relatório  
- Tesouraria completa (além da oferta na aula)  
- Vídeos tutoriais reais no Início (placeholders)  
- Várias opções em Configurações ainda “Em breve”  
- Endurecer regras Firestore (legado)

---

## 4. Estrutura do repositório (enxuta)

```
EBD Prime/
├── mobile/          App Expo (React Native)
├── backend/         API PHP + MySQL + scripts
├── docs/            Documentação e requisitos
├── scripts/         Deploy FTP, migrações
├── firestore.rules  Regras Firebase (legado)
├── deploy/          Pacote gerado para Hostinger (não versionar)
└── package.json     Comandos npm (db, api, deploy)
```

---

## 5. Comandos úteis

| Comando | Uso |
|---------|-----|
| `npm run api` | API local (porta 8080) |
| `npm run db:up` + `npm run db:import:docker` | MySQL local + schema |
| `npm run db:seed:demo` | 4 turmas × 10 alunos fictícios (local) |
| `npm run deploy:hostinger` | Deploy completo FTP → Hostinger |
| `node scripts/ftp-upload-critical.mjs` | Upload rápido de PHP críticos |
| `php backend/scripts/prepare-hostinger-deploy.php` | Gerar pacote em `deploy/` |
| `cd mobile && npx expo start -c` | App com cache limpo |

---

## 6. Documentação — qual ficheiro ler

| Ficheiro | Para quem |
|----------|-----------|
| **`CHANGELOG.md`** | **O que mudou e quando** (histórico datado) |
| **`DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md`** | Especificação oficial (IFTO) |
| **`README.md`** | Índice da pasta `docs/` |
| `ESTADO_DO_PROJETO.md` | Este resumo |
| `api_rest_ebd_prime.md` | Endpoints REST |
| `DEPLOY-HOSTINGER-AGORA.md` / `DEPLOY-HOSTINGER-FTP-AUTOMATICO.md` | Publicar API |
| `DEPLOY-WEB-HOSTINGER.md` | Publicar site (Expo web) |
| `MULTI_IGREJA_UMA_BASE.md` | Multi-tenant por `congregacao_id` |
| `AUDITORIA-FIREBASE.md` | Firebase vs REST |

---

## 7. Segurança

- **Nunca** commitar `backend/.env`, `backend/.env.production` ou `mobile/.env` (senhas MySQL/SMTP/Firebase).
- SMTP de produção: configurado no `.env` do servidor Hostinger (conta `suporte@adparaiso.com.br`).
- Usar `backend/.env.example` e `mobile/.env.example` como modelo.
