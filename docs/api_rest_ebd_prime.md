# API REST — EBD Prime

Anexo técnico da documentação: [`DOCUMENTACAO_APP_EBD_PRIME.pdf`](./DOCUMENTACAO_APP_EBD_PRIME.pdf) e [`requisitos.txt`](./requisitos.txt).

Documentação de referência do backend PHP (PDO + MySQL), alinhada com `backend/openapi.yaml` e com a constante `EbdApiMeta::VERSION` em `backend/api/meta.php`.

## Visão geral

| Item | Valor |
|------|--------|
| Formato | JSON UTF-8 |
| Versão da API | `1.0.0` (ver `meta.php` / OpenAPI) |
| Autenticação nas rotas atuais | Nenhuma por cabeçalho; login devolve dados do utilizador (evolução futura: JWT ou sessão com token) |
| CORS | `Access-Control-Allow-Origin`: `*` por defeito; em produção definir `EBD_CORS_ORIGIN` (ver `backend/.env.example`) |

## Convenções de resposta

### Sucesso genérico

Objetos incluem `ok: true`. Endpoints de escrita podem incluir `meta: { service, version }`.

### Erro

```json
{
  "ok": false,
  "error": "Mensagem legível para humanos",
  "code": "CODIGO_ESTAVEL"
}
```

Códigos úteis: `VALIDATION_ERROR`, `AUTH_INVALID`, `DB_UNAVAILABLE`, `METHOD_NOT_ALLOWED`, `INVALID_JSON`, `NO_CONGREGACAO`, `DUPLICATE_ENTRY`, `STORE_FAILED`, `NOT_FOUND`.

## Endpoints

### `GET /api/health.php`

Verificação de disponibilidade (HTTP + MySQL). Não expõe segredos.

- **200**: `ok: true`, `database.status: "up"`, `database.latency_ms` opcional.
- **503**: `ok: false` quando a base de dados não responde; corpo inclui `database.status: "down"` e `database.error_code`.

Cache: `Cache-Control: no-store`.

### `POST /api/auth/login.php`

Corpo JSON:

```json
{
  "usuario": "admin@demo.local",
  "senha": "demo123"
}
```

Sinónimos aceites: `email` / `password`.

- **200**: `ok: true`, `meta`, `user` (sem campo `senha`).
- **401**: credenciais inválidas ou conta com `deleted_at` (`code`: `AUTH_INVALID`).
- **503**: PDO indisponível (`code`: `DB_UNAVAILABLE`).

### `POST /api/usuarios/store.php`

Cria linha em `usuarios`. Campos obrigatórios: `nome_real`, `sexo` (`M` ou `F`). Ver exemplos no OpenAPI.

- **200**: `ok: true`, `meta`, `id` (último insert).
- **409**: violação de unicidade (ex. e-mail) — `code`: `DUPLICATE_ENTRY`.

### `GET /api/turmas/list.php`

Lista turmas de uma congregação (contagem de alunos ativos via `vinculos_turma`).

Query opcional: `congregacao_id`. Se omitido ou inválido, usa a primeira congregação da base.

Resposta: `ok`, `meta`, `congregacao_id`, `turmas[]` com `id`, `nome_turma`, `departamento_nome`, `alunos_count`, etc.

### `POST /api/turmas/store.php`

Cria uma turma. Corpo JSON: `nome_turma` (obrigatório), `congregacao_id` opcional, `departamento_id` ou `departamento_nome` opcional.

Com `turma_id` > 0 no corpo: **actualiza** turma existente (nome, departamento).

### `POST /api/turmas/delete.php`

Remove turma. Corpo: `{ "turma_id": number }`. Falha se existirem vínculos (alunos/professores) ou aulas na escala.

### `POST /api/auth/forgot-lookup.php`

Corpo: `{ "usuario": "login ou e-mail" }`. Resposta: `masked_email`, `conta_handle` (sem expor e-mail completo).

### `POST /api/auth/forgot-send.php`

Corpo: `{ "usuario", "email" }` — e-mail deve coincidir com o registado. Envia link de redefinição via SMTP (configuração no `.env` do servidor).

### `GET|POST /api/auth/reset-form.php`

Página HTML pública (link do e-mail). POST: `token`, `nova_senha`, `nova_senha_confirm`. Redireciona para o app (`mobile://login`).

### `GET /api/congregacao/smtp-get.php` · `POST /api/congregacao/smtp-update.php`

Configuração SMTP opcional por congregação (admin). Em produção, o `.env` do servidor tem prioridade quando `EBD_SMTP_PASS` está definido.

### `GET /api/usuarios/inativos-list.php`

Lista cadastros inactivos da congregação (para ecrã Configurações → Cadastros inativos).

### `POST /api/usuarios/inativar.php` · `POST /api/usuarios/ativar.php`

Inactivar / reactivar cadastro EBD (aluno ou professor).

### `POST /api/escala/update.php` · `POST /api/escala/delete.php`

Alterar data/n.º lição ou remover aula da escala.

### `GET /api/usuarios/list.php`

Lista utilizadores não apagados (`deleted_at IS NULL`), opcionalmente filtrados por `congregacao_id` e texto `q` (nome). Query opcional: `limit` (máx. 200).

Cada item inclui `turma_label`: primeira turma ativa do vínculo, para exibição tipo lista de cadastros.

### `GET /api/usuarios/historico.php`

Agrega dados da tabela `frequencia` para um aluno.

Query obrigatória: `usuario_id` (inteiro positivo).

Resposta: `usuario` (`nome_real`, `turma_label`), `stats` (`presencas`, `ausencias`, `registos`, `pontos`, `aproveitamento_pct`).  
**404** se o utilizador não existir ou estiver inativo (`deleted_at`).

### `GET /api/usuarios/aniversariantes.php`

Lista aniversariantes do mês (`data_nascimento`).

Query: `mes` (1–12; predefinido: mês corrente), `congregacao_id` opcional.

## Variáveis de ambiente (servidor)

Ver `backend/.env.example` e `backend/.env.hostinger.example`. Principais para produção:

| Variável | Uso |
|----------|-----|
| `EBD_DB_*` | Ligação MySQL |
| `EBD_SMTP_HOST`, `EBD_SMTP_PORT`, `EBD_SMTP_SECURE` | Hostinger: `smtp.hostinger.com`, `465`, `ssl` |
| `EBD_SMTP_USER`, `EBD_SMTP_PASS`, `EBD_SMTP_FROM_EMAIL` | Conta de envio (ex.: `suporte@adparaiso.com.br`) |
| `EBD_PASSWORD_RESET_LINK_BASE` | URL de `reset-form.php` |
| `EBD_APP_LOGIN_DEEP_LINK` | Retorno ao app após nova senha (`mobile://login`) |

O cliente Expo usa apenas `EXPO_PUBLIC_API_URL` (sem segredos).

## Contrato formal

Importar `backend/openapi.yaml` no Swagger Editor, Postman ou Insomnia para gerar coleções e validação.

## Testes rápidos (curl)

```bash
curl -sS "http://localhost:8080/api/health.php"
curl -sS -X POST "http://localhost:8080/api/auth/login.php" \
  -H "Content-Type: application/json" \
  -d "{\"usuario\":\"admin@demo.local\",\"senha\":\"demo123\"}"
```
