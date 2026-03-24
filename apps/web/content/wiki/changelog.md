# Changelog do Hawk OS

Histórico de desenvolvimento por onda (wave). Cada onda tem um foco específico e um conjunto de entregáveis.

---

## Status Atual

**Data**: Março 2026
**Status geral**: W5 concluído

| Wave | Nome | Status | Concluído |
|------|------|--------|-----------|
| W0 | Infraestrutura Core | ✅ Completo | Dez 2025 |
| W1 | Correção de Bugs Críticos | ✅ Completo | Fev 2026 |
| W2 | Health Page Funcional | ✅ Completo | Mar 2026 |
| W3 | Stack Completa | ✅ Completo | Mar 2026 |
| W4 | UI/UX Polish | ✅ Completo | Mar 2026 |
| W5 | Redesign & Simplificação | ✅ Completo | Mar 2026 |

**Métricas atuais**:
- 722+ módulos buildados com sucesso
- 30 comandos Discord ativos (36 anteriores, 6 removidos com módulos extintos)
- **11 módulos ativos** (finances, health, people, career, objectives, routine, assets, entertainment, legal, housing, calendar)
- 7 templates de agentes (personas)
- 6 automações ativas

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

**7 Templates de Agente (Personas)**
- Hawk (generalista), CFO, Coach, Career Coach, Chief of Staff, House Manager, Creative Director
- Roteamento por canal Discord via `DISCORD_CHANNEL_MAP`
- Dashboard `/dashboard/agents` para CRUD de personas

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
