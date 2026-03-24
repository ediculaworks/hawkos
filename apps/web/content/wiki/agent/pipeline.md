# Pipeline do Agente

## Visão Geral

Toda mensagem enviada para o Hawk OS passa pela função `runLLMSession()` em `apps/agent/src/handler.ts`. O pipeline tem 10 etapas principais que vão desde receber a mensagem bruta até salvar a resposta final.

> 🧩 **Para leigos:** Cada vez que você manda uma mensagem pro agente, ela passa por um processo de 10 etapas antes de você receber a resposta. É como uma linha de produção: primeiro anota a mensagem, depois busca o contexto relevante, depois pede pro LLM pensar, e por fim salva a resposta. Tudo acontece em menos de 5 segundos.

## Fluxo Completo

```
Mensagem recebida (Discord ou Web)
           │
           ▼
    0. Emit hooks (session:start, message:received)
           │
           ▼
    1. Salvar mensagem do usuário no banco
           │
           ▼
    2. Carregar contexto em paralelo:
       ├─ assembleContext(message)      → L0/L1/L2
       ├─ retrieveMemories(message, 5)  → top 5 memórias
       ├─ getSessionMessages(id, 20)    → histórico
       └─ getLastSessionArchive(ch)     → sessão anterior
           │
           ▼
    3. Incrementar hotness das memórias acessadas
           │
           ▼
    4. Montar seção de contexto
       (L0 + memories + previousSession + L1 + L2)
           │
           ▼
    5. Montar system prompt do template do agente
           │
           ▼
    6. Montar array de mensagens (últimas 20)
       [6b. Aviso de compactação se > 80k tokens]
           │
           ▼
    7. Tool routing dinâmico:
       módulos detectados × módulos permitidos pelo agente
           │
           ▼
    8. Chamar LLM via OpenRouter
       (streaming com onChunk, ou não-streaming para tool calls)
           │
           ▼
    9. Loop de tool calls:
       ├─ Executar tools em paralelo
       ├─ Adicionar resultados ao histórico
       └─ Chamar LLM novamente com resultados
           │
           ▼
   10. Salvar resposta do assistente no banco
```

## Etapas Detalhadas

### Etapa 0 — Hooks

Antes de qualquer processamento, o sistema emite hooks que permitem extensões:

```typescript
await hooks.emit('session:start', { sessionId, channel });
await hooks.emit('message:received', { message, sessionId });
```

Hooks são usados para logging, monitoramento e integrações futuras.

### Etapa 1 — Persistir Mensagem

A mensagem do usuário é salva imediatamente no banco antes de qualquer processamento. Isso garante que mesmo se o pipeline falhar, a mensagem está registrada.

```typescript
await saveMessage({
  sessionId,
  role: 'user',
  content: message,
  channel,
});
```

### Etapa 2 — Carregamento Paralelo de Contexto

Quatro operações em paralelo para minimizar latência:

```typescript
const [context, memories, sessionMessages, lastArchive] = await Promise.all([
  assembleContext(message),           // detecta módulos, carrega L0/L1/L2
  retrieveMemories(message, 5),       // busca semântica + hotness + importance
  getSessionMessages(sessionId, 20),  // últimas 20 mensagens da sessão
  getLastSessionArchive(channel),     // resumo da sessão anterior
]);
```

O `assembleContext` é a parte mais complexa — veja [contexto.md](./contexto.md) para detalhes.

### Etapa 3 — Atualizar Hotness

Cada memória recuperada tem seu `access_count` incrementado e `updated_at` atualizado. Isso alimenta o sistema de hotness scoring para futuras recuperações:

```typescript
await trackMemoryAccess(memories.map(m => m.id));
```

### Etapa 4 — Seção de Contexto

O contexto é montado em ordem de prioridade, com separadores claros:

```
[CONTEXT]
## L0 — Resumo Geral
<dados de todos os módulos, ~500 tokens>

## Memórias Relevantes
<5 memórias mais relevantes para esta mensagem>

## Sessão Anterior
<resumo da última sessão (se existir)>

## L1 — Detalhes dos Módulos Relevantes
<detalhes dos módulos detectados na mensagem, ~2000 tokens>

## L2 — Dados Específicos
<dados granulares quando query específica detectada, ~3000 tokens>
[/CONTEXT]
```

### Etapa 5 — System Prompt

O system prompt vem do template do agente (persona) e inclui:
- Identidade e estilo de comunicação
- Módulos habilitados
- Instruções específicas da persona
- Timestamp atual

