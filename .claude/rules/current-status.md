# Current Status

**Ultima atualizacao:** 2026-04-03

## Wave 7 — Platform & UX (2026-04-03)
**Status: [✅ Completo]**

4 padrões de plataforma implementados. Todas as 7 waves do Reference Repo Analysis estão completas.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Context References | `packages/context-engine/src/context-references.ts`: Parser para `@file:path`, `@url:endpoint`, `@memory:query`. Token budgets com hard/soft limits (4K total, 2K soft/ref, 8K hard/ref). `extractReferences()` remove refs da mensagem, `resolveReferences()` busca conteúdo, `formatReferencesAsContext()` injeta no LLM. Feature flag `context-references`. |
| Typed SSE Packets | `apps/agent/src/api/sse-packets.ts`: 45 event types tipados com payloads TypeScript. Categorias: connection (4), chat (5), tools (8), sessions (4), modules (3), memory (4), automation (6), demands (4), security (2), system (5). `createPacket()`, `serializeSSE()`, `serializeWS()` helpers. Feature flag `typed-sse-packets`. |
| Multi-Channel | `apps/agent/src/channels/types.ts` expandido com `ChannelCapabilities` (12 capabilities). Presets para Discord, Web, Telegram, WhatsApp. `getFormattingHints()` gera prompt hints a partir de capabilities. Discord adapter atualizado com capabilities. Feature flag `multi-channel`. |
| Plugin SDK | `packages/extensions/core/plugin-sdk.ts`: Lifecycle completo (discover → init → ready → reload → unload). `PluginManifest` com permissions e dependencies. Topological sort para init order. `getPluginTools()` para tool routing, `collectPluginContext()` para context injection. 7 permission types. Feature flag `plugin-sdk`. |
| Feature Flags | 4 novos flags: `context-references`, `typed-sse-packets`, `multi-channel`, `plugin-sdk`. |

### Ficheiros novos/modificados:

| Ficheiro | Tipo |
|----------|------|
| `packages/context-engine/src/context-references.ts` | Novo — @ref parser + token budgets |
| `apps/agent/src/api/sse-packets.ts` | Novo — 45 typed SSE event types |
| `packages/extensions/core/plugin-sdk.ts` | Novo — Plugin SDK com lifecycle |
| `apps/agent/src/channels/types.ts` | Modificado — ChannelCapabilities + presets |
| `apps/agent/src/channels/discord-adapter.ts` | Modificado — capabilities integration |
| `packages/context-engine/src/index.ts` | Modificado — exporta context references |
| `packages/extensions/core/index.ts` | Modificado — exporta token-manager + plugin-sdk |
| `packages/shared/src/feature-flags.ts` | Modificado — 4 novos flags |

## Wave 6 — Intelligence & Cost (2026-04-03)
**Status: [✅ Completo]**

4 padrões de inteligência e otimização de custo implementados.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Iterative Context Summaries | Template Goal/Progress/Decisions/Next em `history-compressor.ts`. LLM resume com template estruturado (Objetivo, Progresso, Decisões, Próximo, Dados). Fallback sem LLM extrai estrutura dos user/assistant messages. Feature flag `iterative-summaries`. |
| Weighted RRF Hybrid Search | `hybrid_search_memories_rrf()` RPC com Reciprocal Rank Fusion. Formula: score = Σ(weight_i / (k + rank_i)). k=60 default (Onyx reference). Fallback chain: RRF → simple weighted → vector-only. Pesos default 0.6 vector / 0.4 keyword. Feature flag `rrf-hybrid-search`. |
| Credential Pool with Rotation | `apps/agent/src/credential-pool.ts`: 3 estratégias (FILL_FIRST, ROUND_ROBIN, LEAST_USED). Cooldown automático após rate limit. Daily reset. Usage tracking (calls, tokens). `credential_pool` table com encryption. Feature flag `credential-pool`. |
| Smart Model Routing (Enhanced) | Cost-aware downgrade: >80% budget → complex downgrades a moderate; >95% → tudo downgrades a simple. CRUD detection (registra, lista, cria, deleta) em single-module → simple tier. Multi-question detection. Feature flag `cost-aware-routing`. |
| Feature Flags | 4 novos flags: `iterative-summaries`, `rrf-hybrid-search`, `credential-pool`, `cost-aware-routing`. |
| Migration | `20260416000000_wave6_rrf_credential_pool.sql`: RRF RPC function + credential_pool table. |

