import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, default as worker } from '../ops/worker-dispatch/worker.mjs';

const sha = 'a'.repeat(40);
const now = 1_800_000_000_000;
const event = { cron: '* * * * *', scheduledTime: now };
const settings = () => ({ DISPATCH_ENABLED: 'true', AI_DISPATCH_ENABLED: 'true', PAYMENT_DISPATCH_ENABLED: 'true', EXPECTED_COMMIT_SHA: sha, AI_WORKER_SECRET: 'a'.repeat(64), PAYMENT_WORKER_SECRET: 'b'.repeat(64) });
const live = changes => Response.json({ commitSha: sha, environment: 'production', releaseMode: 'active', acceptingTraffic: true, ...changes });

test('disabled dispatch and public HTTP requests perform no network work', async () => {
  const fetch = () => { throw new Error('UNEXPECTED_NETWORK'); };
  assert.deepEqual(await dispatch({}, event, { fetch, now: () => now }), { status: 'held', results: [] });
  assert.equal((await worker.fetch(new Request('https://synthetic.invalid/run', { method: 'POST' }))).status, 404);
});

test('rejects malformed flags, unbound releases, invalid/shared credentials and unexpected schedules before fetch', async () => {
  for (const change of [{ DISPATCH_ENABLED: 'TRUE' }, { AI_DISPATCH_ENABLED: 'yes' }, { EXPECTED_COMMIT_SHA: '' }, { AI_WORKER_SECRET: 'short' }, { PAYMENT_WORKER_SECRET: 'a'.repeat(64) }]) {
    await assert.rejects(dispatch({ ...settings(), ...change }, event, { fetch: () => assert.fail('network'), now: () => now }), /DISPATCH_CONFIGURATION_INVALID/);
  }
  for (const change of [{ cron: '*/5 * * * *' }, { scheduledTime: now - 31_000 }, { scheduledTime: now + 1000 }]) {
    assert.equal((await dispatch(settings(), { ...event, ...change }, { fetch: () => assert.fail('network'), now: () => now })).status, 'stale');
  }
});

test('requires a current active production release before sending either secret', async () => {
  for (const change of [{ commitSha: 'b'.repeat(40) }, { acceptingTraffic: false }, { releaseMode: 'paused' }, { environment: 'staging' }]) {
    const calls = [];
    await assert.rejects(dispatch(settings(), event, { fetch: async (url, init) => { calls.push([url, init]); return live(change); }, now: () => now }), /DISPATCH_RELEASE_NOT_READY/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].headers?.Authorization, undefined);
    assert.equal(calls[0][1].redirect, 'manual');
  }
});

test('bounds health data and refuses redirects, non-JSON or failed health responses without dispatch', async () => {
  for (const response of [new Response('x'.repeat(4097)), new Response('not-json'), new Response('', { status: 302 }), new Response('', { status: 503 })]) {
    let count = 0;
    await assert.rejects(dispatch(settings(), event, { fetch: async () => { count++; return response; }, now: () => now }), /DISPATCH_RELEASE_NOT_READY/);
    assert.equal(count, 1);
  }
});

test('uses fixed HTTPS targets, separate bearer tokens, empty bodies and bounded requests', async () => {
  const calls = [];
  const result = await dispatch(settings(), event, { fetch: async (url, init) => { calls.push([url, init]); return calls.length === 1 ? live() : Response.json({ private: 'NEVER_RETURN_THIS' }); }, now: () => now });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls.map(([url]) => url), ['https://estories.app/api/health', 'https://estories.app/api/internal/ai-jobs', 'https://estories.app/api/internal/payment-notices']);
  for (let i = 1; i < 3; i++) {
    const options = calls[i][1];
    assert.equal(options.method, 'POST');
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, 'Bearer ' + (i === 1 ? settings().AI_WORKER_SECRET : settings().PAYMENT_WORKER_SECRET));
  }
  assert.equal(JSON.stringify(result).includes('NEVER_RETURN_THIS'), false);
});

test('does not retry failed or ambiguous operations, and one endpoint failure does not starve the other', async () => {
  for (const failure of ['network', 'http']) {
    const calls = [];
    const result = await dispatch(settings(), event, { fetch: async (url) => {
      calls.push(url);
      if (url.endsWith('/health')) return live();
      if (url.endsWith('/ai-jobs')) { if (failure === 'network') throw new Error('PRIVATE_PROVIDER_DIAGNOSTIC'); return new Response('', { status: 503 }); }
      return new Response('', { status: 200 });
    }, now: () => now });
    assert.equal(calls.length, 3);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.results.map(r => r.outcome), [failure === 'network' ? 'network_failed' : 'http_failed', 'http_completed']);
    assert.equal(JSON.stringify(result).includes('PRIVATE_PROVIDER'), false);
  }
});

test('selectively enables consumers without dispatching the held consumer', async () => {
  const calls = [];
  await dispatch({ ...settings(), PAYMENT_DISPATCH_ENABLED: 'false' }, event, { fetch: async url => { calls.push(url); return url.endsWith('/health') ? live() : new Response(''); }, now: () => now });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith('/ai-jobs'));
});
