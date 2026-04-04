# Pipeline do Agente

## Visao Geral

Toda mensagem enviada para o Hawk OS passa por um **pipeline de 7 middlewares** em `apps/agent/src/middleware/`. O handler em `apps/agent/src/handler.ts` e apenas um entry point fino que delega para `runPipeline()`.

> 🧩 **Para leigos:** Cada vez que voce manda uma mensagem pro agente, ela passa por 7 etapas antes de voce receber a resposta. Primeiro verifica seguranca, depois busca contexto, carrega historico, decide quais ferramentas usar, monta a mensagem, pede ao LLM, e por fim salva tudo. Cada etapa funciona independentemente — se uma falhar, as outras continuam.

## Arquitetura: Middleware Chain

O sistema usa um padrao inspirado no DeerFlow: middlewares composiveis com `next()`, onde cada um modifica um `HandlerContext` compartilhado.

```text
Mensagem recebida (Discord ou Web)
         │
         ▼
  handler.ts (entry point fino)
  handleMessage() / handleWebMessage() / handleStreamingMessage()
         │
         ▼
  runPipeline(params) → cria HandlerContext → executa chain
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  1. PERSISTENCE (pre)                                    │
│     Salvar mensagem do usuario, emitir hooks             │
├─────────────────────────────────────────────────────────┤
│  2. SECURITY                                             │
│     Unicode stripping → injection scanning → redaction   │
├─────────────────────────────────────────────────────────┤
│  3. CONTEXT                                              │
│     L0/L1/L2 + memorias + sessao anterior (paralelo)    │
├─────────────────────────────────────────────────────────┤
│  4. HISTORY                                              │
│     Carregar mensagens da sessao + check compressao      │
├─────────────────────────────────────────────────────────┤
│  5. ROUTING                                              │
│     Detectar modulos → filtrar tools → classificar       │
│     complexidade → selecionar modelo                     │
├─────────────────────────────────────────────────────────┤
│  6. MESSAGE BUILDER                                      │
│     Montar system prompt + context + historico            │
│     + platform hints + compressao se necessario          │
├─────────────────────────────────────────────────────────┤
│  7. LLM                                                  │
│     Chamar LLM → tool loop (max 5 rounds) → ReAct       │
│     Fallback chain + timeout 90s + cost tracking         │
├─────────────────────────────────────────────────────────┤
│  1. PERSISTENCE (post)                                   │
│     Salvar resposta, logar atividade, emitir hooks       │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  Resposta retornada ao canal
```

## Handler (Entry Point)

O `handler.ts` expoe quatro funcoes publicas. Todas delegam para `runPipeline()`:

```typescript
// apps/agent/src/handler.ts

export async function handleMessage(userMessage, channelId?, attachments?) {
  // Rate limit → resolver agente → runPipeline()
}

export async function handleWebMessage(sessionId, userMessage, onChunk?) {
  // Rate limit → resolver agente → runPipeline()
}

export async function handleStreamingMessage(userMessage, channelId?, onChunk?) {
  // Rate limit → resolver agente → runPipeline() com streaming
}

export async function handleAutomationMessage(prompt) {
  // Sessao temporaria → resolver agente → runPipeline()
}
```

> 💡 **Dica:** O handler nao contem logica de negocio — apenas rate limiting, resolucao de agente e delegacao. Toda a logica vive nos middlewares.

## HandlerContext

Cada middleware le e escreve campos num objeto `HandlerContext` compartilhado:

```typescript
interface HandlerContext {
  // Input (imutavel)
  readonly sessionId: string;
  readonly originalMessage: string;
  readonly channel: 'discord' | 'web';
  readonly agent: ResolvedAgent;
  readonly isNewSession: boolean;
  readonly onChunk?: (chunk: string) => void;

  // Security middleware popula:
  sanitizedMessage: string;

  // Context middleware popula:
  context: AssembledContext;          // L0/L1/L2
  memories: Array<{ id, content, category, memory_type }>;
  previousSession: { abstract, overview } | null;
  contextSection: string;

  // History middleware popula:
  history: Array<{ role, content }>;

  // Routing middleware popula:
  allowedModules: string[];
  filteredTools: ChatCompletionTool[];
  toolMap: Map<string, ToolDefinition>;
  complexity: 'simple' | 'moderate' | 'complex';
  selectedModel: string;
  isComplexQuery: boolean;             // ReAct mode

  // Message builder popula:
  messages: ChatCompletionMessageParam[];

  // LLM middleware popula:
  response: string | null;
  toolsUsed: string[];
  totalTokens: number;
  sessionCost: SessionCost | null;
}
```

## Os 7 Middlewares

### 1. Persistence (Pre/Post)

