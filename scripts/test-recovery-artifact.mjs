// Exercise the same compiled Next build in active, paused and invalid modes.
// CI only, synthetic environment, loopback only; no deployment or live data.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const fail = code => Object.assign(new Error(code), { recoveryCode: code });
const methods = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function recoveryEnvironment(parent, sha, mode) {
  if (!['1', 'true'].includes(parent.CI) || parent.APP_ENV !== 'ci' || parent.VERCEL || !/^[a-f0-9]{40}$/.test(sha ?? '') || !['active', 'paused', 'invalid-synthetic-setting'].includes(mode)) throw fail('RECOVERY_CI_CONTEXT_REQUIRED');
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'].filter(k => parent[k]).map(k => [k, parent[k]]));
  return { ...env, CI: 'true', NODE_ENV: 'production', APP_ENV: 'ci', APP_RELEASE_MODE: mode,
    NEXT_TELEMETRY_DISABLED: '1', VERCEL_GIT_COMMIT_SHA: sha,
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3002', NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key', NEXT_PUBLIC_PROJECT_ID: 'placeholder-walletconnect-id',
    NEXT_PUBLIC_IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
  };
}

export function inventoryRoutes(apiRoot) {
  const routes = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw fail('RECOVERY_SOURCE_SYMLINK');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'route.ts') {
        const source = ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, false);
        const exported = new Set();
        for (const node of source.statements) {
          const isExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (isExport && ts.isFunctionDeclaration(node) && node.name && methods.has(node.name.text)) exported.add(node.name.text);
          if (isExport && ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name) && methods.has(d.name.text)) exported.add(d.name.text);
          if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) for (const e of node.exportClause.elements) if (methods.has(e.name.text)) exported.add(e.name.text);
        }
        if (!exported.size) throw fail('RECOVERY_ROUTE_EXPORTS_UNKNOWN');
        const relative = path.relative(apiRoot, path.dirname(full)).split(path.sep).join('/');
        if (/\[\.\.\.|\(.*\)/.test(relative)) throw fail('RECOVERY_ROUTE_SHAPE_UNKNOWN');
        routes.push({ key: '/api' + (relative ? '/' + relative : '') + '/route',
          path: '/api' + (relative ? '/' + relative.replace(/\[[^/\]]+\]/g, '11111111-1111-4111-8111-111111111111') : ''),
          methods: [...new Set([...exported, 'HEAD', 'OPTIONS'])].sort() });
      }
    }
  }
  walk(apiRoot);
  if (!routes.length || routes.length > 100 || routes.reduce((n, r) => n + r.methods.length, 0) > 500) throw fail('RECOVERY_ROUTE_INVENTORY_LIMIT');
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

export async function buildIdentity(buildRoot = root) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw fail('RECOVERY_BUILD_SYMLINK');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  walk(path.join(buildRoot, '.next', 'server')); walk(path.join(buildRoot, '.next', 'static'));
  for (const name of ['BUILD_ID', 'build-manifest.json', 'app-build-manifest.json', 'required-server-files.json', 'routes-manifest.json', 'prerender-manifest.json']) files.push(path.join(buildRoot, '.next', name));
  if (files.length > 20000) throw fail('RECOVERY_BUILD_SIZE_LIMIT');
  const hash = createHash('sha256'), cacheHash = createHash('sha256');
  const entries = []; let bytes = 0, totalBytes = 0, cacheBytes = 0, cacheFiles = 0;
  for (const file of files.sort()) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024 ** 2 || (totalBytes += stat.size) > 1024 ** 3) throw fail('RECOVERY_BUILD_SIZE_LIMIT');
    const relative = path.relative(buildRoot, file).split(path.sep).join('/');
    // Next 15.5.28 promotes immutable page seeds into this dedicated mutable
    // response-cache namespace. Keep the seeds, code and static assets immutable;
    // inventory/cache-hash these known response files separately, never executables.
    const cached = relative.startsWith('.next/server/route-cache/');
    if (cached && !/^\.next\/server\/route-cache\/(APP_PAGE|APP_ROUTE|PAGES)\/[a-f0-9]{64}\/\$\/.+\.(html|meta|rsc|body|json)$/.test(relative)) throw fail('RECOVERY_RUNTIME_CACHE_FILE_UNEXPECTED');
    const target = cached ? cacheHash : hash;
    target.update(JSON.stringify([relative, stat.size]) + '\n');
    const fileHash = createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) { target.update(chunk); fileHash.update(chunk); }
    if (cached) { cacheFiles++; cacheBytes += stat.size; }
    else { bytes += stat.size; entries.push({ path: relative, bytes: stat.size, sha256: fileHash.digest('hex') }); }
  }
  return { sha256: hash.digest('hex'), files: entries.length, bytes, entries,
    runtimeCache: { sha256: cacheHash.digest('hex'), files: cacheFiles, bytes: cacheBytes } };
}

