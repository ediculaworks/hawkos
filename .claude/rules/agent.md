# Agent — Padrões de Desenvolvimento

## Handler (apps/agent/src/handler.ts)

O handler usa um pipeline de 7 middlewares composáveis (`runPipeline()`):
1. **security** — injection scanning + secret redaction
2. **context** — L0/L1/L2, memories, previous session
3. **history** — session history loading
4. **routing** — module detection, tool filtering, model selection
5. **message-builder** — messages array, compression, compaction
6. **llm** — LLM call + fallback chain + tool loop (max 5 rounds)
7. **persistence** — save messages, log activity

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

- O agente salva memórias via tool `save_memory` com `memory_type` e `confidence` (0.0-1.0)
- Session compactor extrai memórias automaticamente ao fim de sessões
- Deduplicação em 2 estágios: vector pre-filter + LLM decision (via worker model)
- Hotness scoring prioriza memórias frequentemente acessadas
- Hybrid search: RRF (Reciprocal Rank Fusion) com vector + keyword (pg_trgm)

## LLM Strategy

- **Primário:** `gemma4:e2b` via Ollama local (simple, moderate, workers) — gratuito
- **Fallback:** OpenRouter free models (qwen3.6-plus, nemotron-120b, llama-3.3-70b)
- **Complex:** `qwen/qwen3.6-plus:free` via OpenRouter
- **Workers** (memory, dedup, compression, sub-agents): partilham o mesmo client via `setWorkerLLM()`
- **Embeddings:** `openai/text-embedding-3-small` via OpenRouter (hardcoded)
- Configuração: `model-router.ts` (tiers) + `llm-client.ts` (client factory)