O persistence middleware envolve toda a chain — executa logica antes e depois de `next()`:

**Pre (antes do next):**

- Salvar mensagem do usuario no banco
- Emitir hooks (`session:start`, `message:received`)

**Post (depois do next):**

- Salvar resposta do assistente no banco
- Logar atividade no `activity_log`
- Emitir hooks de conclusao

### 2. Security

> ⚠️ **Atencao:** Este middleware roda ANTES de qualquer carregamento de contexto ou chamada LLM. Mensagens maliciosas sao detectadas e sanitizadas antes de tocarem no sistema.

Tres camadas de protecao, controladas por feature flags:

1. **Unicode stripping** — Remove caracteres unicode suspeitos (homoglyphs, zero-width chars, RTL overrides)
2. **Injection scanning** (`prompt-injection-scanning`) — 14 regex patterns detectam role hijacking, delimiter injection, data exfiltration, jailbreak, encoding evasion. Classifica em threat levels: none/low/medium/high/critical
3. **Secret redaction** (`secret-redaction`) — 51+ patterns para API keys, tokens, database URIs, PEM keys. Remove antes de enviar ao LLM

Violacoes sao logadas no `activity_log` com tipo `security`, incluindo threat level, score e patterns detectados.

```typescript
// Fluxo simplificado
ctx.sanitizedMessage = stripSuspiciousUnicode(ctx.originalMessage);

const scan = scanForInjection(ctx.sanitizedMessage);
if (scan.threatLevel === 'critical' || scan.threatLevel === 'high') {
  logActivity('security', `Injection: ${scan.matchedPatterns.join(', ')}`);
}

const redaction = redactSecrets(ctx.sanitizedMessage);
if (redaction.redactedCount > 0) {
  ctx.sanitizedMessage = redaction.text;
}
```

### 3. Context

Carrega contexto em paralelo com fault isolation:

```typescript
const [contextResult, memoriesResult, archiveResult] = await Promise.allSettled([
  assembleContext(ctx.sanitizedMessage),
  retrieveMemories(ctx.sanitizedMessage, 5),
  getLastSessionArchive(ctx.channel),
]);
```

> 💡 **Dica:** `Promise.allSettled` em vez de `Promise.all` garante que se um modulo falhar (ex: modulo de financas com erro de DB), os outros continuam normalmente. O agente responde com menos contexto, mas nao crasha.

Cada componente (L0/L1/L2, memorias, sessao anterior) pode falhar independentemente com logging estruturado.

### 4. History

- Carrega ultimas N mensagens da sessao atual
- Verifica threshold de compressao (aviso se >80k tokens)
- Sanitiza tool pairs: remove orphaned tool responses sem assistant tool_call correspondente

### 5. Routing

Este middleware toma tres decisoes criticas:

**Deteccao de modulos:** Usa keywords na mensagem para identificar modulos relevantes (finances, health, etc.)

**Filtragem de tools:** Cruza modulos detectados com modulos permitidos pelo agente. Resultado: ~5-10 tools em vez de 30+

```typescript
ctx.allowedModules = ctx.agent.toolsEnabled.length > 0
  ? ctx.context.modulesLoaded.filter(m => ctx.agent.toolsEnabled.includes(m))
  : ctx.context.modulesLoaded;

const { tools, toolMap } = getToolsForModules(ctx.allowedModules);
```

**Smart Model Routing:** Classifica complexidade da mensagem e seleciona modelo adequado:

| Complexidade | Criterio | Modelo |
| ------------ | -------- | ------ |
| `simple` | Cumprimentos (<30 chars), CRUD operations | MODEL_TIER_SIMPLE |
| `moderate` | Default | MODEL_TIER_DEFAULT |
| `complex` | Multi-modulo, >300 chars com perguntas, analise/planejamento | MODEL_TIER_COMPLEX |

**Cost-aware downgrade:** Se >80% do budget diario foi consumido, complex → moderate. Se >95%, tudo → simple.

**Deteccao ReAct:** Para queries complexas (multi-modulo ou padroes como "analisa", "compara", "planeja"), ativa modo ReAct com reflection steps entre tool calls.

### 6. Message Builder

Monta o array final de mensagens OpenAI:
- System prompt do template do agente
- Seccao de contexto (L0 + memorias + sessao anterior + L1 + L2)
- Platform hints — formatacao especifica por canal:
  - **Discord**: limite 2000 chars, sem tabelas, emojis moderados
  - **Web**: Markdown completo, tabelas, headings
- Historico de mensagens da sessao
- Compressao iterativa se >60k tokens (usa LLM worker para comprimir)

### 7. LLM

A chamada ao LLM com fallback chain e tool loop:

