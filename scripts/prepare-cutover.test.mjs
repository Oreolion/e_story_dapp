import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileCutoverBatch } from './prepare-cutover.mjs';
import { createRestoreTarget, stopRestoreTarget, targetQuery } from './recovery-restore.mjs';
import { installMigrationFixture } from './recovery-migrations-fixture.mjs';
import { permissionsSql, probesSql } from './recovery-migrations.mjs';

async function withHeldSession(target, role, lock, action) {
  targetQuery(target, 'SELECT 1;'); // Verifies this process owns the isolated target.
  const child = spawn('docker', ['exec', '-i', target, 'psql', '-X', '-qAt', '-h', '/tmp', '-U', role, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
  const closed = new Promise(resolve => { child.once('close', code => resolve(code)); child.once('error', () => resolve(-1)); });
  child.stdin.on('error', () => {});
  child.stdin.end(`SELECT pg_advisory_lock(59147724,${lock}); SELECT pg_sleep(8);`);
  try {
    let observed = false;
    for (let n = 0; n < 30; n++) {
      if (targetQuery(target, `SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=59147724 AND objid=${lock} AND granted);`).trim() === 't') { observed = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(observed, 'test session must hold its observed lock before the batch is attempted');
    action();
  } finally { assert.equal(await closed, 0); }
}

test('offline batch artifact is deterministic, hash bound and refuses overwrite or tampering', () => {
  const batch = compileCutoverBatch();
  assert.equal(batch.sqlSha256, createHash('sha256').update(batch.sql).digest('hex'));
  assert.deepEqual(batch.migrations.map(m => m.file.slice(0, 3)), ['020', '021', '022', '023']);
  assert.deepEqual(compileCutoverBatch(), batch);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-cutover-artifact-'));
  const output = path.join(root, 'batch.sql');
  const cli = args => spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-cutover.mjs', import.meta.url)), ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(cli(['--output', output]).status, 0);
  assert.equal(cli(['--check', output]).status, 0);
  assert.equal(cli(['--output', output]).status, 1);
  fs.appendFileSync(output, '\nSELECT 1;\n');
  assert.equal(cli(['--check', output]).status, 1);
  assert.equal(cli(['--project-ref', 'unexpected']).status, 1);
});

test('real PostgreSQL batch refuses an unfenced target, rolls back late failure and commits schema/history together',
  { skip: process.env.TEST_RECOVERY_DOCKER !== '1', timeout: 180000 }, async () => {
    for (const ownerType of ['uuid', 'text']) {
      const target = await createRestoreTarget();
      try {
        installMigrationFixture(target, ownerType);
        targetQuery(target, `ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN name text, ADD COLUMN statements text[], ADD COLUMN created_by text, ADD COLUMN idempotency_key text, ADD COLUMN rollback text[];
          CREATE ROLE authenticator LOGIN NOINHERIT;`);
        const { sql } = compileCutoverBatch();
        assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/);
        assert.equal(targetQuery(target, "SELECT to_regclass('public.ai_jobs') IS NULL;").trim(), 't');
        for (const name of ['install', 'pause']) targetQuery(target, fs.readFileSync(new URL(`../ops/release/cutover/${name}.sql`, import.meta.url), 'utf8'));

        targetQuery(target, 'CREATE OR REPLACE FUNCTION public.istory_cutover_guard() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$BEGIN RETURN; END;$$;');
        assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/, 'a matching setting cannot hide a guard that no longer denies requests');
        targetQuery(target, fs.readFileSync(new URL('../ops/release/cutover/install.sql', import.meta.url), 'utf8').replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'));
        assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/, 'a temporary fence alone cannot permit a release that reopens legacy writers');
        targetQuery(target, fs.readFileSync(new URL('../ops/release/cutover/install-bridge.sql', import.meta.url), 'utf8'));
        targetQuery(target, "UPDATE istory_release.control SET epoch='00000000-0000-4000-8000-000000000001',key_sha256=sha256(convert_to(repeat('a',64),'UTF8'));");
        targetQuery(target, fs.readFileSync(new URL('../ops/release/cutover/activate-bridge.sql', import.meta.url), 'utf8'));
        const callbackId = '00000000-0000-4000-8000-000000000021';
        targetQuery(target, `SELECT public.istory_retain_payment_callback('{"id":"${callbackId}","amountPaid":"2.99"}'::jsonb);`);

        await withHeldSession(target, 'supabase_admin', 1, () => assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/, 'another release operator holds the same operation lock'));
        await withHeldSession(target, 'authenticator', 2, () => {
          assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/, 'a pre-admitted Data API transaction is still active');
          assert.equal(targetQuery(target, "SET ROLE anon; SELECT count(*) FROM pg_stat_activity WHERE usename='authenticator' AND state IS NULL;").trim(), '1', 'an unprivileged operator cannot observe the other session state');
          const readback = targetQuery(target, 'SET ROLE anon;\n' + fs.readFileSync(new URL('../ops/release/cutover/readback.sql', import.meta.url), 'utf8'));
          assert.equal(readback.trim().split('|').at(-1), '1', 'operator readback reports hidden states separately from observed transactions');
          // Exercise the actual compiled preconditions without needing to grant
          // this role migration DDL privileges. Unknown state must stop here.
          const boundary = sql.indexOf('LOCK TABLE supabase_migrations.schema_migrations');
          assert.ok(boundary > 0);
          const checksOnly = sql.slice(0, boundary) + 'COMMIT;\n';
          assert.throws(() => targetQuery(target, 'SET ROLE anon;\n' + checksOnly), /RESTORE_CHECK_FAILED/, 'unknown session state cannot count as drained');
        });

        // A late statement failure must undo all four migrations AND history.
        const failing = sql.replace(/COMMIT;\n$/, 'SELECT 1/0;\nCOMMIT;\n');
        assert.notEqual(failing, sql);
        assert.throws(() => targetQuery(target, failing), /RESTORE_CHECK_FAILED/);
        assert.equal(targetQuery(target, "SELECT to_regclass('public.ai_jobs') IS NULL;").trim(), 't');
        assert.equal(targetQuery(target, 'SELECT string_agg(version,\',\' ORDER BY version) FROM supabase_migrations.schema_migrations;').trim(), '019');
        assert.equal(targetQuery(target, 'SELECT count(*) FROM istory_release.payment_callbacks;').trim(), '1', 'failed schema transaction must preserve already acknowledged receipts');

        targetQuery(target, sql);
        assert.equal(targetQuery(target, 'SELECT string_agg(version,\',\' ORDER BY version) FROM supabase_migrations.schema_migrations;').trim(), '019,020,021,022,023');
        assert.equal(targetQuery(target, "SELECT name FROM supabase_migrations.schema_migrations WHERE version='020';").trim(), 'durable_ai_jobs');
        targetQuery(target, permissionsSql + probesSql);
        assert.equal(targetQuery(target, 'SELECT count(*) FROM istory_release.payment_callbacks;').trim(), '1');
        targetQuery(target, fs.readFileSync(new URL('../ops/release/cutover/open-candidate.sql', import.meta.url), 'utf8'));
        assert.throws(() => targetQuery(target, "SET ROLE service_role; SELECT public.istory_release_guard();"), /RESTORE_CHECK_FAILED/, 'late legacy work remains denied after migration');
        targetQuery(target, fs.readFileSync(new URL('../ops/release/cutover/hold-candidate.sql', import.meta.url), 'utf8'));
        assert.equal(targetQuery(target, 'SELECT count(*) FROM public.users;').trim(), '0');
        assert.equal(targetQuery(target, "SELECT count(*) FROM public.rehearsal_duplicates;").trim(), '3');
        assert.equal(targetQuery(target, "SELECT count(*) FROM public.stories WHERE author_id IS NULL AND content IS NULL;").trim(), '1');
        assert.throws(() => targetQuery(target, sql), /RESTORE_CHECK_FAILED/, 'successful migrations are never silently replayed');
      } finally { stopRestoreTarget(target); }
    }
  });