export function changedBuildFiles(before, after) {
  const previous = new Map(before.entries.map(file => [file.path, file]));
  const current = new Map(after.entries.map(file => [file.path, file]));
  return [...new Set([...previous.keys(), ...current.keys()])].sort().filter(name => {
    const a = previous.get(name), b = current.get(name);
    return !a || !b || a.sha256 !== b.sha256 || a.bytes !== b.bytes;
  }).map(name => ({ path: name, change: !previous.has(name) ? 'added' : !current.has(name) ? 'removed' : 'modified',
    before: previous.get(name) ?? null, after: current.get(name) ?? null }));
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
async function stopServer(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await closed; } finally { clearTimeout(timer); }
}
async function probe(origin, route, method = 'GET', headers = {}) {
  return fetch(origin + route, { method, headers, redirect: 'error', signal: AbortSignal.timeout(5000) });
}

async function rehearse(mode, sha, routes) {
  const port = await availablePort();
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env: recoveryEnvironment(process.env, sha, mode), stdio: 'ignore', windowsHide: true,
  });
  let spawnError; child.on('error', error => { spawnError = error; });
  const expectedMode = mode === 'invalid-synthetic-setting' ? 'invalid' : mode;
  let probes = 0;
  try {
    let live;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null || child.signalCode !== null) throw fail('RECOVERY_SERVER_START_FAILED');
      try { const response = await probe(origin, '/api/health'); if (response.ok) { live = await response.json(); break; } } catch { /* bounded startup only */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!live) throw fail('RECOVERY_LIVENESS_UNAVAILABLE');
    if (live.commitSha !== sha || live.environment !== 'ci' || live.releaseMode !== expectedMode || live.acceptingTraffic !== (mode === 'active')) throw fail('RECOVERY_ARTIFACT_BINDING_FAILED');
    const ready = await probe(origin, '/api/ready');
    if (ready.status !== (mode === 'active' ? 200 : 503) || (await ready.json()).acceptingTraffic !== (mode === 'active')) throw fail('RECOVERY_READINESS_FAILED');
    if (mode === 'active') {
      if ((await probe(origin, '/api/release/access')).status !== 404) throw fail('OPERATOR_ENTRY_EXPOSED_BY_DEFAULT');
      return { mode: expectedMode, probes: 3 };
    }
    for (const route of routes) for (const method of route.methods) {
      if (['/api/health', '/api/ready'].includes(route.path) && ['GET', 'HEAD'].includes(method)) continue;
      const response = await probe(origin, route.path, method); probes++;
      if (response.status !== 503 || response.headers.get('cache-control') !== 'no-store' || response.headers.get('retry-after') !== '60') throw fail('RECOVERY_API_NOT_PAUSED');
      if (method !== 'HEAD' && (await response.json()).code !== 'SERVICE_PAUSED') throw fail('RECOVERY_API_NOT_PAUSED');
      else await response.arrayBuffer().catch(() => {});
    }
    for (const route of ['/', '/profile', '/record', '/library', '/profile?_rsc=synthetic', '/_next/image?url=https%3A%2F%2Fsynthetic.invalid%2Fimage.png&w=64&q=75']) {
      const response = await probe(origin, route); probes++;
      if (response.status !== 503 || !(await response.text()).includes('Please try again shortly')) throw fail('RECOVERY_PAGE_NOT_PAUSED');
    }
    for (const [route, method] of [['/api/stories/synthetic.png', 'DELETE'], ['/api/payment/webhook', 'POST']]) {
      const response = await probe(origin, route, method, { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }); probes++;
      if (response.status !== 503 || (await response.json()).code !== 'SERVICE_PAUSED') throw fail('RECOVERY_BYPASS_NOT_BLOCKED');
    }
    return { mode: expectedMode, probes: probes + 2 };
  } finally { await stopServer(child); }
}

