---
description: Scaffold a new Hawk OS module with all required files
argument-hint: [module-name e.g. finances, health, people]
allowed-tools: Read, Write, Grep, Bash
model: sonnet
---

# Implement Module

Scaffold um novo módulo `$ARGUMENTS` no Hawk OS:

1. Verificar se já existe em `packages/modules/$ARGUMENTS/`
2. Criar estrutura padrão:
   - `packages/modules/$ARGUMENTS/index.ts`
   - `packages/modules/$ARGUMENTS/types.ts`
   - `packages/modules/$ARGUMENTS/queries.ts`
   - `packages/modules/$ARGUMENTS/commands.ts`
   - `packages/modules/$ARGUMENTS/context.ts`
   - `packages/modules/$ARGUMENTS/constants.ts`
   - `packages/modules/$ARGUMENTS/package.json`
3. Criar migration SQL: `packages/db/supabase/migrations/YYYYMMDDHHMMSS_module_$ARGUMENTS.sql`
4. Registrar módulo no context engine
5. Registrar commands no Discord bot (apps/agent/src/tools.ts)
6. Rodar `bun db:migrate` para aplicar
7. Testar: `bun build` passa e agent responde
8. Atualizar EXECUTION-PLAN.md e CHANGELOG.md

Use `.claude/skills/database-migration/` e `.claude/skills/module-implementation/` como referência.
