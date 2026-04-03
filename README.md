# Hawk OS

A personal life operating system powered by AI. Manage finances, health, relationships, career, routines, and more through a Discord-based AI agent and a full-featured web dashboard.

## Overview

Hawk OS is a modular, self-hosted system that combines:

- **AI Agent** — A Discord bot that understands natural language, executes actions, and proactively helps you stay on top of your life
- **Web Dashboard** — A Next.js app with customizable widget grid for visualizing all your data
- **Context Engine** — Three-layer context system (L0/L1/L2) that gives the AI deep understanding of your situation
- **Memory System** — Long-term memory with semantic search (pgvector), frecency scoring, and automatic deduplication

## Architecture

```
apps/
  agent/          Discord bot + AI handler + 18 automations
  web/            Next.js 15 dashboard (App Router, Server Components)

packages/
  db/             PostgreSQL client + 85 migrations
  modules/        18 isolated domain modules
  context-engine/ L0/L1/L2 context assembler
  shared/         Errors, constants, utilities
  auth/           Authentication layer
  admin/          Multi-tenant administration
  extensions/     Third-party integrations (GitHub, ClickUp)
  ui/             Shared UI primitives
```

## Modules

11 active modules on the dashboard sidebar:

| Module | Description |
| ------ | ----------- |
| **Finances** | Accounts, transactions, budgets, recurring payments, net worth tracking |
| **Health** | Sleep, workouts, body measurements, health observations |
| **People** | Contact management, interaction tracking, relationship scoring |
| **Career** | Job applications, interviews, career goals |
| **Objectives** | Goals, key results, progress tracking |
| **Routine** | Habits, streaks, daily routines |
| **Assets** | Physical and digital asset inventory |
| **Entertainment** | Media backlog, watchlist, recommendations |
| **Legal** | Documents, deadlines, legal matters |
| **Housing** | Property management, maintenance, expenses |
| **Calendar** | Events, reminders, Google Calendar sync |

Additional modules exist in code (security, social, spirituality, journal, knowledge) but are not active in the sidebar.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Bun 1.3 |
| Language | TypeScript 5.7 (strict) |
| Frontend | Next.js 15, React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand + TanStack React Query |
| AI | OpenRouter (multi-model with fallback chain) |
| Database | PostgreSQL 17 + pgvector + pg_trgm |
| Pooling | PgBouncer |
| Bot | discord.js v14 |
| Monorepo | Turborepo |
| Linting | Biome |
| Testing | Vitest + Playwright |
| Reverse Proxy | Caddy (automatic HTTPS) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://www.docker.com/) and Docker Compose
- A Discord bot token
- An OpenRouter API key

### Setup

1. Clone the repository:

```bash
git clone https://github.com/ediculaworks/hawkos.git
cd hawkos
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment:

```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start the database:

```bash
docker compose up -d postgres pgbouncer
```

5. Run migrations:

```bash
bun db:migrate
```

6. Start development:

```bash
bun dev        # All apps (web + agent)
bun dev:web    # Dashboard only
bun dev:agent  # Agent only
```

## Agent Automations

The AI agent runs 18 scheduled automations:

| Automation | Schedule | Purpose |
| ---------- | -------- | ------- |
| Daily Check-in | 09:00 + 22:00 | Morning briefing and evening review |
| Alerts | 08:00 daily | Upcoming deadlines and reminders |
| Weekly Review | Sunday 20:00 | Week summary and planning |
| Session Compactor | Every hour | Extract memories from conversations |
| Memory Forgetter | Periodic | Archive unused memories (>90d) |
| Health Insights | Periodic | Patterns in sleep, exercise, vitals |
| Gap Scanner | Periodic | Detect missing data and suggest actions |
| Backup | Scheduled | Database backup to Cloudflare R2 |
| Heartbeat | Active hours | Proactive check-ins and suggestions |
| Net Worth Snapshot | Periodic | Track financial position over time |
| Streak Guardian | Daily | Protect habit streaks |
| And more... | | Analytics, job monitoring, content pipeline |

## Multi-Tenant

Hawk OS supports up to 6 tenants on a single deployment. Each tenant gets:

- Isolated PostgreSQL schema
- Dedicated Discord agent instance
- Independent AI context and memory
- Per-tenant feature flags

```bash
docker compose up -d                 # Start everything
docker compose up -d agent-ten1      # Start single tenant agent
```

## Scripts

```bash
bun dev          # Run all apps in dev mode
bun build        # Build all packages
bun lint         # Check code with Biome
bun test         # Run unit tests (Vitest)
bun test:e2e     # Run E2E tests (Playwright)
bun agent        # Run Discord agent
bun db:migrate   # Apply database migrations
bun setup        # Interactive setup wizard
```

## Production Deployment

Hawk OS is designed to run on a single VPS with Docker Compose:

- **Caddy** handles HTTPS automatically via Let's Encrypt
- **PgBouncer** pools database connections
- **Health checks** on all services with automatic restart
- **Resource limits** configured per container
- Security headers (HSTS, CSP, X-Frame-Options)
- Prometheus-compatible `/metrics` endpoint

```bash
# On your VPS
git pull
./scripts/deploy.sh    # Pull, migrate, build, health check
```

## Project Structure

```text
.
├── apps/
│   ├── agent/                 # Discord bot + AI handler
│   │   └── src/
│   │       ├── handler.ts     # LLM orchestration
│   │       ├── tools.ts       # Dynamic tool routing
│   │       └── automations/   # 18 scheduled jobs
│   └── web/                   # Next.js dashboard
│       ├── app/dashboard/     # Module pages
│       ├── components/
│       │   ├── widgets/       # Grid widgets per module
│       │   └── shell/         # Sidebar, TopBar
│       └── lib/
│           ├── actions/       # Server Actions
│           └── widgets/       # Widget registry
├── packages/
│   ├── db/                    # Database client + migrations
│   ├── modules/               # 18 domain modules
│   ├── context-engine/        # L0/L1/L2 assembler
│   └── shared/                # Errors, constants, utils
├── docker/                    # Dockerfiles + Caddy config
├── docker-compose.yml
└── .env.example
```

## License

Private project. All rights reserved.
