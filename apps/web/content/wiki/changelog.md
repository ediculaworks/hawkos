# Changelog do Hawk OS

Histórico de desenvolvimento por onda (wave). Cada onda tem um foco específico e um conjunto de entregáveis.

---

## Status Atual

**Data**: Abril 2026
**Status geral**: Bugfix Audit concluído, sistema production-ready

| Wave | Nome | Status | Concluído |
| ---- | ---- | ------ | --------- |
| W0 | Infraestrutura Core | ✅ Completo | Dez 2025 |
| W1 | Correção de Bugs Críticos | ✅ Completo | Fev 2026 |
| W2 | Health Page Funcional | ✅ Completo | Mar 2026 |
| W3 | Stack Completa | ✅ Completo | Mar 2026 |
| W4 | UI/UX Polish | ✅ Completo | Mar 2026 |
| W5 | Redesign & Simplificação | ✅ Completo | Mar 2026 |
| W4-8 Ref | Reference Repo Integration | ✅ Completo | Abr 2026 |
| Hardening | Production Hardening | ✅ Completo | Abr 2026 |
| Audit 360 | Agent Model Agnosticism | ✅ Completo | Abr 2026 |
| Bugfix | Bugfix Audit (5 rondas) | ✅ Completo | Abr 2026 |

**Métricas atuais**:

- **233 testes**, 0 falhas (25 ficheiros de teste)
- 90+ migrations aplicadas
- ~30 feature flags configuráveis per-tenant
- **8 módulos ativos na sidebar** (finances, health, people, career, objectives, routine, legal, calendar)
- Hawk + Task Agents dinâmicos (sem personas fixas)
- 18 automações ativas
- 40+ tools em 21 ficheiros modulares

---

## W0 — Infraestrutura Core

**Período**: Outubro — Dezembro 2025
**Objetivo**: Montar o esqueleto funcional do sistema antes de implementar funcionalidades.

### Entregáveis

**Monorepo e Tooling**
- Configuração do monorepo com Turborepo 2.x e Bun 1.3
- Linting com Biome (substitui ESLint + Prettier)
- TypeScript 5.7 strict em todos os packages
- Estrutura de packages: `db`, `shared`, `modules/*`, `context-engine`

**Supabase e Banco**
- Schema inicial: 25+ tabelas com RLS habilitado
- Extensões: `pgvector` para embeddings, `pg_trgm` para full-text search
- Sistema de migrations versionado em `packages/db/supabase/migrations/`
- Triggers de `updated_at` em todas as tabelas mutáveis

**Agent Core (Discord Bot)**
- Bot Discord com discord.js v14
- Handler base com integração OpenRouter
- Sistema de sessões com TTL 30min
- Primeiro conjunto de tools (finances + memory)

**Next.js Dashboard**
- Scaffold Next.js 15 com App Router
- Autenticação via Supabase Auth
- Layout base: sidebar + topbar + grid principal
- Primeiras páginas de módulo (finances)

**Memory System V1**
- Tabelas `agent_memories` e `conversation_messages`
- Tool `save_memory` funcional
- Retrieval básico sem embeddings

**Build**: 710 módulos — primeiro build limpo ✅

---

## W1 — Correção de Bugs Críticos

**Período**: Janeiro — Fevereiro 2026
**Objetivo**: Sistema funcionando de ponta a ponta sem crashar.

### Bugs Corrigidos

**Agent / Handler**
- `finish_reason=length`: aumentado `max_tokens` de 1024 para 4096
- Session TTL não resetando corretamente ao receber mensagem
- Tool routing retornando tools de módulos não detectados
- Race condition no carregamento paralelo de contexto

**Chat e Sessões**
- Session list não aparecendo no sidebar do chat
- Mensagens duplicadas ao reconectar ao stream SSE
- Histórico de mensagens carregando em ordem inversa
- Erro de RLS em `conversation_messages` bloqueando leitura

**Migrations e DB**
- 12+ bugs em políticas RLS identificados e corrigidos
- Migration de agent_templates criada para persistir personas
- Índices faltando em FKs de tabelas críticas adicionados

**Dashboard**
- Páginas de módulo crashando com dados vazios (null safety)
- Widget grid não salvando layout em localStorage
- Sidebar não destacando módulo ativo corretamente

### Funcionalidades Adicionadas em W1

- Sistema de rate limiting (20 msgs/min)
- Activity log para todas as execuções de tools
- Página `/dashboard/memory` para visualizar memórias
- Detalhes de sessão no chat

