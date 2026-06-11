# Várias igrejas — uma base MySQL (`u370088447_ebd_prime`)

## Modelo (recomendado)

Uma **única base** na Hostinger. Cada igreja cadastrada é uma linha em `congregacoes` (tenant). Todos os outros dados carregam `congregacao_id` e **nunca** se misturam se a API filtrar pelo token do utilizador.

```text
u370088447_ebd_prime
├── congregacoes          ← Igreja A (id=1), Igreja B (id=2), …
├── usuarios              ← congregacao_id = igreja do utilizador
├── turmas, departamentos ← congregacao_id
├── vinculos_turma, escala, frequencia, relatórios …
```

| Ação | O que acontece |
|------|----------------|
| Cadastro de **nova igreja** (onboarding) | `INSERT` em `congregacoes` + primeiro admin com esse `congregacao_id` |
| Login | Token ligado ao utilizador → só vê dados da **sua** igreja |
| Novo admin na mesma igreja | Convidar administrador (mesmo `congregacao_id`) |
| Turmas / alunos / aulas | Sempre filtrados por `congregacao_id` da sessão |

## Regra de ouro na API

Depois do login, **cada pedido** usa `ebd_resolve_congregacao_scope()`:

- Utilizador normal: `congregacao_id` = o da conta (ignora tentativas de aceder a outra igreja).
- Conta de plataforma sem igreja (`congregacao_id` NULL): só para operação interna; tem de enviar `congregacao_id` no pedido.

Administrador de igreja **não** vê todas as igrejas da base (correção do bug que pegava na “primeira” congregação).

## Migrações úteis

| Ficheiro | Quando |
|----------|--------|
| `database_migration_008_escola_unica.sql` | **Não usar** se quiser várias igrejas — apagava linhas extra |
| `database_migration_009_multi_igreja_login.sql` | Permite o mesmo `login` em igrejas diferentes (`uk` por `congregacao_id` + `login_usuario`) |

## Nome “congregação” no código

Na base e no PHP o campo continua `congregacao_id` (nome técnico). Na interface pode aparecer **igreja** / **escola**.

## O que NÃO fazer

- Não usar uma base MySQL por igreja neste modelo (custo e gestão altos na Hostinger).
- Não confiar só no `congregacao_id` enviado pelo app sem validar o token.
- Não marcar todos os admins como “vêem tudo” — isso mistura igrejas.

## App mobile

- Após login, `congregacaoId` no contexto = igreja do utilizador.
- Enviar `congregacao_id` nos POST é opcional; o servidor usa a da sessão.
- Cadastro de escola = cria **nova** linha em `congregacoes` (pode haver N igrejas na mesma base).

## Próximos passos opcionais (evolução)

- Painel web da plataforma para listar igrejas (só conta operador).
- Subdomínio por igreja (`igreja-a.ebd...`) resolvendo tenant por host (mesma base).
- Relatórios agregados só para operador da plataforma.
