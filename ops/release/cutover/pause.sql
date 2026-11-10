-- Activating this is a production outage. Never run as a readiness probe.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $check$
BEGIN
  IF NOT pg_try_advisory_xact_lock(59147724, 1) THEN
    RAISE EXCEPTION 'CUTOVER_OPERATOR_BUSY';
  END IF;
  IF to_regprocedure('public.istory_cutover_guard()') IS NULL THEN
    RAISE EXCEPTION 'CUTOVER_GUARD_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) AS entry
    WHERE r.rolname = 'authenticator' AND split_part(entry, '=', 1) = 'pgrst.db_pre_request'
      AND (s.setdatabase <> 0 OR split_part(entry, '=', 2) NOT IN ('', 'public.istory_cutover_guard'))
  ) THEN
    RAISE EXCEPTION 'CUTOVER_EXISTING_CONTROL_CONFLICT';
  END IF;
END;
$check$;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.istory_cutover_guard';
NOTIFY pgrst, 'reload config';
COMMIT;
