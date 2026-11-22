// Synthetic-only rehearsal. No URL, credentials, dotenv, remote project, or
// production application option is accepted by this command.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { buildFreshBootstrap } from './staging-bootstrap.mjs';
import { syntheticPlatformSql } from './staging-bootstrap-fixture.mjs';

const mode = process.argv[2] ?? '--embedded';
if (process.argv.length > 3 || !['--embedded','--postgres17'].includes(mode)) {
  console.error('Usage: node scripts/rehearse-staging-bootstrap.mjs [--embedded|--postgres17]');
  process.exit(1);
}
const image = 'postgres@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f';
const container = 'istory-migration019-rehearsal-20261014';
let close = async () => {};
let stage = 'engine';
const directory = path.resolve('output/staging');
const output = path.join(directory,`fresh-bootstrap-${mode.slice(2)}.json`);
const record = data => fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 90000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error('REHEARSAL_DOCKER_FAILED');
  return result.stdout.trim(); // Only fixed catalog queries may be printed below.
}

try {
  fs.mkdirSync(directory,{recursive:true});
  record({status:'IN_PROGRESS',engine:mode.slice(2),startedAt:new Date().toISOString()});
  let db;
  if (mode === '--embedded') {
    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite();
    close = () => db.close();
  } else {
    // Reuse only CI's pinned, labelled, network-isolated synthetic container.
    // Create a unique database; never open the other tests' databases.
    if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('REHEARSAL_CI_REQUIRED');
    assert.equal(docker(['inspect','--format','{{.Config.Image}}|{{.HostConfig.NetworkMode}}|{{index .Config.Labels "istory.rehearsal"}}',container]), `${image}|none|runtime`);
    const database = 'istory_staging_' + randomUUID().replaceAll('-', '');
    const sql = (name, input) => docker(['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1'], input);
    sql('postgres', `CREATE DATABASE "${database}";`);
    db = {
      exec: async input => { sql(database, input); },
      query: async input => ({ rows: JSON.parse(sql(database, `SELECT COALESCE(json_agg(row_to_json(result)),'[]'::json) FROM (${input}) AS result;`)) }),
    };
    // The job-owned container expires with the runner. No database/container
    // deletion or destructive cleanup command is performed here.
  }
  stage = 'synthetic-platform';
  await db.exec(syntheticPlatformSql);
  const plan = buildFreshBootstrap();
  stage = 'bootstrap';
  await db.exec(plan.sql);
  stage = 'functional-probes';
  const probes = fs.readFileSync(new URL('../ops/staging/fresh-probes.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  await db.exec(probes);
  stage = 'catalog';
  const { rows: [observed] } = await db.query(`SELECT
    current_setting('server_version_num') AS server_version,
    (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS migrations,
    (SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r') AS tables,
    (SELECT count(*)::int FROM public.users) AS users,
    (SELECT count(*)::int FROM public.stories) AS stories,
    (SELECT count(*)::int FROM public.ai_daily_provider_calls) AS budget_rows,
    (SELECT count(*)::int FROM pg_class c WHERE relnamespace='public'::regnamespace AND relkind='r' AND
      (NOT relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT'))) AS unsafe_tables,
    (SELECT count(*)::int FROM pg_proc p WHERE pronamespace='public'::regnamespace AND
      (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) AS unsafe_functions,
    (SELECT public FROM storage.buckets WHERE id='story-audio') AS public_audio,
    (SELECT metadata FROM istory_staging_bootstrap.manifest) AS manifest`);
  assert.equal(observed.migrations,24);
  assert.equal(observed.tables,28);
  for (const key of ['users','stories','budget_rows','unsafe_tables','unsafe_functions']) assert.equal(observed[key],0);
  assert.equal(observed.public_audio,false);
  assert.deepEqual(observed.manifest,plan.manifest);
  if (mode === '--postgres17') assert.equal(Math.floor(Number(observed.server_version) / 10000),17);
  const evidence = { status: 'FRESH_BOOTSTRAP_REHEARSED', engine: mode.slice(2), observedAt: new Date().toISOString(),
    bootstrapSha256: plan.sha256, probesSha256: createHash('sha256').update(probes).digest('hex'),
    migrations: observed.migrations, tables: observed.tables, serverVersion: observed.server_version,
    syntheticRecordsRetained: 0, externalProviderCalls: 0, hostedSetupVerified: false, manifest: plan.manifest };
  stage = 'cleanup';
  await close();
  close = async () => {};
  record(evidence);
  console.log(JSON.stringify({ status:evidence.status,engine:evidence.engine,migrations:evidence.migrations,tables:evidence.tables,bootstrapSha256:evidence.bootstrapSha256,evidence:output,hostedSetupVerified:false }));
} catch {
  try { record({status:'FAILED',engine:mode.slice(2),observedAt:new Date().toISOString(),stage,hostedSetupVerified:false}); } catch { /* A failed receipt write cannot make the process pass. */ }
  console.error(JSON.stringify({ error:'FRESH_BOOTSTRAP_REHEARSAL_FAILED',stage }));
  process.exitCode=1;
} finally { await close(); }
