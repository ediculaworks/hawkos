# Arquitetura do Hawk OS

## Estrutura do Monorepo

```
apps/agent/     → Bot Discord + AI handler + automations
apps/web/       → Next.js 15 dashboard
packages/db/    → Supabase client + migrations
packages/modules/X/  → 16 módulos isolados
packages/context-engine/ → Assembler L0/L1/L2
packages/shared/ → errors, constants, types
```

## Módulo — Estrutura Padrão

Cada módulo em `packages/modules/<name>/` contém:
- `index.ts` — ÚNICA porta de exportação
- `types.ts` — tipos TypeScript
- `queries.ts` — queries Supabase (CRUD)
- `commands.ts` — handlers de slash commands Discord
- `context.ts` — `loadL0()`, `loadL1()`, `loadL2()`
- `constants.ts` — constantes do módulo
- `package.json` — workspace deps

## Regras de Dependência

```
Discord / HTTP → Commands → Module Logic → Queries → Supabase
```

- Dependências fluem para baixo. `queries.ts` nunca importa de `commands.ts`
- Módulos se comunicam via `index.ts`: `import { X } from '@hawk/module-Y'`
- Cross-module logic fica em `packages/shared/` ou é orquestrada no agent

## Camadas de Contexto

- **L0** (~100 tokens): resumo one-liner, cacheado 5min, carregado sempre
- **L1** (~2k tokens): detalhes, carregado quando módulo é relevante
- **L2** (ilimitado): dados específicos para queries granulares

## Memory System (V2, OpenViking-inspired)

- 6 tipos: profile, preference, entity, event, case, pattern
- Embeddings via pgvector para busca semântica
- Hotness scoring: sigmoid(log1p(access_count)) × exp(-days/7)
- Session commit flow: archive → extract → dedup → persist
- Dedup em 2 estágios: vector pre-filter + LLM decision

## 16 Módulos (11 activos na sidebar)

Código existe para 16 módulos, mas apenas 11 estão activos na sidebar:
- **Activos**: finances, health, people, career, objectives, routine, assets, entertainment, legal, housing, calendar
- **Inactivos**: security, social, spirituality, journal, knowledge (código existe mas não aparece na sidebar)

O sistema de Memória substitui as funcões de journal e knowledge.
