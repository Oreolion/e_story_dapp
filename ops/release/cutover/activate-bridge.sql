-- Activates the paused bridge, including only its authenticated inbox exception.
-- Requires existing maintenance and a separately provisioned fresh key digest.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(59147724,1) THEN RAISE EXCEPTION 'CUTOVER_OPERATOR_BUSY'; END IF;
  PERFORM istory_release.assert_guard();
  IF NOT EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND s.setdatabase=0
      AND entry='pgrst.db_pre_request=public.istory_cutover_guard')
    OR EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
      CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND split_part(entry,'=',1)='pgrst.db_pre_request'
      AND (s.setdatabase<>0 OR entry<>'pgrst.db_pre_request=public.istory_cutover_guard'))
    THEN RAISE EXCEPTION 'CUTOVER_FENCE_IDENTITY_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM istory_release.control WHERE singleton AND mode='paused' AND epoch IS NOT NULL AND octet_length(key_sha256)=32)
    THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_CREDENTIAL_REQUIRED'; END IF;
END;
$$;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.istory_release_guard';
NOTIFY pgrst,'reload config';
COMMIT;
