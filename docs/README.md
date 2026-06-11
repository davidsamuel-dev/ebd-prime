# Documentação — EBD Prime

Índice oficial da pasta `docs/`. A especificação principal segue o **modelo IFTO (Campus Paraíso)**.

## Documento principal

| Ficheiro | Uso |
|----------|-----|
| **[DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md](./DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md)** | Especificação completa: histórico, projeto, RF/RNF, modelagem, técnico, backlog, RN, arquitetura, deploy, segurança |

Preencher no cabeçalho: disciplina, professor e nomes da equipe.

## Por perfil de leitor

| Perfil | Começar por |
|--------|-------------|
| Professor / avaliador académico | `DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md` (secções 2–3) + `requisitos_ebd_prime_publico.txt` |
| Desenvolvedor | `DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md` + `requisitos_ebd_prime.txt` + `api_rest_ebd_prime.md` |
| DevOps / Hostinger | `DEPLOY-HOSTINGER-AGORA.md`, `migracao-hostinger.md`, `MULTI_IGREJA_UMA_BASE.md` |
| Gestão do produto | `ESTADO_DO_PROJETO.md` |

## Anexos técnicos e operacionais

| Ficheiro | Tema |
|----------|------|
| [ESTADO_DO_PROJETO.md](./ESTADO_DO_PROJETO.md) | Estado actual, prioridades, comandos npm |
| [CHANGELOG.md](./CHANGELOG.md) | **Histórico datado de funcionalidades e correções** |
| [requisitos_ebd_prime.txt](./requisitos_ebd_prime.txt) | RF001–RF050, RNF, RN (rastreio ao código) |
| [requisitos_ebd_prime_publico.txt](./requisitos_ebd_prime_publico.txt) | Requisitos em português claro |
| [api_rest_ebd_prime.md](./api_rest_ebd_prime.md) | API REST PHP |
| [MULTI_IGREJA_UMA_BASE.md](./MULTI_IGREJA_UMA_BASE.md) | Várias igrejas, uma base MySQL |
| [AUDITORIA-FIREBASE.md](./AUDITORIA-FIREBASE.md) | Firebase vs REST |
| [DEPLOY-HOSTINGER-AGORA.md](./DEPLOY-HOSTINGER-AGORA.md) | Publicar API |
| [DEPLOY-WEB-HOSTINGER.md](./DEPLOY-WEB-HOSTINGER.md) | Publicar site (Expo web) |
| [migracao-hostinger.md](./migracao-hostinger.md) | MySQL, import, SMTP, remoto |
| [documentacao_ebd_prime.md](./documentacao_ebd_prime.md) | Legado (RF antigos) — consulta histórica |
| [ESCOLA_UNICA.md](./ESCOLA_UNICA.md) | **Obsoleto** — não seguir |

## Estrutura do documento de especificação (modelo IFTO)

1. Histórico de alterações  
2. Definição do projeto (tema, objetivo, stakeholders)  
3. Requisitos do sistema (RF, RNF, modelagem)  
4. Requisitos técnicos  
5. Ideias futuras (backlog)  
6. Regras de negócio  
7. Arquitetura  
8. Ambientes e deploy  
9. Segurança  
10. Migrações SQL  
11. Documentação complementar  
12. Glossário  
