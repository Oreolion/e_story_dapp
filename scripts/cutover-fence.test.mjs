// Synthetic PostgreSQL + real PostgREST only; never accepts a hosted target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, createHmac } from 'node:crypto';

const images = Object.freeze({
  database: 'postgres@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f',
  api: 'postgrest/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf',
});
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED');
  return result.stdout.trim();
}
const source = file => readFileSync(new URL(`../ops/release/cutover/${file}.sql`, import.meta.url), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(action) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await action()) return;
    await delay(100);
  }
  throw new Error('ISOLATED_CUTOVER_CONDITION_NOT_OBSERVED');
}

test('real Data API fence, in-flight boundary, identity conflicts and recovery', {
  skip: process.env.TEST_CUTOVER_DOCKER !== '1', timeout: 90_000,
}, async () => {
  const run = randomBytes(8).toString('hex');
  const owned = [];
  const secret = randomBytes(32).toString('hex');
  const start = (name, image, args, command = []) => {
    const id = docker(['run', '-d', '--name', `istory-cutover-${run}-${name}`, '--label', `istory.cutover-run=${run}`, ...args, image, ...command]);
    assert.match(id, /^[a-f0-9]{64}$/);
    owned.push({ id, image });
    return id;
  };
  let db, inFlight;
  const sql = input => docker(['exec', '-i', db, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input);
  const claim = role => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, exp: Math.floor(Date.now() / 1000) + 180 })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  try {
    // Pulls are separate explicit CI steps; never silently choose another image.
    for (const image of Object.values(images)) docker(['image', 'inspect', image]);
    // Only API port 3000 is published, on a randomly assigned host loopback port.
    // The DB listens on the shared pod's loopback, with tmpfs data and no volume.
    db = start('db', images.database, ['--memory', '192m', '--cpus', '1', '--network', 'bridge',
      '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,noexec,size=96m',
      '-p', '127.0.0.1::3000', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust'],
      ['-c', 'listen_addresses=127.0.0.1', '-c', 'shared_buffers=16MB', '-c', 'max_connections=25']);
    await eventually(() => {
      try { docker(['exec', db, 'pg_isready', '-U', 'postgres']); return true; } catch { return false; }
    });
    sql(`CREATE ROLE authenticator LOGIN NOINHERIT;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      GRANT anon,authenticated,service_role TO authenticator;
      CREATE TABLE public.cutover_fixture(id int PRIMARY KEY, value text NOT NULL);
      ALTER TABLE public.cutover_fixture ENABLE ROW LEVEL SECURITY;
      CREATE POLICY fixture_access ON public.cutover_fixture USING(true) WITH CHECK(true);
      GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.cutover_fixture TO anon,authenticated,service_role;
      CREATE FUNCTION public.cutover_write() RETURNS void LANGUAGE sql AS
        'INSERT INTO public.cutover_fixture VALUES(99,''synthetic'')';
      CREATE FUNCTION public.cutover_read() RETURNS int LANGUAGE sql STABLE AS 'SELECT 7';
      CREATE FUNCTION public.cutover_slow_write() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
        PERFORM pg_advisory_xact_lock(59147724,2); PERFORM pg_sleep(3);
        INSERT INTO public.cutover_fixture VALUES(98,'in-flight synthetic'); END $$;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated,service_role;`);
    start('api', images.api, ['--memory', '128m', '--cpus', '1', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--network', `container:${db}`,
      '-e', 'PGRST_DB_URI=postgresql://authenticator@127.0.0.1/postgres',
      '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_DB_SCHEMAS=public',
      '-e', `PGRST_JWT_SECRET=${secret}`, '-e', 'PGRST_DB_CONFIG=true']);
    const binding = docker(['port', db, '3000/tcp']);
    assert.match(binding, /^127\.0\.0\.1:\d+$/);
    const base = `http://${binding}`;
    const request = (role = 'anon', path = '/cutover_fixture', method = 'GET', body) => fetch(base + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(5_000),
      headers: { ...(role === 'anon' ? {} : { Authorization: `Bearer ${claim(role)}` }), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await eventually(async () => { try { return (await request()).status === 200; } catch { return false; } });
    assert.equal((await request('authenticated', '/cutover_fixture', 'POST', { id: 1, value: 'synthetic' })).status, 201);
    assert.equal((await request('service_role', '/cutover_fixture?id=eq.1', 'DELETE')).status, 204);
    sql(source('install'));
    // Installation alone must not pause anything.
    assert.equal((await request()).status, 200);
    inFlight = request('service_role', '/rpc/cutover_slow_write', 'POST', {}).then(response => ({ response }), () => ({ failed: true }));
    await eventually(() => sql('SELECT count(*) FROM pg_locks WHERE locktype=\'advisory\' AND classid=59147724 AND objid=2 AND granted;') === '1');
    sql(source('pause'));
    await eventually(async () => (await request()).status === 503);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const [path, method, body] of [
        ['/cutover_fixture', 'GET'], ['/cutover_fixture', 'HEAD'],
        ['/cutover_fixture', 'POST', { id: 2, value: 'must not persist' }],
        ['/cutover_fixture?id=eq.98', 'PATCH', { value: 'must not persist' }],
        ['/cutover_fixture?id=eq.98', 'DELETE'], ['/rpc/cutover_write', 'POST', {}],
        ['/rpc/cutover_read', 'GET'],
      ]) {
        const response = await request(role, path, method, body);
        assert.equal(response.status, 503, `Fence denies ${role} ${method} ${path}`);
        // This PostgREST version supplies Retry-After: 0 for database 503s.
        // Adding our own header produced conflicting duplicate values in reality.
        assert.equal(response.headers.get('retry-after'), '0');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        if (method !== 'HEAD') assert.equal((await response.json()).code, 'ISTORY_RELEASE_PAUSED');
      }
    }
    // Crucial counterexample: a request admitted before reload still commits.
    assert.equal((await inFlight).response?.status, 204);
    assert.equal(sql('SELECT count(*) FROM public.cutover_fixture;'), '1');
    assert.equal(sql("SELECT value='in-flight synthetic' FROM public.cutover_fixture WHERE id=98;"), 't');
    sql("ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_pre_request='';");
    assert.throws(() => sql(source('pause')), /ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED/);
    assert.throws(() => sql(source('resume')), /ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED/);
    sql("ALTER ROLE authenticator IN DATABASE postgres RESET pgrst.db_pre_request;");
    // Preserve a pre-existing control; never silently replace it or reset it.
    sql("ALTER ROLE authenticator SET pgrst.db_pre_request='public.unrelated_guard';");
    assert.throws(() => sql(source('pause')), /ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED/);
    assert.throws(() => sql(source('resume')), /ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED/);
    assert.equal(sql("SELECT 'pgrst.db_pre_request=public.unrelated_guard'=ANY(rolconfig) FROM pg_roles WHERE rolname='authenticator';"), 't');
    sql("ALTER ROLE authenticator SET pgrst.db_pre_request='public.istory_cutover_guard';");
    sql(source('resume'));
    await eventually(async () => (await request()).status === 200);
    assert.equal((await request('authenticated', '/cutover_fixture', 'POST', { id: 3, value: 'resumed synthetic' })).status, 201);
    assert.equal(sql('SELECT count(*) FROM public.cutover_fixture;'), '2');
    assert.throws(() => sql(source('resume')), /ISOLATED_CUTOVER_DOCKER_OPERATION_FAILED/);
    console.log('PASS isolated PostgREST: 21 denied role/method probes, preserved writes, in-flight counterexample, conflicting-control refusal and verified resume');
  } finally {
    await inFlight;
    for (const { id, image } of owned.reverse()) {
      const actual = JSON.parse(docker(['inspect', id]))[0];
      assert.equal(actual.Id, id);
      assert.equal(actual.Config.Image, image);
      assert.equal(actual.Config.Labels['istory.cutover-run'], run);
      assert.ok(actual.Mounts.every(mount => mount.Type === 'tmpfs'), 'Never remove a container holding persistent data');
      docker(['rm', '-f', id]);
    }
    console.log('Stopped and removed only this test run\'s two owned containers; no backup, volume or production resource was used');
  }
});