```typescript
const systemPrompt = buildSystemPrompt(agentTemplate, {
  currentDate: new Date().toISOString(),
  context: contextSection,
});
```

### Etapa 6 — Array de Mensagens

As últimas 20 mensagens da sessão são incluídas para manter continuidade da conversa. Se o contexto total ultrapassar 80.000 tokens, um aviso de compactação é emitido.

### Etapa 7 — Tool Routing Dinâmico

> 💡 **Dica:** Esta etapa é o que torna o sistema eficiente. Ao invés de dar ao LLM um menu com 30+ opções toda vez, ele recebe só o que é relevante para a conversa atual — como dar ao cozinheiro só os ingredientes do prato que está fazendo.

Esta é uma das funcionalidades mais importantes: o sistema não envia todos os 30+ tools para o LLM a cada chamada. Ele filtra baseado em:

1. Módulos detectados na mensagem (via keywords)
2. Módulos permitidos pelo template do agente (`toolsEnabled`)

```typescript
const detectedModules = context.detectedModules; // ['finances', 'calendar']
const agentModules = agentTemplate.toolsEnabled;  // null = todos
const tools = getToolsForModules(detectedModules, agentModules);
// Resultado: ~5-10 tools ao invés de 30+
```

Tools universais (`modules: []`) são sempre incluídas: `save_memory`, `request_more_tools`.

### Etapa 8 — Chamada LLM

O Hawk OS usa OpenRouter como abstração sobre múltiplos LLMs:

```typescript
// Modo streaming (para Discord/Web em tempo real)
if (onChunk) {
  const stream = await openrouter.chat.completions.create({
    model: process.env.OPENROUTER_MODEL,
    messages,
    tools,
    stream: true,
  });
  for await (const chunk of stream) {
    onChunk(chunk.choices[0].delta.content);
  }
}

// Modo não-streaming (quando há tool calls)
const response = await openrouter.chat.completions.create({
  model: process.env.OPENROUTER_MODEL,
  messages,
  tools,
  max_tokens: 4096,
});
```

### Etapa 9 — Loop de Tool Calls

Se o LLM retornar tool calls, o sistema os executa em paralelo e alimenta os resultados de volta:

```typescript
while (response.choices[0].finish_reason === 'tool_calls') {
  const toolCalls = response.choices[0].message.tool_calls;

  // Execução paralela
  const results = await Promise.all(
    toolCalls.map(tc => executeTool(tc.function.name, tc.function.arguments))
  );

  // Adicionar ao histórico
  messages.push({ role: 'assistant', tool_calls: toolCalls });
  messages.push(...results.map(r => ({ role: 'tool', content: r })));

  // Chamar LLM novamente
  response = await openrouter.chat.completions.create({ messages, tools });
}
```

### Etapa 10 — Salvar Resposta

A resposta final é salva no banco e retornada para o canal:

```typescript
await saveMessage({
  sessionId,
  role: 'assistant',
  content: finalResponse,
  channel,
});

return finalResponse;
```

## Gerenciamento de Sessão

### TTL e GC

- **Session TTL**: 30 minutos de inatividade
- **GC**: A cada 5 minutos, sessões expiradas são detectadas
- Sessões expiradas disparam o Session Compactor (veja [memoria.md](./memoria.md))

### Sessões Discord vs Web

| Aspecto | Discord | Web |
|---------|---------|-----|
| Session ID | Canal Discord ID | UUID gerado no browser |
| Streaming | Via message edits | Via SSE |
| Persistência | Sempre | Por tab/session |
| Canal | `discord` | `web` |
| Rate limit | 20 msgs/min | 20 msgs/min |

### Rate Limiting

```typescript
const RATE_LIMIT = 20; // mensagens por minuto
const rateLimiter = new Map<string, number[]>(); // userId → timestamps
```

Se o usuário ultrapassar 20 mensagens/min, recebe uma mensagem de throttle e a mensagem é descartada.

## Tratamento de Erros

> ⚠️ **Atenção:** O pipeline tem fallbacks em cada etapa para garantir que uma falha parcial não derruba o sistema inteiro. Se o banco de memórias estiver lento, o agente responde sem memórias. Se uma tool falhar, o LLM recebe o erro como texto e decide como proceder.

O pipeline tem fallbacks em cada etapa:
- Se `assembleContext` falhar → usa contexto vazio (L0 genérico)
- Se `retrieveMemories` falhar → continua sem memórias
- Se uma tool falhar → retorna string de erro, o LLM decide como proceder
- Se o LLM falhar → propaga o erro para o canal com mensagem amigável
