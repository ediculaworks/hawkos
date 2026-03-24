---
description: Debug and fix a specific Hawk OS module end-to-end
argument-hint: [module-name e.g. finances, health, routine]
allowed-tools: Read, Edit, Grep, Bash
model: sonnet
---

# Fix Module

Debug o módulo `$ARGUMENTS` do Hawk OS:

1. Ler `packages/modules/$ARGUMENTS/` — todos os arquivos
2. Verificar queries.ts contra schema SQL atual em `packages/db/supabase/migrations/`
3. Rodar `bun build` e verificar erros de tipo
4. Verificar context.ts (L0/L1/L2) está retornando dados
5. Testar commands via handler simulado
6. Corrigir problemas encontrados
7. Atualizar EXECUTION-PLAN.md se o bug estiver listado
