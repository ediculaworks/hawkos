---
name: module-implementation
description: Scaffold a complete Hawk OS module following the standard structure
user-invocable: false
---

# Module Implementation Skill

## Estrutura Padrão

Cada módulo em `packages/modules/<name>/`:
```
<name>/
├── index.ts          ← ÚNICA porta de exportação
├── types.ts          ← tipos TypeScript
├── queries.ts        ← queries Supabase (CRUD)
├── commands.ts       ← handlers de slash commands Discord
├── context.ts        ← loadL0(), loadL1(), loadL2()
├── constants.ts      ← constantes do módulo
└── package.json      ← workspace deps
```

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

## Como Registrar

1. Adicionar em `apps/agent/src/tools.ts`:
```typescript
my_tool: {
  name: 'my_tool',
  modules: ['my_module'],
  description: 'Faz X',
  parameters: { type: 'object', properties: {...}, required: [...] },
  handler: async (args) => { ... return 'resultado'; },
},
```
2. Registrar no context engine em `packages/context-engine/src/index.ts`
3. Adicionar command no Discord bot via `packages/modules/<name>/commands.ts`

## Template package.json
```json
{
  "name": "@hawk/module-<name>",
  "version": "0.0.1",
  "private": true,
  "main": "index.ts"
}
```
