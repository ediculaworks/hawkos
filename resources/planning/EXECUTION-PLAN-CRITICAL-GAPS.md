# Plano de Execucao: 3 Gaps Estruturais Criticos

**Contexto:** A auditoria de 2026-03-27 revelou nota 45/100. Os 3 achados mais criticos sao:
1. O Triangulo Error/Validation/Logging — infraestrutura existe mas zero modulos usam
2. Agente e um loop simples — sem reasoning, reflection, ou cost tracking
3. Zero CI/CD + seguranca web — cada deploy e risco, sem security headers

Este plano resolve os 3 de forma incremental, testavel, sem quebrar o que funciona.

---

## Fase 1: Wire the Triangle (Error + Validation + Logger)

**Impacto:** Toca todos os 18 modulos. Transforma observabilidade, debugging e integridade de dados.
**Risco:** Baixo — so muda como erros sao thrown/logged, nao muda comportamento.
**Estimativa:** 18 modulos × ~15 min cada = ~4-5h

### O que existe (nao precisa ser criado):
- `HawkError(message, code)`, `ValidationError(message)`, `NotFoundError(resource)`, `AuthorizationError()` em `packages/shared/src/errors.ts`
- `createLogger(name): Logger` (pino com pretty-print em dev, JSON em prod) em `packages/shared/src/logger.ts`
- 10+ Zod schemas em `packages/shared/src/validation.ts`
- Tudo exportado via `packages/shared/src/index.ts`

### Padrao-alvo para cada modulo:

```typescript
// No topo do queries.ts:
import { createLogger, HawkError, NotFoundError } from '@hawk/shared';
const logger = createLogger('finances');

// Em cada funcao:
export async function createTransaction(input: CreateTransactionInput) {
  logger.info({ input }, 'Creating transaction');

  const { data, error } = await db.from('finance_transactions').insert([...]).select().single();

  if (error) {
    logger.error({ error: error.message, input }, 'DB insert failed');
    throw new HawkError(`Failed to create transaction: ${error.message}`, 'DB_INSERT_FAILED');
  }

  if (!data) throw new NotFoundError('transaction');

  logger.debug({ id: data.id }, 'Transaction created');
  return data;
}
```

### Steps:

**1.1** Criar error codes centralizados em `packages/shared/src/error-codes.ts`:
```typescript
export const ErrorCodes = {
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_INSERT_FAILED: 'DB_INSERT_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  DB_DELETE_FAILED: 'DB_DELETE_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_API_FAILED: 'EXTERNAL_API_FAILED',
} as const;
```

**1.2** Wire os 7 modulos ricos (maior impacto primeiro):
- `packages/modules/finances/queries.ts` (610 LOC, ~30 funcoes)
- `packages/modules/health/queries.ts` (995 LOC, ~45 funcoes)
- `packages/modules/people/queries.ts` (606 LOC, ~25 funcoes)
- `packages/modules/routine/queries.ts` (303 LOC, ~15 funcoes)
- `packages/modules/objectives/queries.ts` (534 LOC, ~20 funcoes)
- `packages/modules/memory/queries.ts` (402 LOC, ~15 funcoes)
- `packages/modules/calendar/queries.ts` (~250 LOC, ~12 funcoes)

**1.3** Wire os 11 modulos lightweight:
- career, knowledge, demands, legal, assets, housing, entertainment, security, social, spirituality, journal

**1.4** Wire o agent handler:
- `apps/agent/src/handler.ts` — tool execution errors, LLM call errors
- `apps/agent/src/automations/*.ts` — automation errors

**1.5** Adicionar Zod validation nas mutations criticas:
- `createTransaction()` — validar amount, type, date
- `logSleep()` — validar duration, quality range
- `createPerson()` — validar name, email format
- `createHabit()` — validar frequency enum
- `createObjective()` — validar priority range

### Verificacao:
- `bun run build` — zero erros
- `bun run lint` — zero erros novos
- `grep -r "throw new Error(" packages/modules/ | wc -l` — deve ser 0
- `grep -r "createLogger" packages/modules/ | wc -l` — deve ser 18 (um por modulo)

---

## Fase 2: ReAct Loop + Cost Tracking + History Compression

**Impacto:** Core value proposition — agente passa de "loop burro" para raciocinio estruturado.
**Risco:** Medio — muda o comportamento do agente. Precisa de feature flag.
**Ficheiro principal:** `apps/agent/src/handler.ts`

