import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { reviewedMigrations, rehearseMigrations, snapshotSql, preservationSql, permissionsSql } from './recovery-migrations.mjs';
import { createRestoreTarget, stopRestoreTarget, targetQuery } from './recovery-restore.mjs';
import { installMigrationFixture } from './recovery-migrations-fixture.mjs';

test('rehearsal binds only the reviewed four migrations and rejects targets not owned by this process', () => {
  const reviewed = reviewedMigrations();
  assert.deepEqual(reviewed.map(m => m.file.slice(0, 3)), ['020', '021', '022', '023']);
  for (const target of ['production', 'postgres://synthetic.invalid', 'istory-recovery-unowned']) {
    assert.throws(() => rehearseMigrations(target), /^Error: REHEARSAL_MIGRATIONS_FAILED$/);
  }
});

test('a changed migration file fails identity validation before execution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-migration-drift-'));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  fs.copyFileSync(new URL('./recovery-migrations.mjs', import.meta.url), path.join(root, 'scripts', 'recovery-migrations.mjs'));
  fs.writeFileSync(path.join(root, 'scripts', 'recovery-restore.mjs'), "export const targetMigrationQuery = () => { throw new Error('UNEXPECTED_DATABASE_ACCESS'); };\n");
  for (const m of reviewedMigrations()) fs.writeFileSync(path.join(root, 'supabase', 'migrations', m.file), m.sql + (m.file.startsWith('021') ? '\nSELECT 1;\n' : ''));
  const changed = await import(pathToFileURL(path.join(root, 'scripts', 'recovery-migrations.mjs')));
  assert.throws(() => changed.rehearseMigrations('unowned'), /^Error: REHEARSAL_MIGRATION_IDENTITY_FAILED$/);
});

test('real isolated migration rehearsal supports UUID/TEXT legacy owners and detects data/permission regressions',
  { skip: process.env.TEST_RECOVERY_DOCKER !== '1', timeout: 120000 }, async () => {
    for (const ownerType of ['uuid', 'text']) {
      const target = await createRestoreTarget();
      try {
        installMigrationFixture(target, ownerType);
        const result = rehearseMigrations(target);
        assert.equal(result.status, 'ISOLATED_MIGRATIONS_VERIFIED');
        assert.equal(result.functionalProbes, true);
        assert.equal(result.rpcChecks, 18);
        assert.ok(result.preservedTables >= 10);
        assert.equal(result.preservedRows, 5);
        assert.equal(JSON.stringify(result).includes('synthetic-private-value'), false);
        assert.equal(targetQuery(target, 'SELECT count(*) FROM public.users;').trim(), '0', 'synthetic probes roll back');
        assert.equal(targetQuery(target, 'SELECT count(*) FROM public.ai_jobs;').trim(), '0');
        assert.equal(targetQuery(target, 'SELECT version FROM supabase_migrations.schema_migrations;').trim(), '019', 'never mark production migrations deployed');

        // Same row count, different value: count-only verification would miss it.
        assert.throws(() => targetQuery(target, snapshotSql + "UPDATE public.rehearsal_duplicates SET value='changed' WHERE value IS NOT NULL;" + preservationSql), /RESTORE_CHECK_FAILED/);
        targetQuery(target, "UPDATE public.rehearsal_duplicates SET value='synthetic-private-value' WHERE value IS NOT NULL;");
        assert.throws(() => targetQuery(target, snapshotSql + `UPDATE public.rehearsal_duplicates SET payload='{"a":1}' WHERE payload IS NOT NULL;` + preservationSql), /RESTORE_CHECK_FAILED/, 'original JSON text is preserved');
        targetQuery(target, `UPDATE public.rehearsal_duplicates SET payload='{"a": 1}' WHERE payload IS NOT NULL;`);
        assert.throws(() => targetQuery(target, snapshotSql + 'ALTER TABLE public.rehearsal_duplicates ALTER COLUMN value TYPE varchar;' + preservationSql), /RESTORE_CHECK_FAILED/, 'same values with changed column types fail');
        targetQuery(target, 'ALTER TABLE public.rehearsal_duplicates ALTER COLUMN value TYPE text;');
        assert.throws(() => targetQuery(target, snapshotSql + "DELETE FROM public.rehearsal_duplicates WHERE ctid IN (SELECT ctid FROM public.rehearsal_duplicates WHERE value IS NOT NULL LIMIT 1); INSERT INTO public.rehearsal_duplicates VALUES(NULL,NULL);" + preservationSql), /RESTORE_CHECK_FAILED/);
        // REVOKE table UPDATE does not revoke a pre-existing column grant.
        targetQuery(target, 'GRANT UPDATE(wallet_address) ON public.users TO authenticated;');
        assert.throws(() => targetQuery(target, permissionsSql), /RESTORE_CHECK_FAILED/);
        targetQuery(target, 'REVOKE UPDATE(wallet_address) ON public.users FROM authenticated;');
        targetQuery(target, permissionsSql);
        targetQuery(target, 'REVOKE UPDATE ON public.users FROM service_role;');
        assert.throws(() => targetQuery(target, permissionsSql), /RESTORE_CHECK_FAILED/, 'server access must survive client revocations');
        targetQuery(target, 'GRANT UPDATE ON public.users TO service_role;');
        targetQuery(target, 'GRANT EXECUTE ON FUNCTION public.claim_ai_job(uuid,integer,integer) TO anon;');
        assert.throws(() => targetQuery(target, permissionsSql), /RESTORE_CHECK_FAILED/);
        targetQuery(target, 'REVOKE EXECUTE ON FUNCTION public.claim_ai_job(uuid,integer,integer) FROM anon; CREATE FUNCTION public.claim_ai_job() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;');
        assert.throws(() => targetQuery(target, permissionsSql), /RESTORE_CHECK_FAILED/, 'a public overload also fails');
        assert.throws(() => rehearseMigrations(target), /REHEARSAL_020_FAILED/, 'replaying already-applied migrations fails');
      } finally { stopRestoreTarget(target); }
    }
  });
