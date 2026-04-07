# Hawk OS — Visão Geral

## O que é

**Hawk OS** é um sistema operacional de vida pessoal. A ideia central é simples: toda área da sua vida gera dados, e dados bem organizados com inteligência artificial permitem decisões melhores, hábitos mais consistentes e clareza mental.

Não é um app de to-do. Não é um dashboard genérico. É um sistema integrado onde **8 módulos ativos na sidebar** (e mais no backend) cobrem finanças, saúde, relacionamentos, carreira, rotina, agenda, jurídico e objetivos — todos conectados, todos alimentando o mesmo agente AI.

> 🧩 **Para leigos:** Imagine um assistente pessoal que vive no Discord. Você manda uma mensagem falando que foi na academia, gastou R$50 no mercado ou marcou uma reunião — e ele anota tudo, organiza os dados e te dá um painel bonito pra visualizar. O Hawk OS é isso, mas para cada área da sua vida.

## Filosofia

### Life-as-a-System

Vida não é uma coleção de apps isolados. É um sistema com entradas, saídas e feedback loops. Quando você registra que dormiu mal, isso deveria aparecer no contexto do seu treino. Quando você gasta mais que o planejado num mês, isso deveria aparecer na revisão semanal. O Hawk OS trata a vida como um sistema e o agente como o cérebro que conecta tudo.

### Agent-First

A interface primária é o Discord. Você conversa com o agente em linguagem natural, e ele registra dados, busca informações, faz análises e toma decisões. O dashboard web é uma camada de visualização e edição — não é onde você opera. Exceções: quick-add de finanças, toggle de hábitos, calendar picker.

> 💡 **Dica:** Trate o Discord como seu diário de voz. Não pense "como eu registro isso?". Apenas fale o que aconteceu, como falaria pra um assistente humano.

### Privacidade por Design

Todos os dados ficam na sua instância Supabase. Nenhum dado pessoal vai para serviços externos além do LLM (OpenRouter). Você controla o modelo, a instância, o acesso.

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                         INTERFACES                          │
│                                                             │
│   Discord ──────────────────────────── Web Dashboard        │
│   (input primário)                    (visualização)        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  MIDDLEWARE PIPELINE (7 stages)              │
│                                                             │
│   Persistence → Security → Context → History →              │
│   Routing → Message Builder → LLM + Tool Loop               │
│                                                             │
│   • Injection scanning + secret redaction                   │
│   • L0/L1/L2 context + memórias (fault-isolated)            │
│   • Smart model routing (simple/moderate/complex)           │
│   • Cost-aware downgrade + fallback chain                   │
│   • Tool approval para operações perigosas                  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  TOOLS (40+ em 21 ficheiros)                │
│                                                             │
│  finances  health  routine  objectives  people  calendar    │
│  career    media   demands  web  analytics  extensions      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              8 MÓDULOS ATIVOS NA SIDEBAR                    │
│                                                             │
│  finances  health   people   career                         │
│  objectives  routine  legal  calendar                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│               PostgreSQL 17 + pgvector + pg_trgm            │
│                                                             │
│   RRF hybrid search (vector + trigram)                      │
│   Schema-based tenant isolation                             │
│   90+ migrations versionadas em packages/db/supabase/       │
└─────────────────────────────────────────────────────────────┘
```

## Os 8 Módulos Ativos na Sidebar

| Módulo | O que rastreia |
|--------|---------------|
| **finances** | Transações, contas bancárias, categorias, orçamento, portfolio |
| **health** | Treinos, sono, peso, humor, substâncias, observações de saúde |
| **people** | CRM pessoal — contatos, interações, anniversários, follow-ups |
| **career** | Workspaces, sessões de trabalho, projetos freelance, horas |
| **objectives** | Metas de longo prazo, tarefas, progresso, sprints |
| **routine** | Hábitos diários, streaks, logs, hábitos em risco |
| **legal** | Entidades jurídicas (CNPJ), contratos, obrigações fiscais |
| **calendar** | Eventos, compromissos, lembretes, slots livres |

Código existe para módulos adicionais (assets, entertainment, housing) mas não aparecem na sidebar.

> 🧩 **Para leigos:** Cada módulo é como uma gaveta diferente. Finanças é uma gaveta, saúde é outra, relacionamentos é outra. O agente sabe em qual gaveta guardar cada informação — você só precisa falar o que aconteceu.

## Como Acessar

### Discord (interface primária)

O bot roda em `apps/agent/`. Configure o canal no `DISCORD_CHANNEL_MAP` e fale com o agente em linguagem natural:

```
"gastei R$120 no supermercado ontem"
"dormi 6h, acordo 07:00"
"anota que o João me ligou hoje"
"qual foi meu gasto total esse mês?"
```

### Web Dashboard

Acesse `http://localhost:3000/dashboard` para visualizar dados, editar registros, configurar agentes e ver memórias. O dashboard tem uma página por módulo + widgets configuráveis na tela principal.

### Múltiplos Agentes (Multi-Tenant)

O sistema suporta múltiplos tenants num único processo. Cada tenant tem schema PostgreSQL isolado, Discord bot dedicado e feature flags independentes. Tenants são carregados dinamicamente da tabela `admin.tenants` no startup, sem necessidade de reiniciar.

Dentro de cada tenant, todos os canais usam Hawk por padrão. O `DISCORD_CHANNEL_MAP` permite mapear canais específicos para task agents criados pelo usuário (caso avançado).

## Quick Start

```bash
# Clonar e instalar dependências
git clone <repo>
bun install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Subir PostgreSQL + PgBouncer via Docker
docker compose up -d postgres pgbouncer

# Aplicar migrations
bun db:migrate

# Rodar o agente Discord
bun agent

# Rodar o dashboard web
bun dev

# Ou rodar tudo junto (agent + web em paralelo via Turborepo)
bun dev
```

## Estrutura do Monorepo

```text
apps/agent/          → Bot Discord + middleware pipeline + 18 automações
apps/web/            → Next.js 15 dashboard
packages/db/         → PostgreSQL client + 90+ migrations
packages/modules/    → 16 módulos isolados (11 ativos)
packages/context-engine/ → Assembler L0/L1/L2
packages/shared/     → errors, constants, security, types
packages/admin/      → Administração multi-tenant
packages/auth/       → Camada de autenticação
packages/extensions/ → Integrações third-party (GitHub, ClickUp)
packages/mcp/        → MCP client/server scaffold
```

Cada módulo em `packages/modules/<nome>/` tem sua própria lógica isolada: tipos, queries no banco, comandos Discord e funções de contexto. Módulos se comunicam apenas através dos seus `index.ts`.
