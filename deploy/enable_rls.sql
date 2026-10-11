-- ============================================================================
-- Booyah Win: Enable Row Level Security (RLS) on all public tables
-- ============================================================================
-- CRITICAL OPERATIONAL NOTES:
-- 1. MANUAL EXECUTION ONLY:
--    This script is intended to be run manually by the operator in the Supabase
--    SQL Editor during initial production setup or hardening.
-- 2. NEVER RUN BY MIGRATIONS:
--    Do not include this script in automated node-pg-migrate migrations, as
--    local test suites and migration runners operate under different permissions.
-- 3. API ROLE MUST BYPASS RLS:
--    The Booyah Win backend API connects using the PostgreSQL 'postgres' or
--    service_role connection string. In PostgreSQL, superuser and roles created
--    with BYPASSRLS automatically bypass Row Level Security.
-- 4. PURPOSE:
--    By enabling RLS without granting policies to the 'anon' or 'authenticated'
--    Supabase PostgREST roles, direct client-side querying via the Supabase
--    JavaScript client or REST endpoints with the public anon key is blocked,
--    ensuring all database access is mediated strictly through the Node.js API.
-- ============================================================================

DO $$
DECLARE
  tbl_record RECORD;
  enabled_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting Row Level Security (RLS) configuration for public schema...';

  FOR tbl_record IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_record.tablename);
    RAISE NOTICE 'Row Level Security enabled on table: public.%', tbl_record.tablename;
    enabled_count := enabled_count + 1;
  END LOOP;

  RAISE NOTICE 'Completed: RLS successfully ensured on % public tables.', enabled_count;
END $$;
