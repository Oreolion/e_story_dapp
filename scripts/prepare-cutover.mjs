// Offline artifact preparation only. No database, network or credential access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { reviewedMigrations, permissionsSql } from './recovery-migrations.mjs';
import { bridgeChecksSql } from './cutover-bridge-contract.mjs';

function migrationBody(sql) {
  // Only the four hash-verified files are accepted, not arbitrary SQL input.
  const lines = sql.trimEnd().split('\n');
  const begin = lines.findIndex(line => line === 'BEGIN;');
  if (begin < 0 || lines.at(-1) !== 'COMMIT;' || lines.slice(0, begin).some(line => line.trim() && !line.startsWith('--')) ||
    lines.filter(line => line === 'BEGIN;').length !== 1 || lines.filter(line => line === 'COMMIT;').length !== 1) throw new Error('CUTOVER_TRANSACTION_BOUNDARY_CHANGED');
  return lines.slice(begin + 1, -1).join('\n');
}

export function compileCutoverBatch() {
  const reviewed = reviewedMigrations();
  const operations = ['install','pause','install-bridge','activate-bridge','open-candidate','hold-candidate','readback-bridge'].map(name => {
    const file = `ops/release/cutover/${name}.sql`;
    const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    return { file, sha256: createHash('sha256').update(text).digest('hex') };
  });
  const sql = `-- Offline prepared operation for Supabase qfwhtsmqndnocfidhdhy only.
-- NOT AUTHORIZATION TO EXECUTE. Requires approved maintenance, hosted fence,
-- drained legacy execution, fresh applicable recovery and exact-artifact audit.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL transaction_timeout='120s';
SET LOCAL search_path=pg_catalog,public;
DO $cutover$
BEGIN
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'CUTOVER_DATABASE_MAJOR_MISMATCH';
  END IF;
  IF NOT pg_try_advisory_xact_lock(59147724,1) THEN RAISE EXCEPTION 'CUTOVER_OPERATOR_BUSY'; END IF;
  IF to_regprocedure('public.istory_cutover_guard()') IS NULL OR NOT EXISTS(
    SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) entry
    WHERE r.rolname='authenticator' AND s.setdatabase=0 AND entry IN ('pgrst.db_pre_request=public.istory_cutover_guard','pgrst.db_pre_request=public.istory_release_guard')
  ) OR EXISTS(
    SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) entry
    WHERE r.rolname='authenticator' AND split_part(entry,'=',1)='pgrst.db_pre_request'
      AND (s.setdatabase<>0 OR entry NOT IN ('pgrst.db_pre_request=public.istory_cutover_guard','pgrst.db_pre_request=public.istory_release_guard'))
  ) THEN RAISE EXCEPTION 'CUTOVER_EFFECTIVE_FENCE_REQUIRED'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid='public.istory_cutover_guard()'::regprocedure AND l.lanname='plpgsql'
      AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']
      AND p.prosrc=$guard_source$
BEGIN
  RAISE SQLSTATE 'PGRST' USING
    MESSAGE = '{"code":"ISTORY_RELEASE_PAUSED","message":"Application maintenance in progress","details":null,"hint":null}',
    DETAIL = '{"status":503,"headers":{"Cache-Control":"no-store"}}';
END;
$guard_source$
  ) OR EXISTS(SELECT 1 FROM unnest(ARRAY['authenticator','anon','authenticated','service_role']) role_name
    WHERE NOT has_function_privilege(role_name,'public.istory_cutover_guard()','EXECUTE'))
    THEN RAISE EXCEPTION 'CUTOVER_GUARD_DEFINITION_MISMATCH'; END IF;
  IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='authenticator' AND pid<>pg_backend_pid() AND state IS DISTINCT FROM 'idle') THEN
    RAISE EXCEPTION 'CUTOVER_DATA_API_TRANSACTIONS_PRESENT';
  END IF;
END;
$cutover$;
${bridgeChecksSql()}
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $history$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='019')
    OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version !~ '^0(0[0-9]|1[0-9])$')
    THEN RAISE EXCEPTION 'CUTOVER_HISTORY_MISMATCH'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['ai_jobs','ai_daily_provider_calls','payment_notification_outbox','auth_identity_links','auth_link_challenges']) name
    WHERE to_regclass('public.'||name) IS NOT NULL) THEN RAISE EXCEPTION 'CUTOVER_EXISTING_RELEASE_OBJECTS'; END IF;
END;
$history$;
${reviewed.map(m => `-- ${m.file} canonical LF SHA256 ${m.sha256}
${migrationBody(m.sql)}
INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES('${m.file.slice(0, 3)}','${m.file.slice(4, -4)}');`).join('\n')}
-- Check effective server/client grants before schema AND history can commit.
${permissionsSql}
NOTIFY pgrst, 'reload schema';
COMMIT;
`;
  return { intendedProjectRef: 'qfwhtsmqndnocfidhdhy', sql, sqlSha256: createHash('sha256').update(sql).digest('hex'), operations, migrations: reviewed.map(({ file, sha256 }) => ({ file, sha256 })) };
}

function main() {
  const [mode, output, ...extra] = process.argv.slice(2);
  if (!['--output', '--check'].includes(mode) || !output || extra.length || path.extname(output).toLowerCase() !== '.sql') throw new Error('CUTOVER_USAGE: --output NEW.sql or --check EXISTING.sql');
  const { sql, ...metadata } = compileCutoverBatch();
  if (mode === '--output') fs.writeFileSync(output, sql, { flag: 'wx', mode: 0o600 });
  else {
    const stat = fs.lstatSync(output);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100000 || fs.readFileSync(output, 'utf8') !== sql) throw new Error('CUTOVER_ARTIFACT_MISMATCH');
  }
  console.log(JSON.stringify({ status: mode === '--output' ? 'OFFLINE_BATCH_PREPARED' : 'OFFLINE_BATCH_MATCHES_REVIEWED_INPUTS', ...metadata }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    // File/provider diagnostics and SQL are never printed by this tool.
    console.error(JSON.stringify({ error: error instanceof Error && /^CUTOVER_[A-Z_: .-]+$/.test(error.message) ? error.message : 'CUTOVER_PREPARATION_FAILED' }));
    process.exitCode = 1;
  }
}
