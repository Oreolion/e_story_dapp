-- An empty-schema check is defense in depth, not proof of a hosted target.
-- The shipped runner accepts no database connection or remote project input.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog,public,pg_temp;
SELECT pg_catalog.pg_advisory_xact_lock(59147724::bigint);
DO $fresh$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  ) OR to_regnamespace('istory_staging_bootstrap') IS NOT NULL THEN
    RAISE EXCEPTION 'STAGING_BOOTSTRAP_NOT_EMPTY';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('auth.role()') IS NULL OR to_regclass('storage.buckets') IS NULL
    OR to_regclass('storage.objects') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.objects') AND relrowsecurity) THEN
    RAISE EXCEPTION 'STAGING_BOOTSTRAP_PLATFORM_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM storage.objects)
    OR EXISTS (SELECT 1 FROM storage.buckets) THEN
    RAISE EXCEPTION 'STAGING_BOOTSTRAP_NOT_EMPTY';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations) THEN
      RAISE EXCEPTION 'STAGING_BOOTSTRAP_NOT_EMPTY';
    END IF;
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) <> 3
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
    OR EXISTS (
      SELECT 1 FROM pg_roles r WHERE (r.rolsuper OR r.rolbypassrls)
        AND (pg_has_role('anon',r.oid,'MEMBER') OR pg_has_role('authenticated',r.oid,'MEMBER'))
    ) THEN
    RAISE EXCEPTION 'STAGING_BOOTSTRAP_ROLES_UNSAFE';
  END IF;
END;
$fresh$;
-- Only after the empty-object checks, create unqualified legacy app objects
-- in public. Keep temporary relations last in lookup order.
SET LOCAL search_path = public,pg_catalog,pg_temp;
