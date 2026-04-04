-- ============================================================
-- RESET TENANT DATA
-- Removes all data from each tenant schema EXCEPT auth_users.
-- Users keep their login credentials and will go through
-- onboarding again on next login.
--
-- Run on the VPS:
--   docker exec -i hawkos-postgres-1 psql -U postgres -d hawkos < scripts/reset-tenant-data.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  schemas TEXT[] := ARRAY[
    'tenant_ten1',
    'tenant_ten2',
    'tenant_ten3',
    'tenant_ten4',
    'tenant_ten5',
    'tenant_ten6'
  ];
  s TEXT;
  tbl TEXT;
  uid UUID;
  uemail TEXT;
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    -- Check schema exists before touching it
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = s
    ) THEN
      RAISE NOTICE 'Schema % does not exist — skipping', s;
      CONTINUE;
    END IF;

    RAISE NOTICE 'Resetting schema %...', s;

    -- Truncate every table except auth_users
    FOR tbl IN
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = s
        AND table_type = 'BASE TABLE'
        AND table_name <> 'auth_users'
      ORDER BY table_name
    LOOP
      EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', s, tbl);
      RAISE NOTICE '  truncated %.%', s, tbl;
    END LOOP;

    -- Re-insert a blank profile row for each user so onboarding works
    FOR uid, uemail IN
      EXECUTE format('SELECT id, email FROM %I.auth_users', s)
    LOOP
      EXECUTE format(
        $q$
        INSERT INTO %I.profile (id, name, onboarding_complete, metadata, created_at, updated_at)
        VALUES ($1, $2, false, '{}'::jsonb, now(), now())
        ON CONFLICT (id) DO UPDATE SET
          name = $2, onboarding_complete = false, metadata = '{}'::jsonb, updated_at = now()
        $q$,
        s
      ) USING uid, split_part(uemail, '@', 1);

      RAISE NOTICE '  restored profile for %', uemail;
    END LOOP;

    -- Re-seed modules table (all enabled by default so onboarding can toggle)
    BEGIN
      EXECUTE format(
        $q$
        INSERT INTO %I.modules (id, enabled, config, created_at)
        SELECT unnest(ARRAY[
          'finances','health','people','career','objectives','routine',
          'assets','entertainment','legal','housing','calendar'
        ]), true, '{}'::jsonb, now()
        ON CONFLICT (id) DO UPDATE SET enabled = true
        $q$,
        s
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  modules table missing in % — skipping seed', s;
    END;

  END LOOP;

  RAISE NOTICE 'Reset complete.';
END $$;

COMMIT;
