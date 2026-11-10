// Scheduler only: no database credential, customer content, inference or payment API.
// The application owns durable claims, idempotency, quotas and retries.
const ORIGIN = 'https://estories.app';
const CRON = '* * * * *';
const failure = code => new Error(code);
function flag(value) {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw failure('DISPATCH_CONFIGURATION_INVALID');
}

async function healthData(response) {
  if (response.status !== 200 || !response.body) throw failure('DISPATCH_RELEASE_NOT_READY');
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw failure('DISPATCH_RELEASE_NOT_READY');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { await reader.cancel().catch(() => {}); }
}

export async function dispatch(env, controller, options = {}) {
  if (!flag(env.DISPATCH_ENABLED)) return { status: 'held', results: [] };
  const jobs = [
    { name: 'ai', enabled: flag(env.AI_DISPATCH_ENABLED), path: '/api/internal/ai-jobs', token: env.AI_WORKER_SECRET },
    { name: 'payment_notices', enabled: flag(env.PAYMENT_DISPATCH_ENABLED), path: '/api/internal/payment-notices', token: env.PAYMENT_WORKER_SECRET },
  ].filter(job => job.enabled);
  if (!jobs.length) return { status: 'held', results: [] };
  if (!/^[a-f0-9]{40}$/.test(env.EXPECTED_COMMIT_SHA ?? '') || jobs.some(job => !/^[a-zA-Z0-9_-]{43,128}$/.test(job.token ?? '')) || (jobs.length === 2 && jobs[0].token === jobs[1].token)) throw failure('DISPATCH_CONFIGURATION_INVALID');
  const now = (options.now ?? Date.now)();
  // Do not replay delayed events against a newer release or accumulate retries.
  if (controller.cron !== CRON || !Number.isSafeInteger(controller.scheduledTime) || controller.scheduledTime > now || now - controller.scheduledTime > 30_000) return { status: 'stale', results: [] };
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  try {
    const response = await request(ORIGIN + '/api/health', { method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const health = await healthData(response);
    if (health.commitSha !== env.EXPECTED_COMMIT_SHA || health.environment !== 'production' || health.releaseMode !== 'active' || health.acceptingTraffic !== true) throw failure('DISPATCH_RELEASE_NOT_READY');
  } catch { throw failure('DISPATCH_RELEASE_NOT_READY'); }
  const results = await Promise.all(jobs.map(async job => {
    try {
      const response = await request(ORIGIN + job.path, { method: 'POST', redirect: 'manual', headers: { Authorization: 'Bearer ' + job.token }, signal: AbortSignal.timeout(50_000) });
      // Do not retain, parse or log application response bodies.
      await response.body?.cancel();
      return { consumer: job.name, outcome: response.status === 200 ? 'http_completed' : 'http_failed', status: response.status };
    } catch { return { consumer: job.name, outcome: 'network_failed', status: null }; }
  }));
  return { status: results.some(r => r.outcome !== 'http_completed') ? 'failed' : 'completed', results };
}

const worker = {
  // No HTTP trigger, public health endpoint or manual dispatch shortcut.
  fetch() { return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } }); },
  async scheduled(controller, env) {
    let report;
    try { report = await dispatch(env, controller); }
    catch { console.error(JSON.stringify({ event: 'worker_dispatch', status: 'preflight_failed' })); throw failure('DISPATCH_PREFLIGHT_FAILED'); }
    console.log(JSON.stringify({ event: 'worker_dispatch', ...report }));
    if (report.status === 'failed') throw failure('DISPATCH_OPERATION_FAILED');
  },
};
export default worker;