---

## W2 — Health Page Funcional

**Período**: Fevereiro — Março 2026
**Objetivo**: Módulo de saúde completo e funcional como módulo modelo.

### Implementado

**Módulo Health Completo**
- Tabelas: `workout_sessions`, `workout_sets`, `sleep_sessions`, `body_measurements`, `health_observations`
- Tools: `log_workout`, `add_workout_set`, `log_sleep`, `log_weight`, `get_exercise_progress`, `estimate_1rm`
- Contexto L0/L1/L2 com dados reais do banco
- Automação `health-insights.ts` com análise de correlações

**Dashboard Health**
- Página `/dashboard/health` com header, workout history, workout templates
- Workout templates para iniciar sessão rápida (Push/Pull/Legs/Full Body)
- Gráficos de progressão de exercícios (Recharts)
- Visualização de histórico de sono com qualidade

**Memory System V2 (OpenViking-Inspired)**
- 6 tipos de memória: profile, preference, entity, event, case, pattern
- Embeddings via pgvector para busca semântica
- Session Compactor com pipeline de 5 estágios
- Deduplicação em 2 estágios (embedding + LLM decision)
- Hotness scoring com half-lives por módulo

---

## W3 — Stack Completa

**Período**: Março 2026
**Objetivo**: Solidificar a stack técnica e adicionar todos os módulos.

### Implementado

**Todos os Módulos (versão inicial)**
- Types, queries, commands, context (L0/L1/L2) para cada módulo
- 36 comandos Discord registrados (inicial)
- Tool routing dinâmico para todos os módulos

**Arquitetura de Agentes (modelo inicial)**
- Hawk como agente principal + task agents dinâmicos para tarefas especializadas
- Roteamento por canal Discord via `DISCORD_CHANNEL_MAP`
- Dashboard `/dashboard/agents` para gestão de agentes
- _(Personas fixas como CFO/Coach foram removidas em W5 — substituídas por task agents ad-hoc)_

**Automações Completas**
- `alerts.ts`: alertas diários às 08:00 (finanças, saúde, hábitos, jurídico)
- `daily-checkin.ts`: morning (09:00) e evening (22:00) check-ins
- `weekly-review.ts`: revisão semanal aos domingos 20:00
- `session-compactor.ts`: compactação a cada hora
- `health-insights.ts`: análise de saúde configurável
- `content-pipeline.ts`: pipeline de conteúdo configurável

**Context Engine Completo**
- Assembler com L0/L1/L2 para todos os módulos
- Detecção de módulos por keyword matching
- `requiresSpecificData()` para ativação de L2
- Cache de L0 com TTL de 5min

**Dashboard Expandido**
- Páginas completas para todos os módulos ativos
- Widgets para grid: finances, health, routine, objectives, wellness

---

## W4 — UI/UX Polish

**Período**: Março 2026
**Objetivo**: Cada módulo competindo com apps especializados em qualidade de UI.

### Implementado

**Shell e Navegação**
- Sidebar com módulos agrupados por categoria
- Topbar com contexto da página atual
- Modo colapsado da sidebar para mais espaço
- Navegação com indicador de módulo ativo

**Componentes Polidos**
- Inline forms (sem modal) para objetivos e tarefas
- Reach out queue no people com priorização automática
- Transaction feed com filtros por período e categoria
- Workout templates para iniciar sessão rápida

**Performance**
- Server Components para carregamento inicial
- Client Components apenas onde necessário (interatividade)
- Suspense boundaries para loading states
- Otimistic updates para operações comuns (toggle hábito)

---

## W5 — Redesign & Simplificação ✅

**Período**: Março 2026
**Objetivo**: Remover complexidade desnecessária, focar nos módulos que realmente importam.

### O que foi feito

**Módulos Inativos** (código existente, não aparece na sidebar)
- `security` — código existe mas não está ativo na sidebar
- `social` — código existe mas não está ativo na sidebar
- `spirituality` — código existe mas não está ativo na sidebar
- `journal` — código existe mas não está ativo na sidebar
- `knowledge` — substituído pelo sistema de Memória

**Sistema agora tem 11 módulos ativos** — o que importa, sem ruído.

**Novos Módulos**
- `demands` — sistema de execução multi-agent para tarefas de longa duração
- `memory` — sistema de memórias do agente (substitui journal e knowledge)

