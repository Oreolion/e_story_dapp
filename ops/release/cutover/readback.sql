-- Metadata only. Catalog state is not proof that all API instances reloaded.
SELECT
  to_regprocedure('public.istory_cutover_guard()') IS NOT NULL AS guard_present,
  EXISTS (
    SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) AS entry
    WHERE r.rolname = 'authenticator' AND s.setdatabase = 0
      AND entry = 'pgrst.db_pre_request=public.istory_cutover_guard'
  ) AS global_fence_configured,
  (SELECT count(*) FROM pg_stat_activity
    WHERE usename = 'authenticator' AND xact_start IS NOT NULL
      AND state <> 'idle') AS open_data_api_transactions;
