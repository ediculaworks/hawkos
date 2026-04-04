# Wave 8 — Bugfix & Audit Completo

> Todas as correções identificadas na auditoria pós-implementação da Wave 8.
> Cada item tem: problema, ficheiro, fix exacto, e prioridade.

---

## CRITICAL — Vai rebentar em produção

### C1. RegExp ReDoS no renderPattern
- **Ficheiro:** `packages/shared/src/prompts/index.ts:58`
- **Problema:** `new RegExp(\`\\{\\{${key}\\}\\}\`, 'g')` constrói regex a partir de nomes de variáveis. Se `key` contiver `.*+?()[]{}|^$\`, a regex explode ou faz match errado.
- **Fix:** Substituir `new RegExp(...)` por `string.replaceAll('{{' + key + '}}', value)`.
- **Teste:** `renderPattern` com key contendo `$`, `.`, `*`, `(`, `)`.

### C2. Per-tenant budget é dead code
- **Ficheiro:** `apps/agent/src/model-router.ts`
- **Problema:** `selectModel()` é sync mas `getTenantBudgetLimit()` é async. O cache `_tenantBudgetCache` é `null` no startup. Nenhum código chama `checkBudgetAsync()`. Na prática, usa sempre o env var global `MODEL_DAILY_BUDGET_USD`.
- **Fix (opção A — preferida):** Chamar `getTenantBudgetLimit()` dentro de `loadDailyUsageFromDb()` no startup, populando o cache. `selectModel()` já lê `_tenantBudgetCache?.value` como fallback — com o cache populado, funciona.
- **Fix (opção B):** Tornar `selectModel()` async e propagar a mudança pelo middleware routing → message-builder.
- **Teste:** Mock tenant com `feature_flags: { daily_budget_usd: 0.50 }`, verificar que `trackUsage` respeita esse limite.

### C3. Provider sync muta estado sem lock
- **Ficheiro:** `packages/extensions/core/provider.ts:129-139`
- **Problema:** `syncModule()` muda `p.status = 'syncing'` sem lock. Duas chamadas concorrentes corrompem o status. Se sync falha, status fica em `'syncing'` ou `'error'` sem recovery.
- **Fix:** Adicionar guard `if (p.status === 'syncing') continue` antes de mutar. Adicionar `try/finally` que garanta status volta a `'connected'` ou `'error'`.
- **Teste:** Chamar `syncModule('finances')` 2x em paralelo, verificar que a segunda é ignorada.

### C4. `getPool().unsafe()` no demand engine
- **Ficheiro:** `packages/modules/demands/engine.ts:120-129`
- **Problema:** `getPool().unsafe()` com parâmetros posicionais funciona, mas o nome `unsafe` é enganador e convida a uso errado (string interpolation futura). Também, o cast `rows[0] as unknown as DemandStep` é type-unsafe.
- **Fix:** Usar a Supabase client `db.rpc('checkout_demand_step', {...})` em vez de raw SQL. A RPC já existe na migration. Fallback: manter `.unsafe()` mas adicionar validação do resultado com Zod ou type guard.
- **Teste:** Step com status 'ready' é claimed. Step com status 'running' retorna null.

### C5. `recover_stale_demand_steps()` RPC assume que existe
- **Ficheiro:** `packages/modules/demands/engine.ts:155-160`
- **Problema:** `recoverStaleClaims()` chama RPC que só existe se a migration 20260417 foi aplicada. Se não foi, crash.
- **Fix:** Wrap em try/catch (já está), mas adicionar log de warning explícito: `console.warn('[demand-engine] recover_stale_demand_steps RPC not found, skipping')`. Verificar que o catch retorna 0.
- **Teste:** Mock do `getPool()` que lança erro, verificar que retorna 0 sem crash.

---

## HIGH — Funciona mas com problemas

### H1. PLATFORM_HINTS e REACT_INSTRUCTION duplicados
- **Ficheiros:** `apps/agent/src/middleware/routing.ts:14-40` e `apps/agent/src/middleware/message-builder.ts:12-42`
- **Problema:** Constantes definidas em ambos os ficheiros. Usadas apenas em `message-builder.ts`. Dead code em `routing.ts`.
- **Fix:** Remover `PLATFORM_HINTS` (linhas 14-29) e `REACT_INSTRUCTION` (linhas 31-40) de `routing.ts`. Remover os imports desnecessários (`buildSystemPrompt` de routing.ts se não usado).
- **Teste:** `tsc --noEmit` passa. Grep confirma que as constantes só existem em message-builder.ts.

### H2. Token estimation feita 2x
- **Ficheiro:** `apps/agent/src/middleware/message-builder.ts:84-88` e `119-123`
- **Problema:** `estimateTokenCount()` chamado em todos os messages na linha 84, e novamente na linha 119 nos mesmos messages (após compression). A segunda chamada é necessária (messages mudaram), mas a primeira calcula tokens ANTES de saber se compression é necessária.
- **Fix:** Guardar o resultado da primeira estimativa. Só recalcular se compression alterou os messages (comparar `messages.length` antes/depois).
- **Teste:** Log token count antes e depois, confirmar que não duplica.

### H3. Confidence score é campo inerte
- **Ficheiros:** `packages/modules/memory/retrieval.ts:128-131`, migration `20260417000000`
- **Problema:** Campo `confidence` existe no DB e no scoring (peso 0.15), mas nenhum código extrai confidence do LLM. Todas as memórias terão default 0.8 para sempre.
- **Fix (2 partes):**
  1. No memory extractor (`apps/agent/src/sub-agent.ts` ou worker de extracção): adicionar instrução ao prompt para incluir `"confidence": 0.0-1.0` por facto extraído.
  2. No `handleSaveMemory()` em `tool-executor.ts`: aceitar campo `confidence` opcional no schema Zod e passá-lo ao `createMemory()`.
- **Teste:** Salvar memória com confidence 0.3 e 0.9. Verificar que retrieval retorna a 0.9 primeiro (tudo o resto igual).

### H4. `htmlToText()` é dead code
- **Ficheiro:** `apps/agent/src/tools/web.ts:164-182`
- **Problema:** Função legacy mantida como "fallback" mas `htmlToMarkdown()` já tem fallback interno (Turndown no body). A única chamada é na última linha de `htmlToMarkdown()` que nunca é alcançada se `parseHTML` funcionar (e funciona sempre — linkedom não falha em HTML inválido).
- **Fix:** Remover `htmlToText()`. No último catch de `htmlToMarkdown()`, retornar string vazia ou mensagem de erro em vez de chamar a função legacy.
- **Teste:** `htmlToMarkdown('<html><body>texto</body></html>', 'http://example.com')` retorna Markdown válido.

### H5. DataProvider interface sem implementação
- **Ficheiro:** `packages/extensions/core/provider.ts`
- **Problema:** Interface, registry, e `syncModule()` existem mas zero providers implementados. É scaffolding sem uso. Código nunca executado.
- **Fix (opção A — preferida):** Implementar 1 provider concreto: `finances/csv-import` que lê um CSV e cria transactions. Prova que a interface funciona.
- **Fix (opção B):** Se não vamos implementar agora, adicionar comment `// TODO: Implement first provider in Wave 9` e remover export do index.ts para não poluir o namespace público.
- **Teste:** Se opção A: importar CSV com 10 transactions, verificar que `syncModule('finances')` retorna `{ recordsCreated: 10 }`.

