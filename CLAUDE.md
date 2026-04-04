# Hawk OS — Contexto para Agentes

> Leia este arquivo inteiro antes de fazer qualquer coisa.

## O que é

**Hawk OS** é um sistema operacional de vida pessoal.
- Agente AI via Discord como interface primária
- Dashboard web Next.js para visualização
- PostgreSQL self-hosted (Docker) como banco de dados
- **8 módulos activos** na sidebar (16 no código)

## Documentacao

- **Estado atual:** `.claude/rules/current-status.md`
- **Deploy / VPS / SSH:** `.claude/rules/deploy.md`
- **Stack tecnica:** `.claude/rules/stack.md`
- **Arquitetura:** `.claude/rules/architecture.md`
- **Auditoria do sistema:** `resources/planning/SYSTEM-AUDIT-2026-03-27.md`
- **Plano de execucao:** `resources/planning/EXECUTION-PLAN-CRITICAL-GAPS.md`

## Como rodar (local)

```bash
bun install              # instalar dependências
docker compose up -d postgres pgbouncer  # subir PostgreSQL + PgBouncer
bun db:migrate           # aplicar migrations no PostgreSQL
bun agent                # rodar o bot Discord localmente
bun build                # build de todos os packages
bun lint                 # checar código com Biome
bun dev                  # rodar todos os apps em modo dev
```

## Deploy na VPS

Ver `.claude/rules/deploy.md` para instruções completas de SSH, deploy e gestão de serviços.

```bash
# Fluxo básico:
git add <files> && git commit -m "..." && git push
ssh hawk@168.231.89.31 "cd /docker/hawkos && git pull && docker compose build agent && docker compose up -d agent"
```

## Convenções

- Migrations: `packages/db/supabase/migrations/YYYYMMDDHHMMSS_nome.sql`
- Módulos: `packages/modules/<nome>/{index,types,queries,commands,context}.ts`
- Commits: `fix(bug): descrição` | `feat(module): descrição` | `migration(módulo): descrição`
- Ao concluir: atualizar `.claude/rules/current-status.md`

## 8 Módulos Activos na Sidebar

finances, health, people, career, objectives, routine, legal, calendar

**Inactivos** (código existe, não aparece na sidebar): assets, entertainment, housing, security, social, spirituality, journal, knowledge, memory (system module)

## Variáveis de ambiente

Todas em `.env` (nunca commitar). Ver `.env.example` para lista completa.