async function rehearseOperator(sha, routes) {
  // NextRequest canonicalizes loopback IPs to localhost. Use that same origin
  // for the form and Origin header; do not weaken the application's CSRF check.
  const port = await availablePort(), origin = 'http://localhost:' + port;
  const code = randomBytes(32).toString('base64url'); // Synthetic, memory-only; never printed.
  const env = { ...recoveryEnvironment(process.env, sha, 'active'), NEXT_PUBLIC_APP_URL: origin,
    APP_FRONTDOOR_MODE: 'operator', RELEASE_COHORT_SECRET: code, RELEASE_COHORT_ID: '11111111-1111-4111-8111-111111111111',
    VERCEL_DEPLOYMENT_ID: 'dpl_syntheticCIOperatorArtifact', AI_PROVIDER_MODE: 'disabled', PAYMENT_PROVIDER_MODE: 'disabled',
    AI_WORKER_ENABLED: 'false', PAYMENT_NOTICE_WORKER_ENABLED: 'false' };
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env, stdio: 'ignore', windowsHide: true });
  let spawnError; child.on('error', error => { spawnError = error; });
  const entry = '/api/release/access'; let probes = 0;
  try {
    let live; const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null || child.signalCode !== null) throw fail('OPERATOR_SERVER_START_FAILED');
      try { const response = await probe(origin, '/api/health'); if (response.ok) { live = await response.json(); break; } } catch { /* bounded startup only */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (live?.commitSha !== sha || live.frontdoorMode !== 'operator' || live.acceptingTraffic !== false) throw fail('OPERATOR_ARTIFACT_BINDING_FAILED');
    if ((await probe(origin, '/api/ready')).status !== 503) throw fail('OPERATOR_PUBLIC_READINESS_FAILED');
    probes += 2;
    for (const route of routes) for (const method of route.methods) {
      if (['/api/health', '/api/ready'].includes(route.path) && ['GET', 'HEAD'].includes(method) || route.path === entry && ['GET', 'HEAD', 'POST'].includes(method)) continue;
      const response = await probe(origin, route.path, method); probes++;
      if (response.status !== 503 || response.headers.get('cache-control') !== 'no-store') throw fail('OPERATOR_API_EXPOSED');
      if (method !== 'HEAD' && (await response.json()).code !== 'SERVICE_PAUSED') throw fail('OPERATOR_API_EXPOSED');
    }
    for (const route of ['/', '/profile', '/api/auth/callback?code=synthetic', '/_next/image?url=synthetic', '/api/stories/synthetic.png']) {
      const response = await probe(origin, route, 'GET', { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }); probes++;
      if (response.status !== 503) throw fail('OPERATOR_MIDDLEWARE_BYPASS');
    }
    const form = await probe(origin, entry); probes++;
    if (form.status !== 200 || !(await form.text()).includes('type="password"')) throw fail('OPERATOR_FORM_UNAVAILABLE');
    const admitted = await fetch(origin + entry, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + code }); probes++;
    const cookie = admitted.headers.get('set-cookie')?.split(';')[0];
    if (admitted.status !== 303) throw fail('OPERATOR_ENTRY_STATUS_' + admitted.status);
    const target = new URL(admitted.headers.get('location') ?? '/invalid', origin);
    if (target.origin !== origin || target.pathname !== '/' || target.search || target.hash || target.username || target.password) throw fail('OPERATOR_ENTRY_REDIRECT_INVALID');
    if (!cookie?.startsWith('__Host-istory_operator=')) throw fail('OPERATOR_ENTRY_PROOF_MISSING');
    const account = await probe(origin, '/api/user/profile', 'GET', { Cookie: cookie }); probes++;
    if (account.status !== 401 || !account.headers.get('cache-control')?.includes('no-store')) throw fail('OPERATOR_ACCOUNT_AUTH_BYPASSED');
    const publicPage = await probe(origin, '/terms', 'GET', { Cookie: cookie }); probes++;
    if (publicPage.status !== 200 || !publicPage.headers.get('cache-control')?.includes('no-store') || !publicPage.headers.get('x-robots-tag')?.includes('noindex')) throw fail('OPERATOR_PAGE_CACHE_EXPOSED');
    const forged = await probe(origin, '/api/user/profile', 'GET', { Cookie: cookie + 'x' }); probes++;
    if (forged.status !== 503) throw fail('OPERATOR_FORGED_COOKIE_ACCEPTED');
    const stillHeld = await probe(origin, '/api/user/profile'); probes++;
    if (stillHeld.status !== 503) throw fail('OPERATOR_ACCESS_BECAME_GLOBAL');
    return { mode: 'operator', probes, limits: ['Synthetic loopback HTTP only; hosted OAuth, operator browser behavior and database fencing require separate acceptance.'] };
  } finally { await stopServer(child); }
}