### Ficheiros novos/modificados:

| Ficheiro | Tipo |
|----------|------|
| `apps/agent/src/credential-pool.ts` | Novo — credential pool with 3 rotation strategies |
| `packages/db/supabase/migrations/20260416000000_wave6_rrf_credential_pool.sql` | Novo — RRF RPC + credential_pool table |
| `apps/agent/src/history-compressor.ts` | Modificado — iterative summary template |
| `apps/agent/src/model-router.ts` | Modificado — cost-aware routing + CRUD detection |
| `packages/modules/memory/embeddings.ts` | Modificado — RRF hybrid search with fallback chain |
| `packages/shared/src/feature-flags.ts` | Modificado — 4 novos flags |

## Wave 5 — MCP, Connectors, Infrastructure (2026-04-03)
**Status: [✅ Completo]**

7 padrões de infraestrutura implementados: SSRF, graceful shutdown, URL filters, SSE streaming, OAuth auto-refresh, worker token tracking, MCP scaffold.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| SSRF Validation | `@hawk/shared/ssrf-validator.ts`: `validateURLForSSRF()` e `validateWebhookURL()`. Bloqueia IPs privados (RFC 1918), loopback, link-local, metadata endpoints, DNS rebinding. Webhooks requerem HTTPS + FQDN. Feature flag `ssrf-validation`. |
| Graceful Shutdown | `apps/agent/src/shutdown.ts`: AbortController global (`shutdownSignal`), cleanup hooks com prioridade e timeout individual, `cancellableDelay()` e `cancellableFetch()`. `onShutdown()` para registrar handlers por módulo. |
| URL-Synced Filters | `apps/web/lib/hooks/use-url-filters.ts`: Hook `useURLFilters(basePath)` genérico. API: `get/set/setMany/remove/toRecord`. Substitui pattern repetido de `updateParams` em finances/calendar/health. |
| SSE Streaming | `GET /stream` endpoint no agent API server. Server-Sent Events com typed events, keepalive 15s, auto-cleanup on disconnect. Broadcast para SSE + WebSocket em paralelo. |
| OAuth Token Manager | `packages/extensions/core/token-manager.ts`: Auto-refresh com 60s buffer antes do expiry. Lock contra concurrent refreshes. 3 retries máximo. Persistência automática via callback. `getValidToken()` API simples. |
| Worker Token Tracking | `cost-tracker.ts` expandido: `trackWorkerCall(task, tokens)` por task type (compression, memory_extraction, dedup_decision, etc.). `getWorkerUsageSummary()` e `getTotalWorkerTokens()` para monitoring. |
| MCP Scaffold | `packages/mcp/` package novo. **Client**: discovery-first setup (connect → discover → select tools → ready), connection registry, `getEnabledMCPTools()`. **Server**: tool/resource registry, `registerMCPTool()`, `executeTool()`. Suporta stdio + SSE transport. |
| Feature Flags | 6 novos flags Wave 5: `mcp-client`, `mcp-server`, `sse-streaming`, `ssrf-validation`, `oauth-auto-refresh`, `worker-token-tracking`. |

### Ficheiros novos/modificados:

| Ficheiro | Tipo |
|----------|------|
| `packages/shared/src/ssrf-validator.ts` | Novo — SSRF validation utility |
| `apps/agent/src/shutdown.ts` | Novo — AbortController + cleanup hooks |
| `apps/web/lib/hooks/use-url-filters.ts` | Novo — URL-synced filter hook |
| `packages/extensions/core/token-manager.ts` | Novo — OAuth auto-refresh manager |
| `packages/mcp/src/types.ts` | Novo — MCP protocol types |
| `packages/mcp/src/client.ts` | Novo — MCP client (discovery-first) |
| `packages/mcp/src/server.ts` | Novo — MCP server (tool/resource registry) |
| `packages/mcp/src/index.ts` | Novo — MCP package exports |
| `packages/mcp/package.json` | Novo — MCP package config |
| `packages/shared/src/index.ts` | Modificado — exporta ssrf-validator |
| `packages/shared/src/feature-flags.ts` | Modificado — 6 novos flags Wave 5 |
| `apps/agent/src/api/server.ts` | Modificado — SSE endpoint + SSE clients |
| `apps/agent/src/cost-tracker.ts` | Modificado — worker token tracking |
| `apps/agent/src/index.ts` | Modificado — shutdown hooks integration |

