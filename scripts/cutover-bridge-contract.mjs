// Offline, non-secret definition binding shared by batch preparation and tests.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
export function bridgeChecksSql() {
  const sql = fs.readFileSync(new URL('../ops/release/cutover/install-bridge.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const parts = sql.split('$bridge_guard$');
  if (parts.length !== 3) throw new Error('CUTOVER_BRIDGE_DEFINITION_CHANGED');
  const digest = createHash('sha256').update(parts[1]).digest('hex');
  return `LOCK TABLE istory_release.control IN SHARE MODE;
DO $bridge_check$
BEGIN
  IF to_regprocedure('public.istory_release_guard()') IS NULL OR NOT EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid='public.istory_release_guard()'::regprocedure AND l.lanname='plpgsql'
      AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']
      AND encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')='${digest}'
      AND p.proowner=(SELECT relowner FROM pg_class WHERE oid='istory_release.control'::regclass)
  ) THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_DEFINITION_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND s.setdatabase=0
      AND entry='pgrst.db_pre_request=public.istory_release_guard')
    OR EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
      CROSS JOIN LATERAL unnest(s.setconfig) entry WHERE r.rolname='authenticator' AND split_part(entry,'=',1)='pgrst.db_pre_request'
      AND (s.setdatabase<>0 OR entry<>'pgrst.db_pre_request=public.istory_release_guard'))
    THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_HOOK_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM istory_release.control WHERE singleton AND mode='paused' AND epoch IS NOT NULL AND octet_length(key_sha256)=32)
    THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_PAUSE_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
    WHERE has_schema_privilege(role_name,'istory_release','USAGE') OR has_table_privilege(role_name,'istory_release.control','SELECT')
      OR has_table_privilege(role_name,'istory_release.control','UPDATE')
      OR has_table_privilege(role_name,'istory_release.payment_callbacks','SELECT,INSERT,UPDATE,DELETE'))
    THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_GRANTS_UNSAFE'; END IF;
END;
$bridge_check$;
`;
}
