---
name: database-migration
description: Write Supabase database migrations following Hawk OS conventions
user-invocable: false
---

# Database Migration Skill

## Convenções
- Path: `packages/db/supabase/migrations/YYYYMMDDHHMMSS_nome.sql`
- Envolver em `BEGIN; ... COMMIT;`
- `created_at TIMESTAMPTZ DEFAULT now()` em toda tabela
- `updated_at TIMESTAMPTZ DEFAULT now()` em tabelas mutáveis
- RLS habilitada em toda tabela
- FK com `ON DELETE CASCADE` ou `SET NULL`
- Nunca editar migration já executada
- Seed data em arquivo separado
- Adicionar `IF NOT EXISTS` e `DROP POLICY IF EXISTS` para idempotência

## Template
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS nome_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON nome_tabela FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own data"
  ON nome_tabela FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON nome_tabela FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own data"
  ON nome_tabela FOR DELETE
  USING (true);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON nome_tabela
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMIT;
```

## Verificação
- `bun db:migrate` passa sem erro
- `bun build` passa
- Verificar que a tabela aparece em `bun db:types`