## Wave 4 Remaining — Security, Reliability & UX Patterns (2026-04-03)
**Status: [✅ Completo]**

7 padrões restantes do Wave 4 implementados (top 7 do Reference Repo Analysis). Score estimado subiu de ~98 para ~99/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Secret Redaction | 51+ regex patterns em `@hawk/shared/secret-redactor.ts`. Redacta API keys, tokens, URIs de DB, PEM keys do contexto LLM. Aplica-se a mensagens do usuário e context sections antes de enviar ao LLM. Feature flag `secret-redaction`. |
| Prompt Injection | 14 regex + unicode detection em `@hawk/shared/prompt-injection-scanner.ts`. Detecta role hijacking, delimiter injection, data exfiltration, jailbreak, encoding evasion. Threat levels: none/low/medium/high/critical. Feature flag `prompt-injection-scanning`. |
| Error Codes | `HawkErrorCode` enum com 40+ códigos categorizados (database, validation, auth, external, budget, agent, security, automation, module, channel). `getErrorCategory()` para dashboard grouping. `isRetriable()` para retry logic. Backward-compatible com `ErrorCodes` existente. |
| [SILENT] Cron | Check-in matinal suprimido quando user inativo 24h. Check-in noturno suprimido quando todos os hábitos completados + mood logado. Eventos `automation_skipped` no activity_log. Feature flag `silent-cron`. |
| Fault Isolation | Cada componente (context, memory, history, previous session) falha independentemente com logging estruturado via pino. Erros classificados com `HawkErrorCode` e logados no activity_log com `component` field. |
| Platform Hints | System prompt inclui formatação específica por channel: Discord (2000 char limit, sem tabelas, emojis moderados) vs Web (Markdown completo, tabelas, headings). Feature flag `platform-hints`. |
| Tool Pair Sanitization | `sanitizeToolPairs()` em `history-compressor.ts`: remove orphaned tool responses sem assistant tool_call correspondente, strip tool_calls de assistant messages sem tool response correspondente. Executa após compressão de histórico. |
| Feature Flags | 4 novos flags: `secret-redaction`, `prompt-injection-scanning`, `silent-cron`, `platform-hints` (todos enabled por default). |
| Activity Log | 5 novos event types: `security`, `automation_skipped`, `module_detection`, `session_cost`, `client_error`. |
| Migration | `20260415000000_wave4_remaining_patterns.sql`: constraint expandida com novos event types. |

### Ficheiros novos/modificados:

| Ficheiro | Tipo |
|----------|------|
| `packages/shared/src/secret-redactor.ts` | Novo — 51+ pattern redaction |
| `packages/shared/src/prompt-injection-scanner.ts` | Novo — 14 pattern + unicode scanner |
| `packages/shared/src/error-codes.ts` | Modificado — HawkErrorCode enum (40+ codes) |
| `packages/shared/src/errors.ts` | Modificado — usa HawkErrorCode enum |
| `packages/shared/src/feature-flags.ts` | Modificado — 4 novos flags |
| `packages/shared/src/index.ts` | Modificado — exporta novos módulos |
| `apps/agent/src/handler.ts` | Modificado — security scanning, fault isolation, platform hints |
| `apps/agent/src/history-compressor.ts` | Modificado — tool pair sanitization |
| `apps/agent/src/automations/daily-checkin.ts` | Modificado — [SILENT] suppression |
| `packages/db/supabase/migrations/20260415000000_wave4_remaining_patterns.sql` | Novo — migration |

## Wave 4 — Reference Repo Patterns (2026-04-03)
**Status: [✅ Completo]**