async function rehearseCallbackAdmission(sha) {
  const port=await availablePort(), origin='http://127.0.0.1:'+port;
  const env={...recoveryEnvironment(process.env,sha,'paused'),PAYMENT_CALLBACK_MODE:'retain',
    DATA_API_RELEASE_EPOCH:'00000000-0000-4000-8000-000000000001',DATA_API_RELEASE_KEY:randomBytes(32).toString('hex'),
    BLOCKRADAR_WEBHOOK_SECRET:randomBytes(32).toString('hex')};
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:'ignore',windowsHide:true});
  let spawnError; child.on('error',error=>{spawnError=error;});
  try {
    let live; const deadline=Date.now()+45000;
    while(Date.now()<deadline){
      if(spawnError||child.exitCode!==null||child.signalCode!==null) throw fail('CALLBACK_SERVER_START_FAILED');
      try{const response=await probe(origin,'/api/health');if(response.ok){live=await response.json();break;}}catch{/* bounded startup */}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(live?.commitSha!==sha||live.releaseMode!=='paused'||live.acceptingTraffic!==false) throw fail('CALLBACK_ARTIFACT_BINDING_FAILED');
    const checks=[
      ['/api/ready','GET',503,{}],['/api/payment/webhook','POST',401,{}],
      ['/api/payment/webhook','GET',503,{}],['/api/payment/webhook','OPTIONS',503,{}],
      ['/api/payment/verify','POST',503,{}],['/api/internal/payment-notices','POST',503,{}],
      ['/api/user/profile','GET',503,{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}],
      ['/api/payment/webhook','POST',401,{'x-blockradar-signature':'invalid'}],
    ];
    for(const [route,method,status,headers] of checks) if((await probe(origin,route,method,headers)).status!==status) throw fail('CALLBACK_ADMISSION_BOUNDARY_FAILED');
    return {mode:'callback-retention',probes:checks.length+1,limits:['Only compiled ingress/continued hold is tested here; no signed receipt or database request is sent. Durable storage and replay need their separate database/provider evidence.']};
  } finally {await stopServer(child);}
}

async function main() {
  if (process.argv.length !== 2) throw fail('RECOVERY_INVALID_ARGUMENTS');
  const sha = process.env.GITHUB_SHA;
  recoveryEnvironment(process.env, sha, 'paused');
  // Inspect names only. Do not load a developer's env files into this server.
  if (fs.readdirSync(root).some(n => n.startsWith('.env') && n !== '.env.example')) throw fail('RECOVERY_ENV_FILES_PRESENT');
  const routes = inventoryRoutes(path.join(root, 'app/api'));
  const compiled = JSON.parse(fs.readFileSync(path.join(root, '.next/server/app-paths-manifest.json'), 'utf8'));
  if (routes.some(route => !Object.hasOwn(compiled, route.key))) throw fail('RECOVERY_COMPILED_ROUTES_MISSING');
  const before = await buildIdentity();
  const results = [];
  for (const mode of ['paused', 'invalid-synthetic-setting', 'active']) results.push(await rehearse(mode, sha, routes));
  results.push(await rehearseOperator(sha, routes));
  results.push(await rehearseCallbackAdmission(sha));
  const after = await buildIdentity();
  const { entries: beforeEntries, ...build } = before;
  if (before.sha256 !== after.sha256) {
    const { entries: afterEntries, ...observed } = after;
    const destination = path.join(root, 'output/release'); fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'recovery-build-failure.json'), JSON.stringify({
      status: 'RECOVERY_BUILD_CHANGED', identityVersion: 2, sourceCommit: sha, before: build, after: observed,
      changes: changedBuildFiles({ entries: beforeEntries }, { entries: afterEntries }), completedRehearsals: results,
      limits: ['Synthetic compiled-file names, sizes and hashes only; no file content or environment values. The immutable-build gate remains failed.'],
    }, null, 2) + '\n');
    throw fail('RECOVERY_BUILD_CHANGED');
  }
  const report = { status: 'CI_RECOVERY_BUILD_VERIFIED', identityVersion: 2, sourceCommit: sha, build, observedRuntimeCache: after.runtimeCache, apiRoutes: routes.length, results,
    limits: ['CI synthetic build only; not a retained or verified Vercel production recovery deployment.', 'Old deployment URLs, direct SDK traffic, existing handlers and external callback retention require separate provider/database controls.'] };
  const destination = path.join(root, 'output/release'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'recovery-build.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error?.recoveryCode ?? 'RECOVERY_ARTIFACT_FAILED'); process.exitCode = 1; });
