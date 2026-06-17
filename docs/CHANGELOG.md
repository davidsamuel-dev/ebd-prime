# Histórico de alterações — EBD Prime

Registo das funcionalidades e correções aplicadas no repositório e em produção (`https://ebd.adparaiso.com.br`).

**Última actualização:** 19/05/2026

---

## 19/05/2026 — Produção Hostinger, SMTP e correções REST

### Autenticação e recuperação de senha

| Funcionalidade | Descrição | Ficheiros principais |
|----------------|-----------|----------------------|
| **Esqueci a senha (REST)** | Fluxo completo: lookup → confirmação de e-mail → envio SMTP → link web → nova senha → retorno ao app | `api/auth/forgot-lookup.php`, `forgot-send.php`, `reset-form.php`, `mobile/app/esqueci-senha/` |
| **SMTP Hostinger** | Configuração interna no `.env` do servidor (`smtp.hostinger.com:465`, SSL, `suporte@adparaiso.com.br`); utilizadores finais **não** configuram SMTP | `backend/.env.production`, `lib/ebd_smtp_config.php`, `lib/ebd_mailer.php` |
| **PHPMailer** | Biblioteca em `vendor/`; caminho corrigido para `vendor/autoload.php` na raiz do site | `api/lib/ebd_mailer.php` |
| **Prioridade `.env`** | Credenciais SMTP do servidor têm prioridade sobre valores errados guardados na base por congregação | `ebd_smtp_config.php` |
| **Página web de nova senha** | Formulário HTML público; após guardar, botão e redirect `mobile://login` | `reset-form.php` |
| **Mensagens ao utilizador** | Erros técnicos de SMTP não pedem ao utilizador para ir às configurações | `forgot-send.php`, `esqueci-senha/index.tsx` |
| **Config. admin (opcional)** | Ecrã «E-mail do sistema» em Configurações — alternativa ao `.env`, só administrador | `mobile/app/smtp-config.tsx` |

**Migration:** `database_migration_009_inativos_sem_turma_smtp.sql` — colunas SMTP em `congregacoes` + tabela `cadastros_ebd_inativos`.

---

### Cadastros e inativos

| Funcionalidade | Descrição | Ficheiros principais |
|----------------|-----------|----------------------|
| **Inativar sem turma** | Inactivação grava em `cadastros_ebd_inativos` mesmo sem vínculo de turma | `usuarios/_helpers.php`, `inativar.php`, `store.php` |
| **Lista de cadastros** | Exclui inactivos da aba Cadastros; resiliente se tabela auxiliar não existir | `usuarios/list.php` |
| **Lista de inativos** | Endpoint dedicado com `turma_id_hint` | `usuarios/inativos-list.php` |
| **Reativar cadastro** | `ativar.php` + `ebd_ativar_cadastro_ebd` (aluno e professor) | `usuarios/ativar.php`, `_helpers.php` |
| **Seleção em lote (inativos)** | Menu ⋮, marcar tudo, excluir ou reativar vários | `mobile/app/cadastros-inativos.tsx` |
| **Relatório geral** | Exclui cadastros inactivos/removidos do agregado | `relatorios/geral-resumo.php` |

---

### Aulas, escala e sessão

| Funcionalidade | Descrição | Ficheiros principais |
|----------------|-----------|----------------------|
| **Dados isolados por aula** | Cada data/turma carrega chamada e relatório próprios; reset ao abrir nova aula | `mobile/app/aula-sessao.tsx` |
| **Sessão concluída** | Card verde quando chamada enviada; voltar ao hub após guardar | `aula-sessao.tsx` |
| **Alterar / remover aula** | Long press no Início → sheet REST (data, n.º lição) | `api/escala/update.php`, `delete.php`, `InicioPage.tsx` |
| **Chamada professores** | Removido `turma_nome` redundante na UI da chamada | `aula-sessao.tsx` |

---

### Turmas

| Funcionalidade | Descrição | Ficheiros principais |
|----------------|-----------|----------------------|
| **Editar turma (REST)** | `POST /api/turmas/store.php` com `turma_id` | `turmas/store.php`, `api.ts` |
| **Remover turma (REST)** | `POST /api/turmas/delete.php` (bloqueia se houver vínculos ou escala) | `turmas/delete.php`, `api.ts` |

---

### UI / UX (mobile)

| Alteração | Descrição |
|-----------|-----------|
| **Tema azul** | `Theme.primary` #0078D4 (substitui roxo) em ecrãs principais |
| **Haptics** | Feedback táctil em acções importantes (`mobile/lib/haptics.ts`) |
| **Long press** | Cards com animação + vibração (Início, Turmas, Cadastros, Inactivos) |
| **Overlay modal** | Cor de fundo alinhada ao tema |

---

### Deploy e infraestrutura

| Item | Descrição |
|------|-----------|
| **`npm run deploy:hostinger`** | Deploy FTP completo (api, lib, vendor, `.env`) |
| **`scripts/ftp-upload-critical.mjs`** | Upload rápido de ficheiros PHP críticos (usuarios, escala, turmas, auth, SMTP) |
| **`api/lib/`** | Módulos PHP partilhados deployáveis via FTP (contorna permissões em `/lib` na raiz) |
| **`ebd_require_lib()`** | Carregamento resiliente `api/lib` ou `lib/` na raiz | `api/bootstrap.php` |

---

## Estado anterior (referência — Maio 2026)

| Data | Versão doc. | Resumo |
|------|-------------|--------|
| 19/05/2026 | 2.0 | Especificação IFTO; multi-igreja; produção REST Hostinger |
| 19/05/2026 | 1.1 | Requisitos `requisitos_ebd_prime.txt` consolidados |

Funcionalidades já existentes antes desta leva (mantidas): login, onboarding escola, turmas (criar), cadastros CRUD, nova aula, sessão de aula, histórico, aniversariantes, resumo turma, convite admin, ausentes.

---

## 17/06/2026 — Entrega final (IFTO)

- Documentação consolidada em `docs/DOCUMENTACAO_APP_EBD_PRIME.pdf`
- Modelo lógico de dados em `docs/modelo-logico-dados.jpg`
- Limpeza de documentos legados e remoção do Docker (dev local via XAMPP/Laragon ou API em produção)
- `docs/requisitos.txt` como resumo executivo RF/RNF/RN

---

## Próximos passos (ver `docs/requisitos.txt` secção 8)

- Gate Geral quando todas as turmas enviarem (RF042)
- Notificações push, exportação PDF, tesouraria completa
- Versão web espelhada do app (RF046)

---

*Ao implementar novas funcionalidades, acrescentar uma secção datada no topo deste ficheiro e actualizar `docs/requisitos.txt`.*