Adoção de padrões inspirados por 6 repos de referência (TaxHacker, OpenClaw, Hermes Agent, Onyx, fff.nvim, prompts.chat). Score estimado subiu de ~97 para ~98/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Feature Flags | Per-tenant feature flags via `tenants.feature_flags` JSONB. Defaults em `@hawk/shared/feature-flags.ts`. Flags para Wave 4-7 definidas. |
| Tool Approval | Tools com `dangerous: true` agora requerem confirmação: primeira chamada retorna aviso, segunda executa. `tool_approved`/`tool_denied` events no activity_log. |
| Hybrid Search | pg_trgm + pgvector: `hybrid_search_memories()` RPC combina keyword similarity + vector cosine. GIN trigram index em `agent_memories.content`. Fallback para vector-only se RPC não existir. |
| Frecency Scoring | `module_access_log` table + `module_frecency` materialized view. Sidebar ordena módulos por score (1d×10 + 7d×3 + 30d×1). Hook `useModuleFrecency` + server action `trackModuleAccess`. |
| Activity Log | Novos event types: `tool_approved`, `tool_denied`. Constraint expandida. |
| Migration | `20260414000000_wave4_feature_flags_hybrid_search_frecency.sql`: feature_flags column, pg_trgm extension, hybrid search RPC, frecency tables + materialized view, pruning function. |

### Ficheiros novos/modificados:

| Ficheiro | Tipo |
|----------|------|
| `packages/shared/src/feature-flags.ts` | Novo — feature flag utility |
| `packages/db/supabase/migrations/20260414000000_wave4_*.sql` | Novo — migration |
| `apps/web/lib/actions/frecency.ts` | Novo — server action |
| `apps/web/lib/hooks/use-module-frecency.ts` | Novo — React hook |
| `apps/agent/src/tool-executor.ts` | Modificado — tool approval gate |
| `packages/modules/memory/embeddings.ts` | Modificado — hybridSearchMemories() |
| `packages/modules/memory/retrieval.ts` | Modificado — hybrid search integration |
| `apps/web/components/shell/sidebar.tsx` | Modificado — frecency sorting + tracking |

## Agent Audit 360° — Model Agnosticism (2026-04-03)
**Status: [✅ Completo]**

Auditoria completa do sistema de agentes com foco em compatibilidade com modelos free do OpenRouter. Score estimado de robustez subiu de ~95 para ~97/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Fallback Chain | Tool-aware: separa modelos com/sem `tool_choice`, evita enviar tool_choice a modelos incompatíveis (stepfun, minimax) |
| Context Window | Validação per-model: mapa de context limits (12 modelos), warning quando >90% do limite |
| Token Estimation | Per-model: multilingual models (Qwen, GLM) usam ~3 chars/token vs 4 chars/token padrão |
| Model Routing | Fallback atualizado: Qwen 3.6 Plus (1M ctx), Nemotron 120B (262K), Llama 3.3 70B (65K) |
| Max Tool Rounds | Limite de 5 rounds no tool loop, previne loops infinitos com modelos menores |
| Worker Models | Default atualizado de `sourceful/riverflow-v2-fast` para `nvidia/nemotron-nano-9b-v2:free` (llm-client, session-commit, deduplicator) |
| Cost Tracker | Free models ($0): `estimateCostUsd()` retorna 0 para modelos `:free`, evita budget falso-positivo |
| .env.example | Novas variáveis documentadas: MODEL_TIER_*, MEMORY_WORKER_MODEL, DEDUP_WORKER_MODEL |
| Tests | 93 testes agent (0 falhas), +12 testes novos (getContextLimit, supportsToolChoice, estimateTokenCount, free model cost) |

## Production Hardening (2026-04-03)
**Status: [✅ Completo]**