**Fallback chain:** Se o modelo primario falhar (429/403), tenta modelos alternativos:
```
modelo selecionado → Qwen 3.6 Plus → Nemotron 120B → Llama 3.3 70B → ...
```
Modelos sem suporte a `tool_choice` sao excluidos quando ha tools ativas.

**Timeout:** 90 segundos via `AbortSignal.timeout()` — previne requests pendurados com modelos free lentos.

**Tool loop (max 5 rounds):**

```typescript
while (result.finishReason === 'tool_calls' && toolRound < MAX_TOOL_ROUNDS) {
  toolRound++;

  // Executar tools em paralelo (com Promise.allSettled)
  const toolResults = await Promise.allSettled(
    result.toolCalls.map(tc => executeToolCall(tc, ctx.toolMap))
  );

  // Adicionar ao historico de tools (nao duplica ctx.messages)
  toolHistory.push({ role: 'assistant', tool_calls: result.toolCalls });
  toolHistory.push(...toolResults.map(r => ({ role: 'tool', content: r })));

  // ReAct reflection (se query complexa com >1 tool)
  if (ctx.isComplexQuery && result.toolCalls.length > 1) {
    toolHistory.push({
      role: 'system',
      content: 'Reflect on results. Missing something? Use more tools. Otherwise, synthesize.'
    });
  }

  // Chamar LLM novamente: mensagens originais + tool history acumulado
  result = await callLLM([...ctx.messages, ...toolHistory]);
}
```

**Cost tracking:** Cada chamada LLM e tool call e registrada para monitoramento de custo per-tenant.

> ⚠️ **Atencao:** O limite de 5 rounds de tool calls previne loops infinitos com modelos menores que repetem tool calls. Se atingido, um warning e logado e o LLM retorna o que tem.

## Tool Approval

Tools marcadas com `dangerous: true` requerem confirmacao do usuario:

1. Primeira chamada → agente retorna aviso pedindo confirmacao
2. Usuario confirma → segunda chamada executa a tool
3. Eventos `tool_approved` / `tool_denied` logados no `activity_log`

Controlado pela feature flag `tool-approval`.

## Gerenciamento de Sessao

### TTL e GC

- **Session TTL**: 30 minutos de inatividade
- **GC**: A cada 5 minutos, sessoes expiradas sao detectadas
- Sessoes expiradas disparam o Session Compactor (veja [memoria.md](./memoria.md))

### Sessoes Discord vs Web

| Aspecto | Discord | Web |
| ------- | ------- | --- |
| Session ID | Canal Discord ID | UUID gerado no browser |
| Streaming | Via message edits | Via SSE |
| Persistencia | Sempre | Por tab/session |
| Canal | `discord` | `web` |
| Rate limit | 20 msgs/min | 20 msgs/min |

### Rate Limiting

```typescript
const RATE_LIMIT = 20; // mensagens por minuto
```

Se o usuario ultrapassar 20 mensagens/min, recebe uma mensagem de throttle.

## Graceful Shutdown

O sistema usa `AbortController` global para shutdown gracioso:

- `shutdownSignal` global emitido em SIGTERM/SIGINT
- Cleanup hooks registrados com prioridade e timeout individual
- `cancellableDelay()` e `cancellableFetch()` respeitam o sinal de shutdown
- Modulos registram handlers via `onShutdown()` para limpeza

## Tratamento de Erros

> ⚠️ **Atencao:** O pipeline tem fault isolation em cada middleware. Um modulo de contexto falhando nao derruba o sistema — o agente responde com menos contexto.

- **Context middleware**: `Promise.allSettled` — cada componente falha independentemente
- **Tool execution**: `Promise.allSettled` — uma tool falhando retorna erro como string, o LLM decide como proceder
- **LLM call**: Fallback chain tenta modelos alternativos; timeout de 90s previne hanging
- **Error codes**: `HawkErrorCode` enum com 40+ codigos categorizados (database, validation, auth, external, budget, agent, security, automation)
- **Budget exceeded**: Retorna mensagem amigavel sem chamar o LLM
- **Empty response**: Lanca `HawkError` com codigo `LLM_CALL_FAILED`

## createPipeline()

O runner e generico e permite criar pipelines customizados:

```typescript
export function createPipeline(middlewares: Middleware[]): (ctx: HandlerContext) => Promise<void> {
  return async (ctx) => {
    let index = 0;
    async function next() {
      if (index >= middlewares.length) return;
      const mw = middlewares[index++];
      await mw.execute(ctx, next);
    }
    await next();
  };
}
```

O `defaultPipeline` e exportado de `middleware/index.ts` com os 7 middlewares na ordem correta.
