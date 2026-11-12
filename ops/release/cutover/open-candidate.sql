-- Public app admission remains held. Keep the legacy-server fence installed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(59147724,1) THEN RAISE EXCEPTION 'CUTOVER_OPERATOR_BUSY'; END IF;
  PERFORM istory_release.assert_guard();
  IF EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND split_part(entry,'=',1)='pgrst.db_pre_request'
    AND (s.setdatabase<>0 OR entry<>'pgrst.db_pre_request=public.istory_release_guard'))
    OR NOT EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
      CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND s.setdatabase=0 AND entry='pgrst.db_pre_request=public.istory_release_guard')
    THEN RAISE EXCEPTION 'CUTOVER_FENCE_IDENTITY_MISMATCH'; END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('020','021','022','023'))<>4
    THEN RAISE EXCEPTION 'CUTOVER_SCHEMA_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='authenticator' AND pid<>pg_backend_pid() AND state IS DISTINCT FROM 'idle')
    THEN RAISE EXCEPTION 'CUTOVER_DATA_API_TRANSACTIONS_PRESENT'; END IF;
  UPDATE istory_release.control SET mode='candidate' WHERE singleton AND mode='paused' AND epoch IS NOT NULL AND octet_length(key_sha256)=32;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_STATE_MISMATCH'; END IF;
END;
$$;
COMMIT;