Hardening para deploy em VPS Hostinger KVM4. Score estimado subiu de ~90 para ~95/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| HTTPS | Caddy reverse proxy com HTTPS automatico (Let's Encrypt), HTTP/3, headers de seguranca |
| VPS Setup | setup-vps.sh reescrito: user hawk, SSH key-only, fail2ban, swap 2GB, UFW (22/80/443), unattended-upgrades, logrotate |
| Deploy | deploy.sh: git pull → backup → migrations → build → health check → resumo (flags: --skip-backup, --no-pull) |
| Dockerfile | Agent multi-stage build (deps cacheadas, imagem menor) |
| Cost Tracking | Persistencia em admin.tenant_metrics (sobrevive restarts), load do DB no startup |
| Health Checks | /health verifica DB (latencia), ?deep=true verifica OpenRouter + Discord, retorna 503 se DB down |
| Security | Removido dev-login endpoint, removido NODE_ENV bypass em admin-auth |
| Tenant Isolation | 7 testes (AsyncLocalStorage, schema leak, SQL injection), validateSchemaName() em rawQuery |
| Dashboard | Widgets cost-history (gastos 14d com trend) e error-summary (top erros por componente) |
| Backups | Verificacao de integridade pos-upload, limite 200k rows (era 50k), alertas de truncamento |
| Organizacao | Dockerfiles em docker/, scripts legado em scripts/legacy/, .env.example consolidado |

## Wave 3 Improvements (2026-04-01 → 2026-04-03)
**Status: [✅ Completo]**

Hardening agressivo em seguranca, testes, observabilidade. Score estimado subiu de ~78 para ~90/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Life Score Widget | Score real de 5 dimensoes (health/finances/objectives/routine/people) com SVG ring animado |
| Proactive Insights | fetchInsights() gap-scanner: 7 checagens (sono, treino, transacoes, budget, overdue, habitos, interacoes) |
| Insights Widget | Cards com severity (critical/warning/info) + action links registrado no WIDGET_REGISTRY |
| PWA Complete | Service worker (cache-first static, network-first pages) + manifest + SW registration |
| Security Headers | X-Frame-Options DENY, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP |
| CSP | Content-Security-Policy com default-src, script-src, connect-src (Supabase, OpenRouter), frame-ancestors none |
| Error Handling | Todos os modulos: 0 throw new Error em packages/modules/. EMBEDDING_FAILED + BUDGET_EXCEEDED codes |
| XSS Protection | sanitizeHtml() + stripTags() em @hawk/shared. 9 testes de sanitizacao |
| Lint Clean | Handler.ts noInvalidUseBeforeDeclaration fix, 30 files auto-formatted, zero lint errors |
| Context Keywords | Verbos conjugados (gastei, paguei, comprei, treinei, dormi, corri) para melhor detecção |
| Observability | /metrics endpoint: Prometheus format (uptime, sessions, tokens, cost, messages) |
| Tests | 117 → 161 testes (+44), 15 → 17 test files. Novos: tool-executor, memory BFS, context-engine, model-router budget, sanitization |
| E2E Tests | Playwright: smoke, security headers, CSP validation, rate limiting, PWA manifest, service worker |
| Mobile | calendar, people, routine pages responsive (stacking + grid adjustments) |

## Wave 2 Improvements (2026-03-29)
**Status: [✅ Completo]**

Continuacao do hardening. Score estimado subiu de ~69 para ~78/100.

### O que foi implementado:

| Area | O que mudou |
|------|------------|
| Zod Validation | +3 modulos completados: career, entertainment, legal → 18/18 agora |
| Tool Arg Validation | Zod schemas para save_memory, create_transaction, log_sleep, log_workout, create_person |
| Budget Control | Daily budget guard: MODEL_DAILY_BUDGET_USD env var, trackUsage() no handler |
| Memory System | getLinkedMemories com BFS multi-hop real (ate 3 hops), explore_memory_graph tool |
| Context Engine | Keywords expandidos (~3x mais por modulo), requiresSpecificData patterns adicionados |
| Agent Intelligence | Confidence signaling: "Acredito que..." / "Nao tenho certeza..." instructions |
| Mobile | Dashboard layout, sidebar overlay, topbar hamburger, finances/health/people/objectives/calendar/routine |
| A11y | aria-label em sidebar/topbar, aria-current em nav links, biome ARIA rules enabled |
| Tests | 84 → 117 testes, 12 → 15 test files (context-engine, shared/validation, agent-resolver) |
| i18n | next-intl wired: withNextIntl plugin + NextIntlClientProvider em layout |
| Error Tracking | /errors endpoint no agent server + error-reporter.ts no web |
| Welcome Wizard | Componente de onboarding para novos usuarios |
| Web Vitals | initWebVitals() monitorando LCP/FID/CLS |
| Memory Forgetter | Automation: arquiva memorias nao usadas (>90d sem acesso ou >180d) |
| Layout Export/Import | Export/import de widget layout como JSON nas settings |

## P0 Proximas Acoes

1. Multi-tenant observability (por-tenant activity_log dashboard widget)
2. CSP nonces para inline scripts (upgrade de unsafe-inline)
3. Playwright CI integration (GitHub Actions workflow)
4. Agent: A/B model testing pipeline
5. Data export (GDPR compliance: export all user data as JSON)
