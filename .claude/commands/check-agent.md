---
description: Check Hawk OS agent status, health and recent errors
allowed-tools: Read, Bash
model: sonnet
---

# Check Agent

Verificar saúde do agent Hawk OS:

1. Rodar `bun agent` em background ou verificar se já está rodando
2. Checar `bun run apps/agent/src/index.ts` — conecta ao Discord?
3. Verificar Supabase: migrations aplicados?
4. Listar modules registrados no context engine
5. Testar endpoint /status: `curl http://localhost:3001/status`
6. Verificar logs recentes de erro
7. Se agent offline, tentar restart e identificar motivo da queda
