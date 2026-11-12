-- Emergency hold preserves the authenticated callback inbox and all retained data.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(59147724,1) THEN RAISE EXCEPTION 'CUTOVER_OPERATOR_BUSY'; END IF;
  UPDATE istory_release.control SET mode='paused' WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_STATE_MISMATCH'; END IF;
END;
$$;
COMMIT;