**Mission Control → Widgets**
- A página `/dashboard/mission-control` foi removida
- Seus componentes foram reescritos como 3 widgets do grid principal:
  - `agent-status`: heartbeat, uptime, sessões ativas, clientes WS
  - `agent-sessions`: sessões com opção de encerramento
  - `agent-activity`: log de atividade do agente em tempo real
- Logs removidos da sidebar (acessíveis via widget de atividade)

**Wiki Criada**
- Esta wiki foi criada em W5 para documentar o sistema completamente
- 22 artigos cobrindo arquitetura, agente, módulos, referência e changelog
- Callout boxes para explicações de leigos e dicas práticas

---

## W4-8 — Reference Repo Integration

**Período**: Abril 2026
**Objetivo**: Integração de padrões de 12 repositórios de referência em 4 waves temáticas.

### Wave 4 — Padrões Base

- **Feature flags per-tenant**: Sistema de flags via `tenants.feature_flags` JSONB com ~30 flags configuráveis
- **Tool approval**: Tools com `dangerous: true` requerem confirmação do usuário antes de executar
- **Hybrid search**: pg_trgm + pgvector combinados para busca semântica + keyword
- **Frecency sidebar**: Módulos ordenados por frequência + recência de uso (materialized view)
- **Secret redaction**: 51+ regex patterns removem API keys, tokens, DB URIs do contexto LLM
- **Prompt injection scanning**: 14 patterns detectam role hijacking, delimiter injection, jailbreak
- **Silent cron**: Check-ins suprimidos quando usuário inativo 24h ou hábitos já completados
- **Platform hints**: Formatação específica por canal (Discord 2000 chars vs Web Markdown completo)

### Wave 5 — Infraestrutura

- **SSRF validation**: Bloqueia IPs privados, loopback, metadata endpoints em requests
- **Graceful shutdown**: AbortController global com cleanup hooks priorizados
- **SSE streaming**: Endpoint `/stream` com Server-Sent Events tipados
- **OAuth token manager**: Auto-refresh com 60s buffer antes do expiry
- **Worker token tracking**: Monitoramento de tokens gastos por task type (compression, dedup, etc.)
- **MCP scaffold**: Client/server MCP com discovery-first setup

### Wave 6 — Inteligência & Custo

- **Iterative summaries**: Compressão de histórico com template Goal/Progress/Decisions/Next
- **RRF hybrid search**: Reciprocal Rank Fusion combinando vector + keyword com pesos configuráveis
- **Credential pool**: 3 estratégias de rotação (FILL_FIRST, ROUND_ROBIN, LEAST_USED)
- **Cost-aware routing**: Downgrade automático de modelo quando >80% do budget diário usado

### Wave 7 — Plataforma & UX

- **Context references**: Parser para `@file:path`, `@url:endpoint`, `@memory:query` com token budgets
- **Typed SSE packets**: 45 event types tipados com payloads TypeScript
- **Multi-channel capabilities**: Presets para Discord, Web, Telegram, WhatsApp
- **Plugin SDK**: Lifecycle completo (discover → init → ready → reload → unload) com permissions

---

## Production Hardening

**Período**: Abril 2026
**Objetivo**: Deploy em VPS com segurança e observabilidade.

### O que foi implementado

- **Middleware pipeline**: Handler monolítico decomposto em 7 middlewares composíveis (security → context → history → routing → message-builder → llm → persistence)
- **HTTPS automático**: Caddy reverse proxy com Let's Encrypt, HTTP/3, headers de segurança
- **Health checks**: `/health` verifica DB + latência, `?deep=true` verifica OpenRouter + Discord
- **Cost tracking persistente**: Gastos salvos em `admin.tenant_metrics`, sobrevive restarts
- **Error codes**: `HawkErrorCode` enum com 40+ códigos categorizados
- **LLM timeout**: 90s via `AbortSignal.timeout()` para prevenir requests pendurados
- **Prometheus metrics**: `/metrics` endpoint com uptime, sessions, tokens, cost, messages
- **VPS setup automatizado**: Script com user dedicado, SSH key-only, fail2ban, UFW, swap 2GB

---

## Agent Audit 360° — Model Agnosticism

**Período**: Abril 2026
**Objetivo**: Compatibilidade com modelos free do OpenRouter.

### O que foi implementado