### H6. DuckDuckGo/SearXNG HTML parsing frágil
- **Ficheiro:** `apps/agent/src/tools/web.ts:37-112`
- **Problema:** Regex hardcoded para DOM classes do DDG (`result__a`, `result__snippet`). Vai quebrar quando DDG mudar o HTML.
- **Fix:** Adicionar assertion no resultado: se DDG retorna HTML válido mas 0 results parsed, logar warning `'DDG HTML structure may have changed'`. Considerar usar `linkedom` para parse DOM em vez de regex.
- **Teste:** Mock HTML com estrutura diferente, verificar que fallback para SearXNG funciona.

### H7. `catch {}` silencioso em SearXNG
- **Ficheiro:** `apps/agent/src/tools/web.ts:108`
- **Problema:** `catch {}` engole todos os erros sem log. Se todas as instâncias SearXNG falharem, não há diagnóstico.
- **Fix:** `catch (err) { console.warn('[web_search] SearXNG instance failed:', instance, err); }`.
- **Teste:** Mock fetch que falha, verificar que warning aparece no log.

### H8. User-Agent estático e desactualizado
- **Ficheiro:** `apps/agent/src/tools/web.ts:268`
- **Problema:** UA string fixa `Chrome/120.0.0.0` — Chrome está na versão 130+. Sites detectam isto como bot.
- **Fix:** Actualizar para Chrome 130+ ou rodar UA de uma lista pequena.
- **Teste:** Fetch de um site que bloqueia bots, verificar que não retorna 403.

