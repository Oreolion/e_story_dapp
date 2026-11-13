import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// Follow the actual wallet consumer, including nested/hoisted installations.
// All requests below dispatch in memory; no server or provider is contacted.
const require = createRequire(import.meta.url);
const connectors = createRequire(require.resolve('@wagmi/connectors'));
const porto = createRequire(connectors.resolve('porto/server'));
const manifestPath = path.resolve(path.dirname(porto.resolve('hono')), '..', '..', 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.name, 'hono');
const load = name => import(pathToFileURL(path.resolve(path.dirname(manifestPath), manifest.exports[name].import)).href);
const { Hono } = await load('.');
const { csrf } = await load('./csrf');
const { validator } = await load('./validator');
const { css, Style } = await load('./css');
const { jsx } = await load('./jsx');
const deny = c => c.text('Unauthorized', 401);

test('mounted tenant routing cannot turn an unprotected path into a protected child route', async () => {
  const app = new Hono();
  const child = new Hono();
  app.use('/api/:tenant/admin/*', (c, next) => c.req.header('x-fixture-owner') === 'yes' ? next() : deny(c));
  child.get('/admin/secret', c => c.text('private fixture'));
  app.mount('/api/:tenant', child.fetch);
  assert.equal((await app.request('/api/a/admin/secret')).status, 401);
  assert.equal((await app.request('/api/a/xxxxx/admin/secret')).status, 404);
  const allowed = await app.request('/api/a/admin/secret', { headers: { 'x-fixture-owner': 'yes' } });
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), 'private fixture');
});

test('mounted paths do not normalize encoded backslashes into a protected child route', async () => {
  const app = new Hono();
  const child = new Hono();
  app.use('/app/admin/*', deny);
  child.get('/admin/secret', c => c.text('private fixture'));
  app.mount('/app', child.fetch);
  assert.equal((await app.request('/app/admin/secret')).status, 401);
  assert.equal((await app.request('/app/public%5C..%5Cadmin/secret')).status, 404);
});

test('wildcard guards cover parameter patterns, prefix routes and encoded line terminators', async t => {
  await t.test('explicit parameter pattern', async () => {
    const app = new Hono();
    app.use('/api/:tenant{[^/]+}/admin/*', deny);
    app.get('/api/:tenant/admin/:id', c => c.text('private fixture'));
    assert.equal((await app.request('/api/team/admin/one')).status, 401);
  });
  await t.test('prefix route', async () => {
    const app = new Hono();
    app.use('/admin/*', deny);
    app.get('/admin*', c => c.text('private fixture'));
    assert.equal((await app.request('/admin/one')).status, 401);
  });
  await t.test('encoded line terminators cannot reach an unguarded fallback', async () => {
    const app = new Hono();
    app.use('*', deny);
    app.get('/known', c => c.text('private fixture'));
    for (const value of ['%0A', '%0D', '%E2%80%A8', '%E2%80%A9']) {
      assert.equal((await app.request(`/unknown${value}path`)).status, 401);
    }
  });
});

test('cross-site text/ping is rejected before a state-changing handler runs', async () => {
  const app = new Hono();
  let changes = 0;
  app.use('*', csrf());
  app.post('/toggle', c => { changes++; return c.text('changed'); });
  const request = origin => app.request('https://fixture.invalid/toggle', {
    method: 'POST', body: 'PING',
    headers: { Origin: origin, 'Sec-Fetch-Site': origin === 'https://fixture.invalid' ? 'same-origin' : 'cross-site', 'Content-Type': 'text/ping' },
  });
  assert.equal((await request('https://untrusted.invalid')).status, 403);
  assert.equal(changes, 0);
  assert.equal((await request('https://fixture.invalid')).status, 200);
  assert.equal(changes, 1);
});

test('multipart parameters cannot hide fields from form validation', async () => {
  const app = new Hono();
  app.post('/form', validator('form', (value, c) => value.role === 'admin' ? c.text('Forbidden', 403) : value),
    c => c.json(c.req.valid('form')));
  const submit = role => app.request('/form', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=fixture-boundary; charset=utf-8' },
    body: `--fixture-boundary\r\nContent-Disposition: form-data; name="role"\r\n\r\n${role}\r\n--fixture-boundary--\r\n`,
  });
  assert.equal((await submit('admin')).status, 403);
  const allowed = await submit('user');
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { role: 'user' });
});

test('CSS interpolation cannot assemble an HTML style breakout across template boundaries', async () => {
  const attack = '/style><script data-hono-probe>synthetic()</script>';
  const classes = [css`content:"<${attack}";`, css`content:"${'<'}${attack}";`];
  for (const className of classes) {
    const app = new Hono();
    app.get('/', c => c.html(jsx('html', {},
      jsx('head', {}, jsx(Style, {})),
      jsx('body', {}, jsx('span', { class: className }, 'fixture')),
    )));
    const rendered = await (await app.request('/')).text();
    assert.ok(rendered.includes('data-hono-probe'), 'exercise the actual interpolated CSS, not an omitted stylesheet');
    assert.ok(!rendered.includes('</style><script data-hono-probe>'));
  }
});

test('Porto retains nested routing through its real ESM router API', { timeout: 60000 }, async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('External fetch is forbidden in this fixture'); });
  const { Router, Route } = await import(pathToFileURL(connectors.resolve('porto/server')).href);
  const router = Router();
  const child = Route.from();
  child.hono.get('/ping', c => c.text('pong'));
  router.route('/child', child);
  const response = await router.fetch(new Request('https://fixture.invalid/child/ping'));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'pong');
});