### 2.1 — ReAct: Think Step (antes de tools)

**Onde:** Apos montar messages, antes do primeiro `callLLM()` (~linha 243)

**Como:** Adicionar instrucao ReAct ao system prompt quando o agente detecta que a query e complexa (multi-module ou requer dados de multiplas fontes):

```typescript
// No system prompt, adicionar bloco ReAct:
const REACT_INSTRUCTION = `
When handling complex requests, follow this pattern:
1. THINK: Analyze what information you need and which tools to use
2. ACT: Execute the necessary tools
3. OBSERVE: Check if the results answer the question
4. REFLECT: If not complete, plan next steps

For simple greetings or quick facts, respond directly without this pattern.
`;
```

**Decisao de complexidade:** Usar o score do context engine:
- Se `relevanceScores.length >= 2` (multi-module) → ativar ReAct
- Se mensagem contem palavras como "analisa", "compara", "planeja" → ativar ReAct
- Caso contrario → resposta direta (sem overhead)

### 2.2 — ReAct: Reflect Step (apos tools)

**Onde:** Dentro do tool loop, apos tool results coletados (~linha 388), antes de chamar LLM novamente

**Como:** Injetar mensagem de reflexao:

```typescript
// Apos tool results coletados:
if (toolCalls.length > 1 || isComplexQuery) {
  toolMessages.push({
    role: 'system',
    content: `Reflect on the tool results above. Did they provide what you needed?
              If not, explain what's missing before proceeding.`,
  });
}
result = await callLLM(toolMessages, false); // Reflection nao streama
```

### 2.3 — Cost Tracking

**Onde:** Apos cada `callLLM()` e `_callLLMOnce()`

**Como:** Acumular tokens e salvar no `activity_log`:

```typescript
interface SessionCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCalls: number;
  toolCalls: number;
  model: string;
}

// Apos cada callLLM():
sessionCost.totalTokens += result.usage?.total_tokens ?? 0;
sessionCost.promptTokens += result.usage?.prompt_tokens ?? 0;
sessionCost.completionTokens += result.usage?.completion_tokens ?? 0;
sessionCost.llmCalls++;

// No final da sessao:
logActivity('session_cost', { ...sessionCost, sessionId });
```

### 2.4 — History Compression

**Onde:** Antes do token threshold warning (~linha 215)

**Como:** Usar o worker LLM (Ollama) para comprimir mensagens antigas:

```typescript
// Se estimatedTokens > COMPRESSION_THRESHOLD (60k, antes dos 80k de warning):
const oldMessages = history.slice(0, -10); // Manter ultimas 10 intactas
const recentMessages = history.slice(-10);

const summary = await compressHistory(oldMessages); // Worker LLM call
// summary = "O usuario discutiu X, decidiu Y, pediu Z..."

messages = [
  systemPrompt,
  { role: 'system', content: `Previous conversation summary:\n${summary}` },
  ...recentMessages,
  userMessage,
];
```

**Threshold duplo:**
- 60k tokens → comprimir historico (silencioso, sem aviso ao user)
- 80k tokens → warning ao LLM para salvar memorias (existente)

### 2.5 — Feature Flag

Tudo controlado por flag no agent template:

```typescript
// Em agent_templates ou agent_settings:
react_mode: 'auto' | 'always' | 'never'  // default: 'auto'
cost_tracking: boolean                     // default: true
history_compression: boolean               // default: true
```

### Verificacao:
- Testar com query simples ("ola") — deve responder direto sem ReAct overhead
- Testar com query complexa ("analisa meus gastos do mes e compara com objetivos") — deve mostrar raciocinio
- Verificar `activity_log` tem entries de `session_cost`
- Verificar compression ativa em sessoes longas (>60k tokens estimados)
- `bun run build` — zero erros
- `bun run test` — testes existentes passam

---

## Fase 3: CI Pipeline + Security Headers

**Impacto:** Previne regressoes e fecha vulnerabilidades criticas.
**Risco:** Baixo — adiciona protecoes sem mudar comportamento.

### 3.1 — GitHub Actions CI

**Ficheiro:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: '1.3.10'
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run test
      - run: bun run build
```

### 3.2 — Security Headers

**Ficheiro:** `apps/web/next.config.ts` (ja tem `async headers()`)

Adicionar a TODAS as rotas:

```typescript
{
  source: '/:path*',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    },
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss: https://*.supabase.co; font-src 'self';",
    },
  ],
},
```

