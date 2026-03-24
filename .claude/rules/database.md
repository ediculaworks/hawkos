# Banco de Dados — Convenções

## Migrations

- Path: `packages/db/supabase/migrations/YYYYMMDDHHMMSS_nome.sql`
- **Permanentes**: nunca editar migration executada
- Atômicas: use `BEGIN; ... COMMIT;`
- Seed data: arquivo separado `NNNN_seed_descricao.sql`

## Schema

- `created_at TIMESTAMPTZ DEFAULT now()` em toda tabela
- `updated_at TIMESTAMPTZ DEFAULT now()` em tabelas mutáveis (+ trigger)
- FK com `ON DELETE CASCADE` (filho sem pai não faz sentido) ou `SET NULL`
- Índice em toda FK usada em WHERE/JOIN frequentes
- **RLS habilitada em toda tabela, sem exceção**
- `JSONB` para metadados flexíveis, nunca para campos indexados

## Queries

- Supabase typed client: `db.from('table').select('col1, col2')`
- **Nunca** `SELECT *` em produção
- Paginação em toda query de lista (limit + offset)
- Views materializadas para dados agregados pesados

## Extensions

- `pgvector`: embeddings para busca semântica (agent_memories)
- `pg_trgm`: usado em FTS (knowledge_notes, reflections)

## Tabelas Principais por Módulo

| Módulo | Tabelas |
|--------|---------|
| memory | agent_memories, conversation_messages, session_archives, activity_log |
| finances | accounts, categories, transactions, recurring_transactions |
| health | health_observations, sleep_sessions, workout_sessions, body_measurements |
| people | people, interactions |
| calendar | events, attendees, reminders |
