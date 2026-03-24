# Hawk OS — Contexto para Agentes

> Leia este arquivo inteiro antes de fazer qualquer coisa.

## O que é

**Hawk OS** é um sistema operacional de vida pessoal.
- Agente AI via Discord como interface primária
- Dashboard web Next.js para visualização
- Supabase (PostgreSQL) como banco de dados
- **11 módulos activos** na sidebar (16 no código)

## Documentação

- **Plano de execução ativo:** `resources/planning/EXECUTION-PLAN.md`
- **Princípios:** `resources/planning/PRINCIPLES.md`
- **Roadmap:** `resources/planning/roadmap/INDEX.md`
- **Estado atual:** `.claude/rules/current-status.md`
- **Stack técnica:** `.claude/rules/stack.md`
- **Arquitetura:** `.claude/rules/architecture.md`

## Como rodar

```bash
bun install              # instalar dependências
bun agent                # rodar o bot Discord localmente
bun db:migrate           # aplicar migrations no Supabase
bun db:types             # gerar tipos TypeScript do schema
bun build                # build de todos os packages
bun lint                 # checar código com Biome
bun dev                  # rodar todos os apps em modo dev
```

## Convenções

- Migrations: `packages/db/supabase/migrations/YYYYMMDDHHMMSS_nome.sql`
- Módulos: `packages/modules/<nome>/{index,types,queries,commands,context}.ts`
- Commits: `fix(bug): descrição` | `feat(module): descrição` | `migration(módulo): descrição`
- Ao concluir: atualizar `resources/planning/EXECUTION-PLAN.md` + `CHANGELOG.md`

## 11 Módulos Activos

finances, health, people, career, objectives, routine, assets,
entertainment, legal, housing, calendar

**Inactivos** (código existe mas não aparece na sidebar): security, social, spirituality, journal, knowledge, memory (system module)

## Variáveis de ambiente

Todas em `.env` (nunca commitar). Ver `.env.example` para lista completa.
