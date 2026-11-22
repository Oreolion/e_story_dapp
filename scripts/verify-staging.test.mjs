import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStaging } from './verify-staging.mjs';

const sha = 'a'.repeat(40);
const secret = 'synthetic-project-specific-bypass';
const env = { EXPECTED_SHA: sha, STAGING_ORIGIN: 'https://estories-staging.vercel.app', STAGING_PROTECTION_BYPASS: secret };
const health = { status: 'ok', service: 'estories-web', commitSha: sha, environment: 'staging', releaseMode: 'active', frontdoorMode: 'open', acceptingTraffic: true };
const response = (body = health, headers = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow, noarchive', 'cache-control': 'no-store', ...headers },
});
function transport(probe = new Response('', { status: 401 }), allowed = response()) {
  const requests = [];
  return { requests, fetch: async (url, options) => { requests.push({ url: String(url), ...options }); return requests.length === 1 ? probe : allowed; } };
}

test('binds active staging source and verifies anonymous denial before using the scoped header', async () => {
  const mock = transport();
  const evidence = await verifyStaging(env, mock.fetch);
  assert.equal(evidence.observedCommit, sha);
  assert.equal(evidence.anonymousStatus, 401);
  assert.equal(evidence.environment, 'staging');
  assert.equal(mock.requests.length, 2);
  assert.equal(mock.requests[0].headers['x-vercel-protection-bypass'], undefined);
  assert.equal(mock.requests[1].headers['x-vercel-protection-bypass'], secret);
  for (const request of mock.requests) {
    assert.equal(request.redirect, 'manual');
    assert.equal(new URL(request.url).pathname, '/api/health');
    assert.ok(!request.url.includes(secret));
    assert.ok(request.signal instanceof AbortSignal);
  }
  assert.ok(!JSON.stringify(evidence).includes(secret));
});

test('rejects unsafe destinations and missing binding before any request', async () => {
  for (const patch of [
    { STAGING_ORIGIN: 'https://estories.app' }, { STAGING_ORIGIN: 'https://test.estories.app' },
    { STAGING_ORIGIN: 'https://e-story-dapp.vercel.app' }, { STAGING_ORIGIN: 'https://i-story-dapp.vercel.app' },
    { STAGING_ORIGIN: 'https://localhost' }, { STAGING_ORIGIN: 'https://127.0.0.1' },
    { STAGING_ORIGIN: 'https://evil-vercel.app' }, { STAGING_ORIGIN: 'http://estories-staging.vercel.app' },
    { STAGING_ORIGIN: 'https://user:pass@estories-staging.vercel.app' },
    { STAGING_ORIGIN: 'https://estories-staging.vercel.app/path' },
    { STAGING_ORIGIN: 'https://estories-staging.vercel.app/?token=value' },
    { STAGING_ORIGIN: 'https://estories-staging.vercel.app/#fragment' },
    { STAGING_ORIGIN: 'https://estories-staging.vercel.app:444' },
    { STAGING_ORIGIN: '' }, { EXPECTED_SHA: 'main' }, { EXPECTED_SHA: 'A'.repeat(40) },
    { STAGING_PROTECTION_BYPASS: '' }, { STAGING_PROTECTION_BYPASS: 'short' },
    { STAGING_PROTECTION_BYPASS: 'contains whitespace which is invalid' },
  ]) {
    let called = false;
    await assert.rejects(verifyStaging({ ...env, ...patch }, async () => { called = true; }), /STAGING_CONFIGURATION_INVALID/);
    assert.equal(called, false);
  }
});

test('refuses public staging, arbitrary redirects and an unsuccessful authenticated probe', async () => {
  for (const probe of [response(), new Response('', { status: 307, headers: { location: 'https://example.com/sso-api' } }), new Response('', { status: 500 })]) {
    const mock = transport(probe);
    await assert.rejects(verifyStaging(env, mock.fetch), /STAGING_ANONYMOUS_DENIAL_UNVERIFIED/);
    assert.equal(mock.requests.length, 1, 'the credential is never sent after a bad anonymous probe');
  }
  const mock = transport(new Response('', { status: 307, headers: { location: 'https://vercel.com/sso-api?url=synthetic' } }));
  assert.equal((await verifyStaging(env, mock.fetch)).anonymousStatus, 307);
  for (const status of [302, 401, 403, 503]) {
    await assert.rejects(verifyStaging(env, transport(undefined, new Response('', { status })).fetch), /STAGING_HEALTH_UNAVAILABLE/);
  }
});

test('requires active traffic, exact source, service, staging and no indexing or caching', async () => {
  for (const patch of [{ commitSha: 'b'.repeat(40) }, { environment: 'production' }, { service: 'other' }, { status: 'error' }, { releaseMode: 'paused' }, { frontdoorMode: 'hold' }, { acceptingTraffic: false }]) {
    await assert.rejects(verifyStaging(env, transport(undefined, response({ ...health, ...patch })).fetch), /STAGING_IDENTITY_OR_ADMISSION_MISMATCH/);
  }
  for (const headers of [{ 'x-robots-tag': 'noindex' }, { 'x-robots-tag': 'noindex, nofollow, noarchive, index' }, { 'cache-control': 'public, max-age=60' }, { 'cache-control': 'not-no-store' }, { 'cache-control': 'no-store-extra' }, { 'content-type': 'text/html' }]) {
    await assert.rejects(verifyStaging(env, transport(undefined, response(health, headers)).fetch), /STAGING_HTTP_ISOLATION_MISMATCH/);
  }
});

test('discards response details and transport exceptions, and bounds response size', async () => {
  const rejected = transport(undefined, new Response(secret, { headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex,nofollow,noarchive', 'cache-control': 'no-store' } }));
  await assert.rejects(verifyStaging(env, rejected.fetch), error => error.message === 'STAGING_HEALTH_INVALID_JSON');
  await assert.rejects(verifyStaging(env, async () => { throw new Error(secret); }), error => error.message === 'STAGING_REQUEST_FAILED');
  await assert.rejects(verifyStaging(env, transport(undefined, response({ ...health, excess: 'x'.repeat(20000) })).fetch), /STAGING_HEALTH_TOO_LARGE/);
  const reflected = await verifyStaging(env, transport(undefined, response({ ...health, untrusted: secret }, { 'x-robots-tag': `noindex,nofollow,noarchive,${secret}` })).fetch);
  assert.ok(!JSON.stringify(reflected).includes(secret), 'discard untrusted body and header additions');
  const broken = new Response(new ReadableStream({ start(controller) { controller.error(new Error(secret)); } }), {
    headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex,nofollow,noarchive', 'cache-control': 'no-store' },
  });
  await assert.rejects(verifyStaging(env, transport(undefined, broken).fetch), error => error.message === 'STAGING_HEALTH_READ_FAILED');
});