---

## MEDIUM — Melhorias de qualidade

### M1. Middleware não valida agent config
- **Ficheiro:** `apps/agent/src/handler.ts:26-33`
- **Problema:** `resolveAgent()` retorna config que pode ter model inválido ou toolsEnabled com módulos inexistentes. Nenhuma validação.
- **Fix:** Após `resolveAgent()`, validar que `agent.model` está na lista de modelos conhecidos e que `agent.toolsEnabled` são módulos válidos. Log warning se não.
- **Teste:** Agent com model `'nonexistent/model'` — deve usar fallback, não crashar.

### M2. Content type casting loose para token estimation
- **Ficheiros:** `apps/agent/src/middleware/message-builder.ts:86`, `apps/agent/src/middleware/llm.ts:183`
- **Problema:** `(m as { content?: string }).content ?? ''` perde multimodal content (ContentPart[]). Token estimation retorna 0 para mensagens com imagens.
- **Fix:** `typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')`
- **Teste:** Message com `content: [{ type: 'text', text: 'hello' }, { type: 'image_url', ... }]` — token count > 0.

### M3. Tool loop reconstrói messages a partir de ctx.messages
- **Ficheiro:** `apps/agent/src/middleware/llm.ts:109-111`
- **Problema:** Cada round do tool loop copia `ctx.messages` inteiro. Se há 5 rounds, a mesma history é incluída 5 vezes no payload final.
- **Fix:** Manter `toolMessages` como array separado que acumula apenas o que é novo (assistant tool_calls + tool results). Reconstruir o payload como `[...ctx.messages, ...toolMessages]` em cada round.
- **Teste:** Simular 3 tool rounds, verificar que o payload da chamada 3 não contém duplicatas.

### M4. Memory retrieval fallback silencioso
- **Ficheiro:** `packages/modules/memory/retrieval.ts:68-73`
- **Problema:** Se hybrid search e semantic search falham, retorna `[]` sem log. Memory retrieval degrada silenciosamente.
- **Fix:** Adicionar `logger.warn('All memory search methods failed, returning empty results')` no caso de fallback vazio.
- **Teste:** Mock que falha em ambas as searches, verificar warning no log.

### M5. Memory search result pode ter `undefined` similarity
- **Ficheiro:** `packages/modules/memory/retrieval.ts:82-86`
- **Problema:** Se result não tem `combined_score` nem `similarity`, o valor é `undefined`. `undefined * 0.45 = NaN`. Score corrompido.
- **Fix:** `const similarity = Number('combined_score' in result ? result.combined_score : (result as any).similarity) || 0;`
- **Teste:** Search result sem similarity field — score deve ser 0, não NaN.

