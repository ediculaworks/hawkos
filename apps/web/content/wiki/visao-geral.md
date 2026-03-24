# Hawk OS — Visão Geral

## O que é

**Hawk OS** é um sistema operacional de vida pessoal. A ideia central é simples: toda área da sua vida gera dados, e dados bem organizados com inteligência artificial permitem decisões melhores, hábitos mais consistentes e clareza mental.

Não é um app de to-do. Não é um dashboard genérico. É um sistema integrado onde **11 módulos** cobrem finanças, saúde, relacionamentos, carreira, rotina, patrimônio, entretenimento, moradia, agenda, jurídico e objetivos — todos conectados, todos alimentando o mesmo agente AI.

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

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERFACES                          │
│                                                             │
│   Discord ──────────────────────────── Web Dashboard        │
│   (input primário)                    (visualização)        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      AGENT CORE                             │
│                                                             │
│   Handler ──► Context Engine ──► OpenRouter LLM             │
│       │              │                  │                   │
│       │         L0/L1/L2            Tool Calls              │
│       │         Memories                │                   │
│       └─────────────────────────────────┘                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    11 MÓDULOS ATIVOS                        │
│                                                             │
│  finances  health   people   career   objectives  routine    │
│  assets    legal    housing  calendar entertainment          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                    │
│                                                             │
│   pgvector (embeddings) + RLS em todas as tabelas           │
│   Migrations versionadas em packages/db/supabase/           │
└─────────────────────────────────────────────────────────────┘
```

## Os 11 Módulos

| Módulo | O que rastreia |
|--------|---------------|
| **finances** | Transações, contas bancárias, categorias, orçamento, portfolio |
| **health** | Treinos, sono, peso, humor, substâncias, observações de saúde |
| **people** | CRM pessoal — contatos, interações, anniversários, follow-ups |
| **career** | Workspaces, sessões de trabalho, projetos freelance, horas |
| **objectives** | Metas de longo prazo, tarefas, progresso, sprints |
| **routine** | Hábitos diários, streaks, logs, hábitos em risco |
| **assets** | Patrimônio físico, documentos, inventário |
| **entertainment** | Filmes, séries, músicas, hobbies (skate, leitura, etc.) |
| **legal** | Entidades jurídicas (CNPJ), contratos, obrigações fiscais |
| **housing** | Imóveis, contas de moradia, manutenções, aluguel |
| **calendar** | Eventos, compromissos, lembretes, slots livres |

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

### Múltiplos Agentes

Você pode ter diferentes canais Discord com personas diferentes:
- Canal geral → Hawk (generalista, todos os módulos)
- Canal financeiro → CFO (especialista em finanças/jurídico/patrimônio)
- Canal saúde → Coach (especialista em saúde/rotina)

## Quick Start

```bash
# Clonar e instalar dependências
git clone <repo>
bun install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Aplicar migrations no Supabase
bun db:migrate

# Gerar tipos TypeScript
bun db:types

# Rodar o agente Discord
bun agent

# Rodar o dashboard web
bun dev

# Ou rodar tudo junto
bun dev  # roda agent + web em paralelo via Turborepo
```

## Estrutura do Monorepo

```
apps/agent/     → Bot Discord + AI handler + automações
apps/web/       → Next.js 15 dashboard
packages/db/    → Supabase client + migrations SQL
packages/modules/  → 12 módulos isolados
packages/context-engine/  → Assembler L0/L1/L2
packages/shared/  → errors, constants, types compartilhados
```

Cada módulo em `packages/modules/<nome>/` tem sua própria lógica isolada: tipos, queries no banco, comandos Discord e funções de contexto. Módulos se comunicam apenas através dos seus `index.ts`.
