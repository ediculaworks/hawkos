# Agent — Padrões de Desenvolvimento

## Handler (apps/agent/src/handler.ts)

O handler processa mensagens em sequência:
1. Salvar mensagem do usuário
2. Carregar contexto (L0/L1/L2) + memórias + histórico + sessão anterior
3. Montar system prompt
4. Chamar LLM com tool routing dinâmico
5. Executar tool calls
6. Salvar resposta

## Tool Routing Dinâmico

- Cada tool tem `modules: ModuleId[]` indicando quais módulos pertence
- `getToolsForModules(modulesLoaded)` filtra tools por módulos detectados
- Tools universais (`modules: []`): `save_memory`, `request_more_tools`
- Reduz payload de 30+ para ~5-10 tools por chamada

## Criando um Novo Tool

1. Adicionar em `apps/agent/src/tools.ts`
2. Incluir `modules` field com o(s) módulo(s) relevantes
3. Handler deve chamar queries do módulo correspondente
4. Retornar string descritiva do resultado

```typescript
my_tool: {
  name: 'my_tool',
  modules: ['my_module'],
  description: 'Faz X',
  parameters: { type: 'object', properties: {...}, required: [...] },
  handler: async (args) => { ... return 'resultado'; },
},
```

## Automations (apps/agent/src/automations/)

- Usam `node-cron` para scheduling
- Registradas em `index.ts`
- Padrão: `startXCron()` ou `runX()`
- Automations existentes:
  - alerts.ts (08:00 diário)
  - daily-checkin.ts (09:00 + 22:00)
  - weekly-review.ts (dom 20:00)
  - session-compactor.ts (a cada hora)
  - health-insights.ts, content-pipeline.ts

## Memory System

- O agente salva memórias via tool `save_memory` com `memory_type`
- Session compactor extrai memórias automaticamente ao fim de sessões
- Deduplicação em 2 estágios evita duplicatas
- Hotness scoring prioriza memórias frequentemente acessadas
