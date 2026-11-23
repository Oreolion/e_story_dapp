import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFreshBootstrap } from './staging-bootstrap.mjs';
import { syntheticPlatformSql } from './staging-bootstrap-fixture.mjs';

test('fresh bootstrap installs the real migration chain atomically on an empty synthetic platform', async () => {
  const db = new PGlite();
  try {
    await db.exec(syntheticPlatformSql);
    const plan = buildFreshBootstrap();
    await db.exec(plan.sql);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations')).rows[0].n, 24);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity")).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname='books_author_created'")).rows[0].n, 1);
    assert.ok(!/\bDROP\s+(TABLE|DATABASE)\b/i.test(plan.sql));
    await db.exec(fs.readFileSync(new URL('../ops/staging/fresh-probes.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n, 0, 'probe records are rolled back');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ai_daily_provider_calls')).rows[0].n, 0, 'probe budgets are rolled back');
    await assert.rejects(db.exec(plan.sql), /STAGING_BOOTSTRAP_NOT_EMPTY/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations')).rows[0].n, 24);
  } finally { await db.close(); }
});

test('the runner rejects remote arguments and invalidates a previous passing receipt after failure', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'istory-bootstrap-cli-'));
  const receipt = path.join(directory,'output/staging/fresh-bootstrap-postgres17.json');
  fs.mkdirSync(path.dirname(receipt),{recursive:true});
  fs.writeFileSync(receipt,JSON.stringify({status:'FRESH_BOOTSTRAP_REHEARSED'}));
  const environment = Object.fromEntries(['PATH','SystemRoot','TEMP','TMP'].filter(key => process.env[key]).map(key => [key,process.env[key]]));
  const runner = fileURLToPath(new URL('./rehearse-staging-bootstrap.mjs',import.meta.url));
  const invoke = args => spawnSync(process.execPath,[runner,...args],{cwd:directory,env:{...environment,GITHUB_ACTIONS:'false'},encoding:'utf8',timeout:30000,windowsHide:true});
  const failed = invoke(['--postgres17']);
  assert.equal(failed.status,1);
  assert.equal(JSON.parse(fs.readFileSync(receipt,'utf8')).status,'FAILED');
  assert.equal(JSON.parse(failed.stderr.trim()).stage,'engine');
  const remote = invoke(['--database-url=postgresql://synthetic.invalid/not-a-target']);
  assert.equal(remote.status,1);
  assert.match(remote.stderr,/Usage:/);
});

