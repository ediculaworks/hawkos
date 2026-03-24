---
description: Generate TypeScript types from current Supabase schema
allowed-tools: Read, Bash
---

# Generate Types

Roda `bun db:types` para regenerar os tipos TypeScript do schema Supabase.

Se o comando falhar, verificar:
1. .env tem SUPABASE_URL e SUPABASE_ACCESS_TOKEN
2. Supabase CLI está instalado: `bunx supabase --version`
3. Conexão com o projeto Supabase

Reportar os arquivos gerados e se houve mudanças.
