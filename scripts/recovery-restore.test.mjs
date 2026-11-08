import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { encryptedExport, prepareEncryption, projectRef, plumbing } from './recovery-export.mjs';
import { catalogSql, CopyCounter } from './recovery-format.mjs';
import { createRestoreTarget, stopRestoreTarget, targetQuery, restoreBackup, verifyBackupDirectory } from './recovery-restore.mjs';

const gpg = process.env.TEST_GPG_EXECUTABLE ?? 'gpg';
const prefix = Buffer.from('synthetic-restore-phrase-café-日本語\n');
const privateValue = 'synthetic-journal-value-café-日本語';
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'istory-restore-test-'));
const readManifest = directory => JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const saveManifest = (directory, manifest) => fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));

test('old exports are rejected before any database target or passphrase operation', async () => {
  const directory = temp();
  saveManifest(directory, { formatVersion: 1, projectRef, status: 'EXPORTED_NOT_RESTORE_VERIFIED', parts: [] });
  await assert.rejects(verifyBackupDirectory(directory), /RESTORE_COMPLETE_SCHEMA_EXPORT_REQUIRED/);
});

// Explicit opt-in: the ordinary Windows tests do not need Docker. Linux CI
// downloads the pinned public image and runs this same synthetic rehearsal.
test('real isolated PostgreSQL restore verifies data, RLS roles, extensions and migration history; failures never publish evidence',
  { skip: process.env.TEST_RECOVERY_DOCKER !== '1', timeout: 240000 }, async () => {
    const source = await createRestoreTarget();
    const encryption = prepareEncryption(gpg);
    const directory = temp();
    try {
      targetQuery(source, `CREATE ROLE postgres SUPERUSER NOLOGIN;
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE custom_reader NOLOGIN NOBYPASSRLS;
        GRANT custom_reader TO anon WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
        CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
        CREATE EXTENSION pgcrypto WITH SCHEMA extensions VERSION '1.3';
        CREATE TABLE auth.schema_migrations(version varchar(255) PRIMARY KEY);
        INSERT INTO auth.schema_migrations VALUES ('20260101000000');
        CREATE TABLE storage.migrations(id integer PRIMARY KEY, name varchar(255), hash varchar(255), executed_at timestamp);
        INSERT INTO storage.migrations VALUES (1,'synthetic-storage','synthetic-hash','2026-01-01 00:00:00');
        CREATE TABLE public.journals(id integer PRIMARY KEY, value text NOT NULL);
        INSERT INTO public.journals VALUES (1,'${privateValue}'),(2,'escaped\\nvalue');
        CREATE TABLE public.empty_table(id integer);
        ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
        CREATE POLICY own_journal ON public.journals FOR SELECT TO custom_reader USING (id=1);
        GRANT USAGE ON SCHEMA public TO custom_reader;
        GRANT SELECT ON public.journals TO custom_reader;
        CREATE SCHEMA supabase_migrations;
        CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
        INSERT INTO supabase_migrations.schema_migrations VALUES ('019');`);
      const catalog = JSON.parse(targetQuery(source, catalogSql));
      const counter = new CopyCounter();
      const pgDump = args => {
        const result = spawnSync('docker', ['exec', source, 'pg_dump', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '--quote-all-identifiers', ...args],
          { env: plumbing(), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 30000, windowsHide: true });
        assert.equal(result.status, 0, 'synthetic pg_dump failed');
        // Same compatibility substitutions as CLI 2.120.0 dump_schema/data.sh.
        return Buffer.from(result.stdout.replace(/^\\(?:un)?restrict .*$/gm, '').replace(/^CREATE SCHEMA "/gm, 'CREATE SCHEMA IF NOT EXISTS "'));
      };
      const stages = [
        ['roles.sql.gpg', Buffer.from('CREATE ROLE custom_reader NOLOGIN NOBYPASSRLS;\nRESET ALL;\n')],
        ['schema.sql.gpg', pgDump(['--schema-only', ...catalog.schemaNames.map(n => '--schema=' + n)])],
        ['data.sql.gpg', pgDump(['--data-only', '--exclude-schema=supabase_migrations', '--exclude-table=auth.schema_migrations', '--exclude-table=storage.migrations'])],
        ['migration-schema.sql.gpg', pgDump(['--schema-only', '--schema=supabase_migrations'])],
        ['migration-data.sql.gpg', pgDump(['--data-only', '--schema=supabase_migrations'])],
      ];
      const manifest = { formatVersion: 2, projectRef, status: 'EXPORTED_NOT_RESTORE_VERIFIED', parts: [] };
      for (const [file, bytes] of stages) {
        if (['data.sql.gpg', 'migration-data.sql.gpg'].includes(file)) counter.write(bytes);
        manifest.parts.push(await encryptedExport({ source: { bytes }, encryption: { ...encryption, prefix }, output: path.join(directory, file) }));
      }
      const data = { formatVersion: 2, projectRef, catalog, copyCounts: counter.finish() };
      manifest.parts.push(await encryptedExport({ source: { bytes: Buffer.from(JSON.stringify(data)) }, encryption: { ...encryption, prefix }, output: path.join(directory, 'catalog.json.gpg') }));
      saveManifest(directory, manifest);
      await verifyBackupDirectory(directory);
      const restored = await restoreBackup({ directory, gpg, prefix });
      assert.equal(restored.status, 'DATABASE_RESTORE_VERIFIED');
      assert.equal(restored.checkedTables, 3);
      assert.equal(restored.checkedRows, 3);
      const evidence = fs.readFileSync(restored.evidence, 'utf8');
      assert.equal(evidence.includes(privateValue), false);
      assert.equal(evidence.includes(prefix.toString().trim()), false);
      assert.equal(readManifest(directory).status, 'EXPORTED_NOT_RESTORE_VERIFIED');
      if (process.platform === 'win32') {
        const operatorDirectory = temp();
        const cli = path.join(operatorDirectory, 'synthetic-cli.cjs');
        const driver = path.join(operatorDirectory, 'synthetic-operator.ps1');
        const payloads = Object.fromEntries(stages.map(([name, bytes]) => [name, bytes.toString('utf8')]));
        fs.writeFileSync(cli, `const args=process.argv.slice(2); const sql=${JSON.stringify(payloads)};
if(args.includes('--version')) console.log('2.120.0');
else if(args.includes('query')) console.log(${JSON.stringify(JSON.stringify([{ recovery_catalog: catalog }]))});
else { if(process.env.SUPABASE_DB_PASSWORD!=='synthetic-database-password') process.exit(3);
const history=args[args.indexOf('--schema')+1]==='supabase_migrations';
const stage=args.includes('--role-only')?'roles':history?(args.includes('--data-only')?'migration-data':'migration-schema'):args.includes('--data-only')?'data':'schema';
if(stage==='schema' && args[args.indexOf('--schema')+1]!==${JSON.stringify(catalog.schemaNames.join(','))}) process.exit(4);
process.stdout.write(sql[stage+'.sql.gpg']); }`);
        fs.writeFileSync(driver, `param($Wrapper,$Directory,$Cli,$NodeExecutable,$GpgExecutable)
function Read-Host { param($Prompt,[switch]$AsSecureString)
  $value=if($Prompt -like 'Existing Supabase*'){'synthetic-database-password'}else{'${prefix.toString('utf8').trim()}'}
  ConvertTo-SecureString $value -AsPlainText -Force
}
& $Wrapper -OutputDirectory $Directory -SupabaseCli $Cli -NodeExecutable $NodeExecutable -GpgExecutable $GpgExecutable -VerifyRestore
`, 'utf8');
        const run = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', driver, '-Wrapper', path.resolve('scripts/recovery-export.ps1'),
          '-Directory', operatorDirectory, '-Cli', cli, '-NodeExecutable', process.execPath, '-GpgExecutable', gpg], { encoding: 'utf8', timeout: 120000, windowsHide: true });
        assert.equal(run.status, 0, run.stdout + run.stderr);
        assert.match(run.stdout, /DATABASE_RESTORE_VERIFIED/);
        assert.equal((run.stdout + run.stderr).includes(prefix.toString().trim()), false);
        assert.equal((run.stdout + run.stderr).includes('synthetic-database-password'), false);
        assert.equal((run.stdout + run.stderr).includes(privateValue), false);
      }
      await assert.rejects(restoreBackup({ directory, gpg, prefix: Buffer.from('wrong-synthetic-passphrase\n') }), /RESTORE_PASSPHRASE_OR_CATALOG_INVALID/);
      const variant = async (file, bytes) => {
        const destination = temp();
        const changed = structuredClone(manifest);
        for (const part of changed.parts) {
          if (part.file === file) Object.assign(part, await encryptedExport({ source: { bytes }, encryption: { ...encryption, prefix }, output: path.join(destination, file) }));
          else fs.copyFileSync(path.join(directory, part.file), path.join(destination, part.file));
        }
        saveManifest(destination, changed);
        return destination;
      };
      const wrongCount = structuredClone(data); wrongCount.copyCounts[0].rows++;
      const wrongCountDirectory = await variant('catalog.json.gpg', Buffer.from(JSON.stringify(wrongCount)));
      await assert.rejects(restoreBackup({ directory: wrongCountDirectory, gpg, prefix }), /RESTORE_ROW_COUNT_MISMATCH/);
      const badSqlDirectory = await variant('data.sql.gpg', Buffer.from('SELECT * FROM missing_synthetic_table;\n'));
      await assert.rejects(restoreBackup({ directory: badSqlDirectory, gpg, prefix }));
      const originalSchema = stages.find(([name]) => name === 'schema.sql.gpg')[1].toString();
      const brokenPolicy = originalSchema.replace('USING (("id" = 1))', 'USING (true)');
      assert.ok(brokenPolicy !== originalSchema, 'synthetic policy mutation must change the dump');
      const badPolicyDirectory = await variant('schema.sql.gpg', Buffer.from(brokenPolicy));
      await assert.rejects(restoreBackup({ directory: badPolicyDirectory, gpg, prefix }), /RESTORE_CATALOG_MISMATCH_SECURITY/);
      for (const failedDirectory of [wrongCountDirectory, badSqlDirectory, badPolicyDirectory]) {
        assert.equal(fs.readdirSync(path.dirname(failedDirectory)).some(n => n.startsWith(path.basename(failedDirectory) + '.restore-')), false);
      }
      const corrupted = Buffer.from(fs.readFileSync(path.join(directory, 'data.sql.gpg'))); corrupted[corrupted.length - 3] ^= 1;
      fs.writeFileSync(path.join(directory, 'data.sql.gpg'), corrupted);
      await assert.rejects(restoreBackup({ directory, gpg, prefix }), /RESTORE_CIPHERTEXT_MISMATCH/);
      // Even a matching manifest cannot turn invalid ciphertext into a restore.
      const { createHash } = await import('node:crypto');
      manifest.parts.find(p => p.file === 'data.sql.gpg').sha256 = createHash('sha256').update(corrupted).digest('hex');
      saveManifest(directory, manifest);
      await assert.rejects(restoreBackup({ directory, gpg, prefix }));
      const evidenceFiles = fs.readdirSync(path.dirname(directory)).filter(n => n.startsWith(path.basename(directory) + '.restore-'));
      assert.equal(evidenceFiles.length, 1);
      assert.equal(fs.existsSync(path.join(directory, 'data.sql')), false);
    } finally { stopRestoreTarget(source); encryption.close(); }
  });