test('refuses existing app objects, identities, storage, migration history and unsafe roles without changing them', async () => {
  const cases = [
    ["CREATE TABLE public.existing_record(value text); INSERT INTO public.existing_record VALUES('synthetic-preserve')", 'NOT_EMPTY'],
    ["CREATE FUNCTION public.existing_function() RETURNS integer LANGUAGE sql AS 'SELECT 1'", 'NOT_EMPTY'],
    ["CREATE FUNCTION public.pg_advisory_xact_lock(integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'UNSAFE_FUNCTION_EXECUTED'; END $$", 'NOT_EMPTY'],
    ["CREATE SEQUENCE public.existing_sequence", 'NOT_EMPTY'],
    ["INSERT INTO auth.users VALUES('11000000-0000-4000-8000-000000000001')", 'NOT_EMPTY'],
    ["INSERT INTO storage.buckets(id,name) VALUES('existing','existing')", 'NOT_EMPTY'],
    ["CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY); INSERT INTO supabase_migrations.schema_migrations VALUES('existing')", 'NOT_EMPTY'],
    ['ALTER ROLE anon BYPASSRLS', 'ROLES_UNSAFE'],
    ['GRANT service_role TO authenticated', 'ROLES_UNSAFE'],
    ['ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY', 'PLATFORM_REQUIRED'],
  ];
  for (const [setup, code] of cases) {
    const db = new PGlite();
    try {
      await db.exec(syntheticPlatformSql);
      await db.exec(setup);
      const before = await db.query("SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY oid");
      await assert.rejects(db.exec(buildFreshBootstrap().sql), new RegExp('STAGING_BOOTSTRAP_' + code));
      await db.exec('ROLLBACK');
      assert.deepEqual((await db.query("SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY oid")).rows, before.rows);
      assert.equal((await db.query("SELECT to_regnamespace('istory_staging_bootstrap') AS schema")).rows[0].schema, null);
      if (setup.includes('synthetic-preserve')) assert.equal((await db.query('SELECT value FROM public.existing_record')).rows[0].value, 'synthetic-preserve');
      if (setup.startsWith('INSERT INTO auth.users')) assert.equal((await db.query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n, 1);
      if (setup.startsWith('INSERT INTO storage.buckets')) assert.equal((await db.query('SELECT name FROM storage.buckets')).rows[0].name, 'existing');
      if (setup.startsWith('CREATE SCHEMA supabase_migrations')) assert.equal((await db.query('SELECT version FROM supabase_migrations.schema_migrations')).rows[0].version,'existing');
    } finally { await db.close(); }
  }
});

test('a failure after the last migration rolls back all app DDL and history', async () => {
  const db = new PGlite();
  try {
    await db.exec(syntheticPlatformSql);
    const broken = buildFreshBootstrap().sql.replace(/\nCOMMIT;$/, () => "\nDO $$ BEGIN RAISE EXCEPTION 'INJECTED_LATE_FAILURE'; END $$;\nCOMMIT;");
    await assert.rejects(db.exec(broken), /INJECTED_LATE_FAILURE/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace")).rows[0].n, 0);
    assert.equal((await db.query("SELECT to_regclass('supabase_migrations.schema_migrations') AS table")).rows[0].table, null);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM storage.buckets')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('real client roles cannot read private data or invoke privileged functions; managed objects remain unchanged', async () => {
  const db = new PGlite();
  try {
    await db.exec(syntheticPlatformSql);
    await db.exec("CREATE FUNCTION public.extension_fixture() RETURNS integer LANGUAGE sql AS 'SELECT 1'; ALTER EXTENSION plpgsql ADD FUNCTION public.extension_fixture()");
    const before = await db.query("SELECT oid,proacl FROM pg_proc WHERE oid IN ('auth.uid()'::regprocedure,'auth.role()'::regprocedure,'public.extension_fixture()'::regprocedure) ORDER BY oid");
    await db.exec(buildFreshBootstrap().sql);
    assert.deepEqual((await db.query("SELECT oid,proacl FROM pg_proc WHERE oid IN ('auth.uid()'::regprocedure,'auth.role()'::regprocedure,'public.extension_fixture()'::regprocedure) ORDER BY oid")).rows, before.rows);
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await assert.rejects(db.exec('CREATE TABLE public.client_created(id integer)'), /permission denied/);
        for (const table of ['users','stories','books','habits','daily_logs','payments','ai_jobs','auth_identity_links']) {
          await assert.rejects(db.query(`SELECT * FROM public.${table}`), /permission denied/);
        }
        await assert.rejects(db.query("SELECT * FROM public.claim_ai_job(NULL)"), /permission denied/);
        await assert.rejects(db.query("SELECT * FROM istory_staging_bootstrap.manifest"), /permission denied/);
        assert.equal((await db.query('SELECT public.extension_fixture() AS n')).rows[0].n, 1);
      } finally { await db.exec('RESET ROLE'); }
    }
    await db.exec("CREATE FUNCTION public.future_function() RETURNS integer LANGUAGE sql AS 'SELECT 1'; CREATE TABLE public.future_table(id integer)");
    for (const role of ['anon','authenticated']) {
      assert.equal((await db.query(`SELECT has_function_privilege('${role}','public.future_function()','EXECUTE') AS allowed`)).rows[0].allowed, false);
      assert.equal((await db.query(`SELECT has_table_privilege('${role}','public.future_table','SELECT') AS allowed`)).rows[0].allowed, false);
    }
  } finally { await db.close(); }
});

test('private audio policies block direct upload and overwrite despite permissive client grants', async () => {
  const db = new PGlite();
  try {
    await db.exec(syntheticPlatformSql);
    await db.exec(buildFreshBootstrap().sql);
    await db.exec("CREATE POLICY synthetic_permissive ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)");
    await db.exec("SET ROLE service_role; INSERT INTO storage.objects(id,bucket_id,name) VALUES('33000000-0000-4000-8000-000000000001','story-audio','synthetic/audio.webm'); RESET ROLE");
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await assert.rejects(db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('story-audio','synthetic/direct.webm')"), /row-level security/);
        assert.equal((await db.query("UPDATE storage.objects SET name='overwritten.webm' WHERE bucket_id='story-audio' RETURNING id")).rows.length,0);
        await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('avatars','synthetic/avatar.webp')");
      } finally { await db.exec('RESET ROLE'); }
    }
    assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='story-audio'")).rows[0].name,'synthetic/audio.webm');
  } finally { await db.close(); }
});
