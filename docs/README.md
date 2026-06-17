# Documentação — EBD Prime

Índice da pasta `docs/` após entrega final do projeto (IFTO · 2026).

## Documento principal (entrega académica)

| Ficheiro | Uso |
|----------|-----|
| **[DOCUMENTACAO_APP_EBD_PRIME.pdf](./DOCUMENTACAO_APP_EBD_PRIME.pdf)** | Documentação completa do sistema (especificação, requisitos, telas, considerações finais) |
| **[modelo-logico-dados.jpg](./modelo-logico-dados.jpg)** | Modelo lógico de dados (diagrama ER — drawSQL) |
| **[requisitos.txt](./requisitos.txt)** | Resumo executivo: RF/RNF/RN, estado actual e backlog |

## Referência técnica e operacional

| Ficheiro | Tema |
|----------|------|
| [api_rest_ebd_prime.md](./api_rest_ebd_prime.md) | Endpoints da API REST PHP |
| [DEPLOY-HOSTINGER-FTP-AUTOMATICO.md](./DEPLOY-HOSTINGER-FTP-AUTOMATICO.md) | Deploy automático para produção (`npm run deploy:hostinger`) |
| [migracao-hostinger.md](./migracao-hostinger.md) | MySQL na Hostinger, import de schema, SMTP |
| [MULTI_IGREJA_UMA_BASE.md](./MULTI_IGREJA_UMA_BASE.md) | Várias igrejas na mesma base MySQL |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de alterações do projeto |

## Por perfil de leitor

| Perfil | Começar por |
|--------|-------------|
| Professor / avaliador | `DOCUMENTACAO_APP_EBD_PRIME.pdf` + `requisitos.txt` |
| Desenvolvedor | `api_rest_ebd_prime.md` + `backend/openapi.yaml` |
| Deploy / produção | `DEPLOY-HOSTINGER-FTP-AUTOMATICO.md` + `migracao-hostinger.md` |
