// Exact, operator-authorized feature migration; never runs db push or older files.
// node scripts/apply-migration019.mjs <installed Supabase CLI JS entry> --apply
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function transactionSql(migration) {
  if (migration.includes('$istory019$')) throw new Error('Unexpected SQL delimiter');
  return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('istory-migration-019'));
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='019') THEN
    RAISE EXCEPTION '019 already recorded: verify the applied definition instead of overwriting';
  END IF;
  IF to_regprocedure('public.delete_user_account_data(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected existing deletion RPC: review before replacing';
  END IF;
END $guard$;
${migration}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES ('019','create_content_safety_and_account_deletion',ARRAY[$istory019$${migration}$istory019$]);
NOTIFY pgrst, 'reload schema';
COMMIT;`;
}

export function verificationSql(migration) {
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const bodies = [...migration.matchAll(/CREATE OR REPLACE FUNCTION (\w+)\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)];
  if (bodies.length !== 3) throw new Error('Expected exactly three RPC definitions');
  return `SELECT json_build_object(
    'history_matches',COALESCE((SELECT statements[1]=${literal(migration)} FROM supabase_migrations.schema_migrations WHERE version='019'),false),
    'function_bodies_match',${bodies.map(([, name, body]) => `COALESCE((SELECT prosrc=${literal(body)} FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${literal(name)}),false)`).join(' AND ')},
    'three_rls_tables',(SELECT count(*)=3 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('content_reports','user_blocks','api_rate_limits') AND relrowsecurity),
    'service_only_rpcs',(SELECT count(*)=3 AND bool_and(prosecdef AND has_function_privilege('service_role',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('authenticated',oid,'EXECUTE')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('consume_api_quota','block_user','delete_user_account_data')),
    'avatars_configured',COALESCE((SELECT public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] FROM storage.buckets WHERE id='avatars'),false)
  ) AS checks;`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cliEntry, confirmation] = process.argv.slice(2);
  if (!cliEntry || !['--apply','--verify'].includes(confirmation)) throw new Error('Explicit --apply/--verify and installed Supabase CLI JS entry required');
  const migration = readFileSync(new URL('../supabase/migrations/019_create_content_safety_and_account_deletion.sql', import.meta.url), 'utf8');
  const result = spawnSync(process.execPath, [cliEntry, 'db', 'query', '--linked', '--project-ref', 'qfwhtsmqndnocfidhdhy', '--output', 'json', confirmation === '--apply' ? transactionSql(migration) : verificationSql(migration)], { encoding: 'utf8', env: { ...process.env, CI: '1' } });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  else if (confirmation === '--verify') {
    const checks = JSON.parse(result.stdout).rows?.[0]?.checks;
    if (!checks || Object.values(checks).some(value => value !== true)) throw new Error('Production migration verification failed');
  }
}
