// Local verification with synthetic configuration. This does not deploy or install dependencies.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? '--tests';
if (process.argv.length > 3 || !['--tests', '--evaluations', '--types', '--compat', '--build', '--lint', '--cli', '--mobile', '--mobile-types', '--auth', '--profile'].includes(mode)) {
  throw new Error('Usage: node scripts/verify-isolated.mjs [--tests|--evaluations|--types|--compat|--build|--lint|--cli|--mobile|--mobile-types|--auth|--profile]');
}
const repository = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const dependencies = path.join(repository, 'node_modules');
if (!fs.existsSync(dependencies)) throw new Error('Install locked dependencies separately before verification.');
const mobileDependencies = path.join(repository, 'mobile', 'node_modules');
if (mode.startsWith('--mobile') && !fs.existsSync(mobileDependencies)) throw new Error('Install locked mobile dependencies separately before verification.');
const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'istory-verify-')));
console.log(`Isolated verification directory: ${directory}`);
const source = path.join(directory, 'source');
fs.mkdirSync(source);

const excluded = new Set(['node_modules', '.git', '.next', '.expo', '.gradle', '.eas', '.temp', 'pods', 'output', 'out', 'dist', 'build', 'coverage', '.cache', '.turbo', '.vercel', 'playwright-report', 'test-results']);
const files = [];
function copy(relative) {
  const name = path.basename(relative).toLowerCase();
  if (excluded.has(name) || /^\.?env|^credentials|^secrets/.test(name) || /\.(pem|key|p12|pfx|jks|keystore|mobileprovision|secret|tsbuildinfo)$/.test(name)) return;
  if (['mobile/android', 'mobile/ios'].includes(relative.split(path.sep).join('/'))) return;
  const original = path.join(repository, relative);
  if (!fs.existsSync(original)) return;
  const stat = fs.lstatSync(original);
  // Never follow source links into unlisted directories or credential stores.
  if (stat.isSymbolicLink()) return;
  const target = path.join(source, relative);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(original).sort()) copy(path.join(relative, entry));
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(original, target);
    files.push({ path: relative.split(path.sep).join('/'), sha256: createHash('sha256').update(fs.readFileSync(target)).digest('hex') });
  }
}
for (const name of ['app', 'components', 'contexts', 'types', 'lib', 'public', 'styles', 'evals', '__tests__', 'e2e', 'supabase', 'scripts', 'security', '.github/workflows']) copy(name);
for (const name of [
  'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.mjs',
  'postcss.config.mjs', 'eslint.config.mjs', 'vitest.config.ts', 'playwright.config.ts',
  'middleware.ts', 'instrumentation.ts', 'instrumentation-client.ts', 'sentry.edge.config.ts',
  'sentry.server.config.ts', 'components.json', 'tailwind.config.ts', 'tailwind.config.js',
]) copy(name);
if (mode.startsWith('--mobile')) copy('mobile');
files.sort((a, b) => a.path.localeCompare(b.path));
const sourceSha256 = createHash('sha256').update(JSON.stringify(files)).digest('hex');
fs.writeFileSync(path.join(directory, 'source-manifest.json'), JSON.stringify({
  capturedAt: new Date().toISOString(), repository, sourceSha256, files,
  dependencies: fs.realpathSync.native(dependencies), node: process.version, executable: process.execPath,
  ...(mode.startsWith('--mobile') ? { mobileDependencies: fs.realpathSync.native(mobileDependencies) } : {}),
}, null, 2));
fs.symlinkSync(fs.realpathSync.native(dependencies), path.join(source, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
if (mode.startsWith('--mobile')) fs.symlinkSync(fs.realpathSync.native(mobileDependencies), path.join(source, 'mobile', 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

// Copy OS plumbing only. In particular, do not inherit provider tokens, NODE_OPTIONS or tracing keys.
const environment = {};
for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME']) {
  if (process.env[name]) environment[name] = process.env[name];
}
Object.assign(environment, {
  EVAL_SOURCE_SNAPSHOT_SHA256: sourceSha256,
  CI: '1', APP_ENV: 'ci', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--max-old-space-size=4096',
  NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-placeholder',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-placeholder',
  NEXT_PUBLIC_PROJECT_ID: 'synthetic-placeholder', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3001',
  PINATA_JWT: 'synthetic-provider-placeholder',
  EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-placeholder',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3001', EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID: 'synthetic-placeholder',
});
for (const name of ['LANGSMITH_TRACING', 'LANGSMITH_TRACING_V2', 'LANGCHAIN_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_VERBOSE', 'LANGSMITH_OTEL_ENABLED']) environment[name] = 'false';

const minute = 60_000;
const tests = [
  ['web-tests', ['node_modules/vitest/vitest.mjs', 'run', '--pool=threads', '--maxWorkers=1', '--no-file-parallelism'], 5 * minute],
  ['evaluations', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'evals/vitest.config.ts'], 5 * minute],
  ['web-types', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'], 6 * minute],
  ['evaluation-types', ['node_modules/typescript/bin/tsc', '--project', 'evals/tsconfig.json', '--noEmit'], 5 * minute],
];
const stages = mode === '--mobile-types'
  ? [['mobile-types', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'], 6 * minute, 'mobile']]
  : mode === '--profile' ? [['profile-tests', ['node_modules/vitest/vitest.mjs', 'run', '__tests__/api/profile.test.ts', '__tests__/useProfileData.test.tsx', '--maxWorkers=1'], 2 * minute]]
  : mode === '--auth' ? [['auth-evaluations', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'evals/vitest.config.ts', 'evals/identity.test.ts'], 5 * minute]]
  : mode === '--evaluations' ? [tests[1]]
  : mode === '--types' ? tests.slice(2)
  : mode === '--cli' ? [
    ['fixture-cli', ['node_modules/tsx/dist/cli.mjs', 'scripts/evaluate-ai.ts'], 3 * minute],
    ['product-cli', ['node_modules/tsx/dist/cli.mjs', 'scripts/evaluate-ai.ts', '--product'], 3 * minute],
  ]
  : mode === '--mobile'
  ? [
    ['mobile-unit', ['node_modules/vitest/vitest.mjs', 'run', '--no-coverage'], 5 * minute, 'mobile'],
    ['mobile-components', ['node_modules/jest/bin/jest.js', '--no-coverage', '--runInBand', '--cacheDirectory', path.join(directory, 'jest-cache')], 5 * minute, 'mobile'],
    ['mobile-types', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'], 6 * minute, 'mobile'],
  ]
  : mode === '--build'
  ? [['build', ['node_modules/next/dist/bin/next', 'build'], 30 * minute]]
  : mode === '--compat'
    ? [['compatibility', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'evals/vitest.config.ts', 'evals/postgres/compatibility.test.ts', 'evals/postgres/live-schema.test.ts'], 5 * minute]]
    : mode === '--lint'
      ? [['lint', ['node_modules/eslint/bin/eslint.js'], 6 * minute]]
      : tests;

async function run([name, args, timeout, subdirectory = '']) {
  console.log(`Starting ${name} (limit ${timeout / minute} minutes)`);
  const startedAt = new Date().toISOString();
  const log = fs.openSync(path.join(directory, `${name}.log`), 'w');
  const child = spawn(process.execPath, args, { cwd: path.join(source, subdirectory), env: environment, stdio: ['ignore', log, log], windowsHide: true });
  fs.writeFileSync(path.join(directory, `${name}-process.json`), JSON.stringify({ pid: child.pid, startedAt, sourceSha256, stage: name }));
  let timedOut = false;
  let launchError;
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32' && child.pid) {
      // Terminate only the process tree started by this stage, including Next worker processes.
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { env: environment, stdio: 'ignore', windowsHide: true });
      killer.on('error', () => child.kill('SIGKILL'));
    } else child.kill('SIGKILL');
  }, timeout);
  const result = await new Promise((resolve) => {
    child.on('error', (error) => { launchError = error.code ?? error.message; });
    child.on('close', (status, signal) => resolve({ status, signal }));
  });
  clearTimeout(timer);
  fs.closeSync(log);
  const report = { name, startedAt, finishedAt: new Date().toISOString(), node: process.version, sourceSha256,
    ...result, timedOut, error: launchError ?? null,
    ...(name === 'build' ? { buildIdPresent: fs.existsSync(path.join(source, '.next', 'BUILD_ID')),
      buildId: fs.existsSync(path.join(source, '.next', 'BUILD_ID')) ? fs.readFileSync(path.join(source, '.next', 'BUILD_ID'), 'utf8').trim() : null } : {}),
  };
  fs.writeFileSync(path.join(directory, `${name}-result.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  return result.status === 0 && !timedOut && !launchError;
}
if (['--tests', '--build'].includes(mode) && !(await run(['dependency-security', ['--test', 'scripts/decoder-compat.test.mjs', 'scripts/zod-size-backport.test.mjs'], minute]))) process.exitCode = 1;
for (const stage of stages) {
  if (process.exitCode) break;
  if (!(await run(stage))) {
    process.exitCode = 1;
    break;
  }
  if (stage[0].endsWith('-cli')) {
    for (const extension of ['json', 'md']) {
      const report = path.join(source, 'output', 'evaluations', `latest.${extension}`);
      if (fs.existsSync(report)) fs.copyFileSync(report, path.join(directory, `${stage[0]}.${extension}`));
    }
  }
}

// Accept the exact local production build in both configured browser engines.
// The evaluation suite blocks cross-origin traffic; no live service is configured.
if (mode === '--build' && !process.exitCode) {
  const serverLog = fs.openSync(path.join(directory, 'browser-server.log'), 'w');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'], {
    cwd: source, env: environment, stdio: ['ignore', serverLog, serverLog], windowsHide: true,
  });
  let serverError;
  server.on('error', error => { serverError = error.message; });
  fs.writeFileSync(path.join(directory, 'browser-server-process.json'), JSON.stringify({ pid: server.pid, sourceSha256 }));
  try {
    let ready = false;
    const buildId = fs.readFileSync(path.join(source, '.next', 'BUILD_ID'), 'utf8').trim();
    const manifestBytes = fs.readFileSync(path.join(source, '.next', 'static', buildId, '_buildManifest.js'));
    const manifestDigest = createHash('sha256').update(manifestBytes).digest('hex');
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline && !serverError && server.exitCode === null) {
      try {
        const response = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(2000), redirect: 'error' });
        if (response.ok) {
          const manifest = await fetch(`http://127.0.0.1:3001/_next/static/${encodeURIComponent(buildId)}/_buildManifest.js`, { signal: AbortSignal.timeout(2000), redirect: 'error' });
          const servedDigest = createHash('sha256').update(Buffer.from(await manifest.arrayBuffer())).digest('hex');
          if (manifest.ok && servedDigest === manifestDigest && server.exitCode === null) { ready = true; break; }
        }
      } catch { /* Readiness remains bounded. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('The isolated production server did not become ready');
    environment.EVAL_BASE_URL = 'http://127.0.0.1:3001';
    if (!(await run(['browser-tests', ['node_modules/@playwright/test/cli.js', 'test', '--config', 'evals/playwright.config.ts'], 5 * minute]))) process.exitCode = 1;
  } catch (error) {
    fs.writeFileSync(path.join(directory, 'browser-start-failure.json'), JSON.stringify({ sourceSha256, error: error.message }));
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (server.pid && server.exitCode === null) {
      if (process.platform === 'win32') {
        await new Promise(resolve => {
          const killer = spawn('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
          killer.on('error', () => { server.kill(); resolve(); });
          killer.on('close', resolve);
        });
      } else server.kill('SIGTERM');
    }
    fs.closeSync(serverLog);
  }
}