### 3.3 — Rate Limiting no Middleware

**Ficheiro:** `apps/web/middleware.ts` (ou `lib/supabase/middleware.ts`)

Adicionar rate limiting simples baseado em IP via headers:

```typescript
// Rate limiter in-memory (reset por deploy, ok para single-instance)
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
```

API routes criticas com limites especificos:
- `/api/factory-reset` → 1 request/hora
- `/api/agent/*` → 60 requests/minuto
- Todas as outras → 100 requests/minuto

### 3.4 — Remover Credentials de Window Globals

**Ficheiro:** `apps/web/app/layout.tsx`

**Problema atual:** `window.__HAWK_TENANT__` expoe `supabaseUrl` e `supabaseAnonKey` no HTML source.

**Solucao:** Mover para cookie httpOnly ou server-side only:
- `supabaseUrl` e `supabaseAnonKey` ja estao no cookie `hawk_tenant` (lido pelo middleware)
- Client-side Supabase client pode ser inicializado via API route `/api/tenant-config` que retorna apenas o necessario
- OU: manter no script mas remover `supabaseAnonKey` (a anon key e publica por design no Supabase — RLS protege os dados)

**Decisao:** A anon key do Supabase e **publica por design** (faz parte do URL publico). O risco real e minimo dado que RLS esta ativo. Manter a injecao mas documentar que e intencional. Focar esforco nos security headers que tem impacto real.

### 3.5 — Env Validation no Boot

**Ficheiro:** `apps/agent/src/index.ts` (ja tem `validateEnv()`)

Melhorar para fail-fast em chaves criticas:

```typescript
function validateEnv() {
  const required = ['DISCORD_BOT_TOKEN', 'DISCORD_AUTHORIZED_USER_ID', 'OPENROUTER_API_KEY'];
  const missing = required.filter((k) => !process.env[k] || process.env[k] === 'not-set');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

### Verificacao:
- Push para branch → GitHub Actions roda lint + test + build
- `curl -I https://app.hawkos.com` → headers de seguranca presentes
- Testar rate limiting: 101 requests rapidos → 429 na 101a
- `bun run build` — zero erros

---

## Ordem de Execucao

| # | Fase | Dependencia | Impacto na nota |
|---|------|-------------|-----------------|
| 1 | 1.1: Error codes | Nenhuma | +0 (prep) |
| 2 | 1.2: Wire 7 modulos ricos | 1.1 | +3 (data integrity) |
| 3 | 3.1: GitHub Actions CI | Nenhuma | +3 (CI/CD) |
| 4 | 3.2: Security headers | Nenhuma | +2 (seguranca) |
| 5 | 3.3: Rate limiting | Nenhuma | +1 (seguranca) |
| 6 | 1.3: Wire 11 modulos lightweight | 1.1 | +2 (data integrity) |
| 7 | 1.4: Wire agent handler | 1.1 | +1 (observability) |
| 8 | 1.5: Zod nas mutations | 1.2 | +1 (validation) |
| 9 | 2.1: ReAct think step | Nenhuma | +3 (agent intelligence) |
| 10 | 2.2: ReAct reflect step | 2.1 | +2 (agent intelligence) |
| 11 | 2.3: Cost tracking | Nenhuma | +2 (model routing) |
| 12 | 2.4: History compression | Nenhuma | +2 (token optimization) |
| 13 | 3.4: Env validation | Nenhuma | +0.5 (seguranca) |

**Impacto total estimado:** +22.5 pontos → nota de ~67/100

---

## Ficheiros Criticos (por fase)

### Fase 1 (Triangle):
- `packages/shared/src/error-codes.ts` (NOVO)
- `packages/shared/src/index.ts` (adicionar export)
- `packages/modules/*/queries.ts` (18 ficheiros — EDIT)
- `apps/agent/src/handler.ts` (EDIT)

### Fase 2 (ReAct):
- `apps/agent/src/handler.ts` (EDIT — principal)
- `apps/agent/src/history-compressor.ts` (NOVO)
- `apps/agent/src/cost-tracker.ts` (NOVO)

### Fase 3 (CI + Security):
- `.github/workflows/ci.yml` (NOVO)
- `apps/web/next.config.ts` (EDIT — headers)
- `apps/web/lib/rate-limit.ts` (NOVO)
- `apps/web/middleware.ts` (EDIT — rate limiting)
- `apps/agent/src/index.ts` (EDIT — env validation)
