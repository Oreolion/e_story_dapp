// Read-only hosted staging check. Runs trusted master code, never candidate code.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const productionHosts = new Set(['estories.app', 'www.estories.app', 'e-story-dapp.vercel.app', 'i-story-dapp.vercel.app']);
const fail = code => { throw new Error(code); };

function configuration(env) {
  let origin;
  try { origin = new URL(env.STAGING_ORIGIN); } catch { fail('STAGING_CONFIGURATION_INVALID'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port ||
      origin.pathname !== '/' || origin.search || origin.hash ||
      !origin.hostname.endsWith('.vercel.app') || productionHosts.has(origin.hostname) ||
      !/^[a-f0-9]{40}$/.test(env.EXPECTED_SHA ?? '') ||
      typeof env.STAGING_PROTECTION_BYPASS !== 'string' || env.STAGING_PROTECTION_BYPASS.length < 16 ||
      /\s/.test(env.STAGING_PROTECTION_BYPASS)) fail('STAGING_CONFIGURATION_INVALID');
  return { origin, sha: env.EXPECTED_SHA, secret: env.STAGING_PROTECTION_BYPASS };
}

async function request(fetcher, url, headers) {
  try {
    return await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers });
  } catch { fail('STAGING_REQUEST_FAILED'); } // A transport error can include a secret-bearing request.
}

function anonymousDenied(response) {
  if ([401, 403].includes(response.status)) return true;
  if (![302, 303, 307, 308].includes(response.status)) return false;
  try {
    const destination = new URL(response.headers.get('location'));
    return destination.origin === 'https://vercel.com' && destination.pathname === '/sso-api';
  } catch { return false; }
}

async function readHealth(response) {
  const reader = response.body?.getReader();
  if (!reader) fail('STAGING_HEALTH_INVALID_JSON');
  const parts = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) fail('STAGING_HEALTH_TOO_LARGE');
      parts.push(value);
    }
  } catch (error) {
    if (error.message === 'STAGING_HEALTH_TOO_LARGE') throw error;
    fail('STAGING_HEALTH_READ_FAILED');
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { fail('STAGING_HEALTH_INVALID_JSON'); }
}

export async function verifyStaging(env, fetcher = fetch) {
  const { origin, sha, secret } = configuration(env);
  const url = new URL(`/api/health?candidate=${sha}`, origin);
  const headers = { 'Cache-Control': 'no-cache', Accept: 'application/json' };
  const anonymous = await request(fetcher, url, headers);
  await anonymous.body?.cancel();
  if (!anonymousDenied(anonymous)) fail('STAGING_ANONYMOUS_DENIAL_UNVERIFIED');
  const response = await request(fetcher, url, { ...headers, 'x-vercel-protection-bypass': secret });
  if (response.status !== 200) {
    await response.body?.cancel();
    fail('STAGING_HEALTH_UNAVAILABLE');
  }
  const robots = (response.headers.get('x-robots-tag') ?? '').toLowerCase().split(',').map(value => value.trim());
  if (!['noindex', 'nofollow', 'noarchive'].every(value => robots.includes(value)) ||
      ['index', 'follow', 'all'].some(value => robots.includes(value)) ||
      !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') ?? '') ||
      !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel();
    fail('STAGING_HTTP_ISOLATION_MISMATCH');
  }
  const data = await readHealth(response);
  if (!data || data.status !== 'ok' || data.service !== 'estories-web' || data.commitSha !== sha ||
      data.environment !== 'staging' || data.releaseMode !== 'active' || data.frontdoorMode !== 'open' || data.acceptingTraffic !== true) fail('STAGING_IDENTITY_OR_ADMISSION_MISMATCH');
  // Only allowlisted metadata enters the receipt; never response bodies or headers.
  return { observedAt: new Date().toISOString(), origin: origin.origin, expectedCommit: sha,
    observedCommit: data.commitSha, environment: data.environment, anonymousStatus: anonymous.status,
    releaseMode: data.releaseMode, acceptingTraffic: data.acceptingTraffic, robots: 'noindex, nofollow, noarchive' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const evidence = await verifyStaging(process.env);
    fs.writeFileSync('staging-binding.json', JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log('Active exact staging commit and anonymous denial verified; authenticated app acceptance remains a separate gate.');
  } catch (error) {
    const safe = /^STAGING_[A-Z_]+$/.test(error.message) ? error.message : 'STAGING_VERIFICATION_FAILED';
    console.error(safe);
    process.exitCode = 1;
  }
}