### M6. Incomplete AgentMemory cast
- **Ficheiro:** `packages/modules/memory/retrieval.ts:91-93`
- **Problema:** `{ id: result.id, content: result.content } as AgentMemory` cria objecto incompleto. Se código downstream acede a `memory.category`, é undefined.
- **Fix:** Incluir todos os campos disponíveis do search result, ou usar um tipo parcial `Partial<AgentMemory> & { id: string; content: string }`.
- **Teste:** Verificar que memories retornadas de semantic search têm `category` definido.

### M7. LLM call no demand engine sem timeout
- **Ficheiro:** `packages/modules/demands/engine.ts:204`
- **Problema:** `getClient().chat.completions.create(...)` pode pendurar indefinidamente se API não responde.
- **Fix:** Adicionar `signal: AbortSignal.timeout(60_000)` ao request ou usar a opção `timeout` do OpenAI client.
- **Teste:** Mock API que nunca responde — step deve falhar com timeout, não pendurar.

### M8. Prompt patterns não validam template no registo
- **Ficheiro:** `packages/shared/src/prompts/index.ts:15`
- **Problema:** `registerPattern()` aceita qualquer template sem verificar que os `requiredVars` existem como `{{var}}` no template.
- **Fix:** Na função `registerPattern`, verificar que cada `requiredVars[i]` existe como `{{var}}` no template. Throw se não.
- **Teste:** Registar pattern com `requiredVars: ['foo']` mas template sem `{{foo}}` — deve lançar erro.

### M9. Placeholders não consumidos ficam no output
- **Ficheiro:** `packages/shared/src/prompts/index.ts:55-60`
- **Problema:** Se template tem `{{field}}` mas `field` não está em `merged`, fica como literal `{{field}}` no output sem warning.
- **Fix:** Após interpolação, verificar se restam `{{...}}` no resultado. Se sim, logar warning com a lista de placeholders não resolvidos.
- **Teste:** Template com `{{a}} e {{b}}`, passar apenas `a` — warning sobre `{{b}}`.

### M10. Provider metadata pode ser undefined
- **Ficheiro:** `packages/extensions/core/provider.ts:133`
- **Problema:** `p.metadata.lastSyncAt = ...` assume que `metadata` existe. Se provider foi criado com `metadata: undefined`, crash.
- **Fix:** Inicializar metadata como `{}` no interface default ou adicionar guard `p.metadata ??= {}`.
- **Teste:** Provider com `metadata: {} as ProviderMetadata` — sync não crashar.

---

## LOW — Polimento

### L1. Remover import não usado em routing.ts
- **Ficheiro:** `apps/agent/src/middleware/routing.ts:5`
- **Problema:** `import { buildSystemPrompt } from '../agent-resolver.js'` — não é usado neste ficheiro (é usado em message-builder.ts).
- **Fix:** Remover a linha.

### L2. Constantes de fallback models hardcoded no llm.ts
- **Ficheiro:** `apps/agent/src/middleware/llm.ts:35-40`
- **Problema:** Lista de fallback models duplicada com a que existe em handler.ts original. Se model-router.ts adicionar novos modelos, esta lista fica desactualizada.
- **Fix:** Exportar `FALLBACK_MODELS` do model-router.ts e importar no llm.ts.

### L3. Cache de tenant budget não limpa em mudança de dia
- **Ficheiro:** `apps/agent/src/model-router.ts:169`
- **Problema:** Cache expira em 5 minutos, mas se o budget muda à meia-noite (novo dia), o cache pode servir o budget de ontem por até 5 minutos.
- **Fix:** Adicionar check `if (todayDate() !== _budget?.date) _tenantBudgetCache = null` no `getBudget()`.

