# Estrutura de Pastas

```
LifeOS/                          ← raiz do monorepo
├── apps/
│   ├── agent/                   ← bot Discord + handler AI
│   │   ├── src/
│   │   │   ├── index.ts         ← entry point
│   │   │   ├── handler.ts       ← OpenRouter + context assembly
│   │   │   ├── tools.ts        ← tool definitions + routing
│   │   │   ├── channels/
│   │   │   │   ├── discord.ts  ← Discord channel adapter
│   │   │   │   └── types.ts    ← Channel interface
│   │   │   └── automations/    ← cron jobs (alerts, checkin, etc.)
│   │   └── groups/main/CLAUDE.md
│   └── web/                     ← Next.js dashboard
│       ├── app/dashboard/       ← páginas por módulo
│       ├── components/
│       │   ├── dashboard/       ← Grid, layout shell
│       │   ├── widgets/        ← widgets por módulo
│       │   ├── shell/          ← Sidebar, TopBar
│       │   └── ui/            ← primitivos shadcn
│       └── lib/
│           ├── actions/        ← Server Actions por módulo
│           ├── stores/         ← Zustand stores
│           └── widgets/       ← widget registry
├── packages/
│   ├── db/
│   │   ├── supabase/
│   │   │   ├── client.ts       ← Supabase client
│   │   │   ├── migrations/    ← SQL versionado
│   │   │   └── functions/     ← RPC functions
│   │   └── types.ts           ← tipos gerados do schema
│   ├── shared/                 ← errors, constants, utils
│   ├── context-engine/         ← assembler L0/L1/L2
│   └── modules/ (16×)          ← módulos isolados
│       └── <nome>/
│           ├── index.ts        ← ÚNICA porta de exportação
│           ├── types.ts
│           ├── queries.ts
│           ├── commands.ts
│           ├── context.ts
│           ├── constants.ts
│           └── package.json
├── resources/
│   ├── planning/               ← roadmap, princípios, changelog
│   ├── user/                   ← markdowns pessoais (gitignored)
│   └── repositories/           ← docs de repos de referência
├── .env                        ← secrets (gitignored)
├── .env.example
├── CLAUDE.md                   ← contexto para agentes (~80 linhas)
└── .claude/
    ├── commands/               ← /fix-module, /implement-module, etc.
    ├── skills/                 ← database-migration, module-implementation
    ├── agents/                 ← bug-fixer, module-implementer
    ├── settings.json           ← permissões + hooks
    └── rules/                  ← agent.md, architecture.md, etc.
```

## 16 Módulos (11 activos na sidebar)

finances, health, people, career, objectives, routine, assets,
entertainment, legal, housing, calendar (11 activos)

Código existe para: security, social, spirituality, journal, knowledge (inactivos)
