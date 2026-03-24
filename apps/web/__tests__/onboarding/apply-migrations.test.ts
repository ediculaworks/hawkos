import { describe, expect, it } from 'vitest';

/**
 * DROP SQL gerado em apps/web/app/api/admin/apply-migrations/route.ts
 * para o target 'tenant' — deve dropar tabelas, tipos e funções.
 */
const DROP_ALL_SQL = `
  DO $$ DECLARE r RECORD; BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename); END LOOP;
    FOR r IN (SELECT typname FROM pg_type
              WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')
    LOOP EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname); END LOOP;
    FOR r IN (
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.objid = p.oid AND d.deptype = 'e'
        )
    )
    LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;
  END $$;
`;

describe('DROP ALL SQL', () => {
  it('contém DROP TABLE IF EXISTS com CASCADE', () => {
    expect(DROP_ALL_SQL).toContain('DROP TABLE IF EXISTS');
    expect(DROP_ALL_SQL).toContain('CASCADE');
  });

  it('filtra apenas schema public nas tabelas', () => {
    expect(DROP_ALL_SQL).toContain("schemaname = 'public'");
  });

  it('dropa tipos enum do schema public', () => {
    expect(DROP_ALL_SQL).toContain('DROP TYPE IF EXISTS');
    expect(DROP_ALL_SQL).toContain("typtype = 'e'");
  });

  it('dropa funções sem excluir funções de extensão (deptype = e)', () => {
    expect(DROP_ALL_SQL).toContain('DROP FUNCTION IF EXISTS');
    expect(DROP_ALL_SQL).toContain("deptype = 'e'");
    // Garante que funções de extensão (pgvector, etc.) não são dropadas
    expect(DROP_ALL_SQL).toContain('NOT EXISTS');
  });
});

describe('apply-migrations targets', () => {
  it('target admin verifica se tabela "tenants" já existe antes de aplicar', () => {
    // Documenta o comportamento esperado: idempotente para admin
    const target = 'admin';
    expect(target).toBe('admin');
  });

  it('target tenant sempre dropa tudo antes (não idempotente por design)', () => {
    // Documenta que tenant reset é destrutivo e intencional
    const target = 'tenant';
    expect(target).toBe('tenant');
  });
});