### L4. `web_fetch` não valida URL antes de fetch
- **Ficheiro:** `apps/agent/src/tools/web.ts:259`
- **Problema:** URLs com `file://`, `data:`, ou `localhost` não são bloqueadas. Pode ser usado para SSRF.
- **Fix:** Importar `validateURLForSSRF` de `@hawk/shared/ssrf-validator` e chamar antes do fetch. Já existe no codebase.

### L5. Content-Type charset ignorado no web_fetch
- **Ficheiro:** `apps/agent/src/tools/web.ts:279`
- **Problema:** `res.text()` assume UTF-8. Sites com `charset=ISO-8859-1` retornam lixo.
- **Fix:** Extrair charset do Content-Type header. Se não UTF-8, usar `TextDecoder` com o charset correcto.

### L6. No tests for new code
- **Ficheiros:** Todos os novos ficheiros
- **Problema:** Zero testes para middleware pipeline, renderPattern, checkoutStep, DataProvider, confidence scoring, web markdown extraction.
- **Fix:** Criar test files:
  - `apps/agent/src/__tests__/middleware-pipeline.test.ts` — testa pipeline end-to-end com mocks
  - `packages/shared/src/__tests__/prompts.test.ts` — testa renderPattern, executePattern, edge cases
  - `packages/extensions/core/__tests__/provider.test.ts` — testa registry e syncModule
  - `apps/agent/src/__tests__/web-tools.test.ts` — testa htmlToMarkdown com HTML real

### L7. UTF-8 truncation pode cortar character
- **Ficheiro:** `apps/agent/src/tools/web.ts:186`
- **Problema:** `Buffer.from(text, 'utf-8').subarray(0, maxBytes)` pode cortar um char multi-byte ao meio.
- **Fix:** Após truncar, verificar se o último char é válido UTF-8. Se não, recuar até encontrar um char válido. Ou usar `text.slice(0, maxChars)` com char count em vez de byte count.

### L8. `buildSystemPrompt` import não necessário em routing.ts
- **Ficheiro:** `apps/agent/src/middleware/routing.ts:5`
- **Problema:** Mesmo que L1. Import de `buildSystemPrompt` existe mas não é chamado.
- **Fix:** Remover.

---

## Testes a escrever

| Ficheiro de teste | O que testa | Prioridade |
|-------------------|------------|------------|
| `middleware-pipeline.test.ts` | Pipeline completo com mocks de LLM, DB, context | CRITICAL |
| `prompts.test.ts` | renderPattern: variáveis, defaults, ReDoS, placeholders não resolvidos | HIGH |
| `web-tools.test.ts` | htmlToMarkdown com HTML real, fallbacks, truncation | HIGH |
| `demand-checkout.test.ts` | checkoutStep atómico, releaseStep, recoverStaleClaims | HIGH |
| `provider.test.ts` | registerProvider, syncModule concorrente, healthCheck | MEDIUM |
| `confidence-scoring.test.ts` | Retrieval com confidence variável, NaN guard | MEDIUM |
| `tenant-budget.test.ts` | Budget per-tenant, cache expiry, fallback para env var | MEDIUM |

---

## Ordem de execução

1. **C1** RegExp ReDoS → fix imediato (1 linha)
2. **C2** Per-tenant budget → fix no startup (5 linhas)
3. **H1** Dead code duplicado → remover (20 linhas)
4. **H4** htmlToText dead code → remover (18 linhas)
5. **L4** SSRF validation no web_fetch → adicionar (3 linhas)
6. **C3** Provider sync lock → adicionar guard (5 linhas)
7. **C4** unsafe() no demand engine → usar RPC (10 linhas)
8. **M2** Content type casting → fix (2 linhas por ficheiro)
9. **M3** Tool loop message rebuild → refactor (15 linhas)
10. **M5** NaN guard no similarity → fix (1 linha)
11. **H3** Confidence extraction → implementar no extractor (30 linhas)
12. **L6** Testes → escrever todos (200+ linhas)
13. **H5** CSV provider → implementar (100 linhas)
14. Restantes por ordem de ficheiro
