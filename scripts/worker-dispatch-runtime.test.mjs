import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Explicit isolated test-tool location; never installs or loads application env.
const toolRoot = process.env.TEST_MINIFLARE_ROOT;
if (!toolRoot || !path.isAbsolute(toolRoot)) throw new Error('PINNED_MINIFLARE_REQUIRED');
const require = createRequire(path.join(toolRoot, 'package.json'));
const { version } = require('miniflare/package.json');
if (version !== '4.20260730.0') throw new Error('PINNED_MINIFLARE_REQUIRED');
const { Miniflare, Response: WorkerResponse, Log, LogLevel } = require('miniflare');
const scriptPath = fileURLToPath(new URL('../ops/worker-dispatch/worker.mjs', import.meta.url));
const config = JSON.parse(fs.readFileSync(new URL('../ops/worker-dispatch/wrangler.jsonc', import.meta.url), 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
assert.equal(config.compatibility_date, '2026-08-06');
const sha = 'a'.repeat(40);
const bindings = { DISPATCH_ENABLED: 'true', AI_DISPATCH_ENABLED: 'true', PAYMENT_DISPATCH_ENABLED: 'true', EXPECTED_COMMIT_SHA: sha, AI_WORKER_SECRET: 'a'.repeat(64), PAYMENT_WORKER_SECRET: 'b'.repeat(64) };

test('actual Worker runtime dispatches only after release binding and cancels application response bodies', { timeout: 60_000 }, async () => {
  const calls = [];
  const runtime = new Miniflare({
    modules: true, scriptPath, compatibilityDate: config.compatibility_date, bindings,
    log: new Log(LogLevel.NONE),
    outboundService(request) {
      calls.push({ url: request.url, method: request.method, token: request.headers.get('authorization') });
      if (request.url.endsWith('/api/health')) return WorkerResponse.json({ commitSha: sha, environment: 'production', releaseMode: 'active', acceptingTraffic: true });
      return WorkerResponse.json({ private: 'SYNTHETIC_NOT_FOR_LOGS' });
    },
  });
  try {
    const service = await runtime.getWorker();
    assert.equal((await service.fetch('https://synthetic.invalid/dispatch', { method: 'POST' })).status, 404);
    assert.equal(calls.length, 0);
    const result = await service.scheduled({ scheduledTime: Date.now(), cron: '* * * * *' });
    assert.equal(result.outcome, 'ok');
    assert.equal(calls[0].url, 'https://estories.app/api/health');
    assert.deepEqual(calls.slice(1).map(c => c.url).sort(), ['https://estories.app/api/internal/ai-jobs', 'https://estories.app/api/internal/payment-notices']);
    assert.equal(calls[0].token, null);
    assert.equal(calls.find(c => c.url.endsWith('/ai-jobs')).token, 'Bearer ' + bindings.AI_WORKER_SECRET);
    assert.equal(calls.find(c => c.url.endsWith('/payment-notices')).token, 'Bearer ' + bindings.PAYMENT_WORKER_SECRET);
  } finally { await runtime.dispose(); }
});

test('actual Worker runtime never forwards credentials to an endpoint redirect', { timeout: 60_000 }, async () => {
  const calls = [];
  const runtime = new Miniflare({
    modules: true, scriptPath, compatibilityDate: config.compatibility_date, bindings,
    log: new Log(LogLevel.NONE),
    outboundService(request) {
      calls.push(request.url);
      if (request.url.endsWith('/api/health')) return WorkerResponse.json({ commitSha: sha, environment: 'production', releaseMode: 'active', acceptingTraffic: true });
      return new WorkerResponse(null, { status: 302, headers: { Location: 'https://synthetic.invalid/credential-sink' } });
    },
  });
  try {
    const service = await runtime.getWorker();
    const result = await service.scheduled({ scheduledTime: Date.now(), cron: '* * * * *' });
    assert.equal(result.outcome, 'exception');
    assert.equal(calls.length, 3);
    assert.ok(calls.every(url => new URL(url).origin === 'https://estories.app'));
  } finally { await runtime.dispose(); }
});

test('actual Worker runtime refuses stale release responses before dispatching tokens', { timeout: 60_000 }, async () => {
  let count = 0;
  const runtime = new Miniflare({
    modules: true, scriptPath, compatibilityDate: config.compatibility_date, bindings,
    log: new Log(LogLevel.NONE),
    outboundService() { count++; return WorkerResponse.json({ commitSha: 'b'.repeat(40), environment: 'production', releaseMode: 'active', acceptingTraffic: true }); },
  });
  try {
    const service = await runtime.getWorker();
    const result = await service.scheduled({ scheduledTime: Date.now(), cron: '* * * * *' });
    assert.equal(result.outcome, 'exception');
    assert.equal(count, 1);
  } finally { await runtime.dispose(); }
});
