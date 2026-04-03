# Current Status

**Ultima atualizacao:** 2026-04-03

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