- **Smart model routing**: `classifyComplexity()` classifica mensagens em simple/moderate/complex, seleciona modelo por tier
- **Fallback chain**: Separação de modelos com/sem `tool_choice`, evita enviar tool_choice a modelos incompatíveis
- **Context window validation**: Mapa de limites per-model (12+ modelos), warning >90% do limite
- **Per-tenant budgets**: Cost-aware downgrade (>80% budget → moderate, >95% → simple)
- **Memory confidence**: Campo `confidence` (0.0-1.0) com peso 0.15 no ranking de memórias
- **Prompt pattern library**: Registry com 14 patterns e `{{variable}}` interpolation
- **Max tool rounds**: Limite de 5 rounds no tool loop para prevenir loops infinitos

---

## Bugfix Audit (5 Rondas)

**Período**: Abril 2026
**Objetivo**: Auditoria completa do codebase para deploy readiness.

### Ronda 1 — P0/P1 (bugs críticos)

- Fire-and-forget promises → awaited com logging estruturado
- ~10 silent catch blocks → logging com contexto
- Provider sync race condition → module-level lock
- N+1 query em finances → GROUP BY no banco

### Ronda 2 — Wiring pendente

- Multimodal token estimation (ContentPart[] ignorado)
- Campo `confidence` wired no schema Zod, tool params, e DB
- Per-tenant budget cache verificado funcional

### Ronda 3 — Testes

- +39 testes novos → 219 total, 0 falhas
- RLS análise: schema-based isolation confirmado seguro

### Ronda 4 — Deploy readiness

- `DATABASE_URL` tornado required (agent falha no startup se ausente)
- `Promise.all` → `Promise.allSettled` no assembler (fault isolation)
- LLM timeout 90s adicionado

### Ronda 5 — Zero pendentes

- Test hoisting fixes (vi.hoisted)
- TypeScript zero errors (~50 erros corrigidos em 15 ficheiros)
- **233 testes, 25 ficheiros, 0 falhas**

---

## Multi-Tenant Dinâmico

**Período**: Abril 2026
**Objetivo**: Eliminar containers hardcoded por tenant.

### Antes vs Depois

| Aspecto | Antes | Depois |
| ------- | ----- | ------ |
| Agent services | 6 containers (agent-ten1..6) | 1 processo dinâmico |
| Adicionar tenant | Editar docker-compose + restart | POST /admin/tenants/:slug/start |
| Memória total | 6×512MB = 3GB | 1GB |
| AGENT_SLOT env var | Obrigatório | Deprecated (legacy compat) |

O `TenantManager` carrega todos os tenants activos da tabela `admin.tenants` no startup. Cada tenant recebe Discord client, crons, e schema isolation independentes.

---

## Decisões Técnicas Importantes

### Por que OpenRouter e não Anthropic direto?

OpenRouter permite trocar de modelo sem mudar código. `openrouter/auto` seleciona o modelo mais custo-eficiente para cada tipo de request. Em produção, possível usar modelos mais baratos para operações simples e Claude para raciocínio complexo.

### Por que Bun e não Node.js?

Bun é 3-5x mais rápido em startup e tem runtime nativo de TypeScript. Para um bot que inicia frequentemente em desenvolvimento, a diferença é percebível. Package management com `bun install` também é significativamente mais rápido.

### Por que Biome e não ESLint + Prettier?

Uma dependência ao invés de duas. Biome é mais rápido e a configuração é mais simples. A única troca é compatibilidade com alguns plugins ESLint específicos que não foram necessários até agora.

### Por que pgvector e não Pinecone/Weaviate?

Manter tudo no PostgreSQL/Supabase simplifica drasticamente a infraestrutura. pgvector com HNSW index tem performance adequada para o volume de dados esperado (< 100k memórias). Sem serviço adicional para gerenciar, sem custo adicional, sem latência de rede extra.

### Por que 11 módulos ativos?

Menos é mais. Os módulos activos cobrem as áreas mais importantes da vida:
- Finanças, Saúde, Rotina (diário)
- Objetivos, Carreira (produtividade)
- Pessoas, Legal, Moradia, Patrimônio (administração)
- Agenda, Entretenimento (vida social e lazer)

Módulos como `security`, `social`, `spirituality`, `journal` e `knowledge` foram desativados porque:
- Social e security eram usados raramente
- Journal foi substituído pelo sistema de memórias do agente
- Knowledge foi substituído pelo sistema de Memória com embeddings
- Spirituality era muito nicho para ser um módulo separado

O resultado: sistema mais focado, manutenção mais simples, sem ruído na sidebar.
