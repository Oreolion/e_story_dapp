// Operator-run export. SQL streams directly into GPG; no plaintext dump/log is saved.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CopyCounter, catalogSql, validateCatalog } from './recovery-format.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function isOutsideRepository(directory, root = repository) {
  const relative = path.relative(root, directory);
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}
export const projectRef = 'qfwhtsmqndnocfidhdhy';
export const cliVersion = '2.120.0';
export const exportStages = [
  ['roles', ['--role-only']],
  ['schema', []],
  ['data', ['--data-only', '--use-copy']],
  ['migration-schema', ['--schema', 'supabase_migrations']],
  ['migration-data', ['--schema', 'supabase_migrations', '--data-only', '--use-copy']],
];

const failureMessages = {
  CLI_ARGUMENTS: 'The installed CLI rejected an export argument.',
  CLI_CONFIGURATION: 'The isolated CLI configuration was rejected.',
  CLI_LOGIN_REQUIRED: 'The CLI could not use its saved Supabase login. Sign in locally; do not send an access token through chat.',
  DATABASE_AUTHENTICATION: 'The database rejected authentication. Check the existing database password locally; do not reset it for this export.',
  DATABASE_PERMISSION: 'The database denied the export role access. Do not grant extra permissions without reviewing the cause.',
  DATABASE_NETWORK: 'The database connection failed. Check network reachability and project availability.',
  DATABASE_IPV6: 'The direct database connection requires an IPv4 pooler fallback that was unavailable.',
  DOCKER_UNAVAILABLE: 'The CLI could not reach Docker. Start Docker Desktop and wait until its engine is ready.',
  TOOL_IMAGE_UNAVAILABLE: 'The CLI could not obtain its PostgreSQL export tool image. Check the registry connection and available disk space.',
  DISK_FULL: 'The export process reported insufficient disk space.',
  SOURCE_START_FAILED: 'The export program could not start.',
  SOURCE_EXPORT_FAILED: 'The database export command failed; the available diagnostic did not match a known safe category.',
  ENCRYPTION_FAILED: 'The encryption process failed after preflight.',
  STREAM_FAILED: 'The encrypted export stream did not complete.',
  EXPORT_TIMEOUT: 'The export exceeded its time limit and was stopped.',
};

// Inspect a bounded diagnostic internally and expose only a fixed category.
// Never print/save arbitrary stderr, connection strings, SQL or credentials.
export function classifyExportFailure(diagnostic) {
  const cases = [
    ['CLI_ARGUMENTS', /unknown flag|unrecognized option|unexpected argument/i],
    ['CLI_CONFIGURATION', /failed to parse config|invalid config|error (?:parsing|decoding) config|unsupported postgres version/i],
    ['CLI_LOGIN_REQUIRED', /access token (?:not provided|not found|is required)|not logged in|supabase login|failed to (?:retrieve|load|read).*access token/i],
    ['DATABASE_AUTHENTICATION', /password authentication failed|28P01|SASL.*authentication failed/i],
    ['DATABASE_PERMISSION', /permission denied|must be superuser|insufficient privilege/i],
    ['DISK_FULL', /no space left on device|not enough space on the disk/i],
    ['DATABASE_IPV6', /IPv6 is not supported|network is unreachable.*IPv6/i],
    ['DOCKER_UNAVAILABLE', /cannot connect to the docker|docker daemon|dockerDesktopLinuxEngine|is the docker engine running|docker.*executable file not found/i],
    ['TOOL_IMAGE_UNAVAILABLE', /failed to pull|pull access denied|manifest unknown|failed to resolve reference|failed to fetch.*manifest/i],
    ['DATABASE_NETWORK', /ECONNREFUSED|ENETUNREACH|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|could not (?:connect|translate host)|connection (?:refused|timed out)|network is unreachable/i],
  ];
  return cases.find(([, pattern]) => pattern.test(diagnostic))?.[0] ?? 'SOURCE_EXPORT_FAILED';
}

class ExportFailure extends Error {
  constructor(code, sourceExit) {
    super(failureMessages[code]);
    this.code = code;
    this.sourceExit = Number.isInteger(sourceExit) ? sourceExit : null;
  }
}

export function plumbing() {
  return Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME']
    .filter(name => process.env[name]).map(name => [name, process.env[name]]));
}

export function prepareEncryption(command) {
  // Relative homedir avoids MSYS interpreting a Windows drive colon as a socket
  // name. Never depend on or alter the operator's default GPG configuration.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-backup-gpg-'));
  fs.chmodSync(cwd, 0o700);
  const env = plumbing();
  const args = ['--homedir', '.', '--no-options', '--batch', '--no-tty', '--quiet', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0'];
  const gpgconf = path.isAbsolute(command) ? path.join(path.dirname(command), process.platform === 'win32' ? 'gpgconf.exe' : 'gpgconf') : 'gpgconf';
  const close = () => spawnSync(gpgconf, ['--homedir', '.', '--kill', 'gpg-agent'], { cwd, env, stdio: 'ignore', timeout: 5000, windowsHide: true });
  const phrase = randomBytes(32).toString('hex');
  const fixture = Buffer.from('iStory synthetic encryption preflight: café 日本語\n');
  const encrypted = spawnSync(command, [...args, '--symmetric', '--cipher-algo', 'AES256', '--compress-algo', 'none', '--output', '-'], {
    cwd, env, input: Buffer.concat([Buffer.from(`${phrase}\n`), fixture]), timeout: 15000, maxBuffer: 128 * 1024, windowsHide: true,
  });
  if (encrypted.status !== 0 || !encrypted.stdout?.length) { close(); throw new Error('GPG preflight failed; no database export started.'); }
  fs.writeFileSync(path.join(cwd, 'synthetic.gpg'), encrypted.stdout, { mode: 0o600 });
  const decrypted = spawnSync(command, [...args, '--decrypt', 'synthetic.gpg'], { cwd, env, input: `${phrase}\n`, timeout: 15000, maxBuffer: 128 * 1024, windowsHide: true });
  if (decrypted.status !== 0 || !decrypted.stdout.equals(fixture)) { close(); throw new Error('GPG preflight failed; no database export started.'); }
  return { command, cwd, env, decryptArgs: [...args, '--decrypt'], args: [...args, '--symmetric', '--cipher-algo', 'AES256', '--compress-algo', 'none', '--output', '-'], close };
}

export async function readPassphrase() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 8192) throw new Error('Invalid private input.');
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks);
  try {
    const { passphrase } = JSON.parse(input.toString('utf8'));
    if (typeof passphrase !== 'string' || !passphrase.length || Buffer.byteLength(passphrase) > 1024 || /[\r\n\0]/.test(passphrase)) throw new Error('Invalid private input.');
    return Buffer.from(`${passphrase}\n`, 'utf8');
  } finally { input.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
}
export function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const task = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    task.on('error', () => child.kill('SIGKILL'));
  } else child.kill('SIGKILL');
}
export function exited(child) {
  return new Promise(resolve => {
    child.once('error', () => resolve(-1));
    child.once('close', code => resolve(code));
  });
}

// Exported for isolated synthetic tests. Live CLI mode fixes the project and commands.
export async function encryptedExport({ source, encryption, output, timeoutMs = 600_000 }) {
  const partial = `${output}.partial`;
  if (fs.existsSync(output)) throw new Error('An output already exists; nothing was overwritten.');
  const descriptor = fs.openSync(partial, 'wx', 0o600);
  const destination = fs.createWriteStream(partial, { fd: descriptor });
  let producer;
  let cipher;
  let timer;
  let timedOut = false;
  let diagnostic = '';
  let sourceExit;
  let encryptionExit;
  try {
    cipher = spawn(encryption.command, encryption.args, {
      cwd: encryption.cwd, env: encryption.env ?? plumbing(), windowsHide: !encryption.interactive,
      stdio: ['pipe', 'pipe', encryption.interactive ? 'inherit' : 'ignore'],
    });
    const cipherExit = exited(cipher);
    let plaintext;
    let producerExit = Promise.resolve(0);
    if (source.bytes) plaintext = Readable.from([source.bytes]);
    else {
      producer = spawn(source.command, source.args, {
        cwd: source.cwd, env: source.env ?? plumbing(), windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      producer.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString('utf8')).slice(-65536); });
      producerExit = exited(producer);
      plaintext = producer.stdout;
    }
    const abort = () => { stop(producer); stop(cipher); };
    timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    const guarded = promise => promise.catch(() => { abort(); throw new Error('Stream failed'); });
    const results = await Promise.allSettled([
      guarded(pipeline(Readable.from((async function* () {
        if (encryption.prefix) yield encryption.prefix;
        for await (const chunk of plaintext) { source.observe?.(chunk); yield chunk; }
      })()), cipher.stdin)),
      guarded(pipeline(cipher.stdout, destination)),
      producerExit.then(code => { sourceExit = code; if (code !== 0) { abort(); throw new Error('Export process failed'); } }),
      cipherExit.then(code => { encryptionExit = code; if (code !== 0) { abort(); throw new Error('Encryption process failed'); } }),
    ]);
    if (timedOut) throw new ExportFailure('EXPORT_TIMEOUT', sourceExit);
    if (sourceExit !== 0) throw new ExportFailure(sourceExit === -1 ? 'SOURCE_START_FAILED' : classifyExportFailure(diagnostic), sourceExit);
    if (encryptionExit !== 0) throw new ExportFailure('ENCRYPTION_FAILED', sourceExit);
    if (results.some(result => result.status === 'rejected')) throw new ExportFailure('STREAM_FAILED', sourceExit);
    if (fs.statSync(partial).size === 0) throw new Error('Empty encrypted output.');
    // An exclusive link publishes only a completed file and cannot replace an
    // existing file, even if another process created it while export was running.
    fs.linkSync(partial, output);
    fs.unlinkSync(partial);
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(output)) hash.update(chunk);
    return { file: path.basename(output), bytes: fs.statSync(output).size, sha256: hash.digest('hex') };
  } finally {
    clearTimeout(timer);
    stop(producer); stop(cipher);
    destination.destroy();
    diagnostic = '';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--output', '--supabase-cli', '--gpg']);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (['--preflight', '--restore'].includes(args[index])) { options[args[index].slice(2)] = true; index -= 1; continue; }
    if (!allowed.has(args[index]) || !args[index + 1] || options[args[index]]) throw new Error('Usage: recovery-export.mjs --output ABSOLUTE_PRIVATE_DIRECTORY --supabase-cli ABSOLUTE_CLI_JS [--gpg GPG_EXECUTABLE]');
    options[args[index]] = args[index + 1];
  }
  if (!options['--output'] || !path.isAbsolute(options['--output']) || !options['--supabase-cli'] || !path.isAbsolute(options['--supabase-cli'])) throw new Error('Explicit absolute output and CLI paths are required.');
  const parent = fs.realpathSync(options['--output']);
  if (!isOutsideRepository(parent)) throw new Error('Recovery files must be outside the repository.');
  // The operator wrapper asks locally. Never reset a password, read env files,
  // pass passwords in argv or fall back to a service/API credential.
  const safeEnv = { ...plumbing(), DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1' };
  // An empty workdir prevents automatic loading of the application's env files.
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-recovery-cli-'));
  fs.mkdirSync(path.join(workdir, 'supabase'));
  fs.writeFileSync(path.join(workdir, 'supabase/config.toml'), 'project_id = "istory-recovery-export"\n[db]\nmajor_version = 17\n', { mode: 0o600 });
  const version = spawnSync(process.execPath, [options['--supabase-cli'], '--version'], { cwd: workdir, env: safeEnv, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (version.status !== 0 || version.stdout.trim() !== cliVersion) throw new Error('The reviewed Supabase CLI version is required; no export started.');
  const encryption = prepareEncryption(options['--gpg'] ?? 'gpg');
  let prefix;
  try {
    if (options.restore) (await import('./recovery-restore.mjs')).checkRestoreEngine();
    if (options.preflight) { console.log('Local encryption and CLI preflight passed. No database connection was made.'); return; }
    if (!process.env.SUPABASE_DB_PASSWORD) throw new Error('Use recovery-export.ps1 to enter the existing database password privately.');
    prefix = await readPassphrase();
    console.log('Reading schema and privilege metadata; no customer records will be displayed.');
    const metadata = spawnSync(process.execPath, [options['--supabase-cli'], 'db', 'query', '--linked', '--project-ref', projectRef, '--workdir', workdir, '--output', 'json', catalogSql], {
      cwd: workdir, env: safeEnv, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true,
    });
    if (metadata.status !== 0) throw new ExportFailure(classifyExportFailure(metadata.stderr ?? ''), metadata.status);
    const rows = JSON.parse(metadata.stdout);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Invalid catalog result.');
    const catalog = validateCatalog(rows[0].recovery_catalog);
    const counter = new CopyCounter();
    const directory = fs.mkdtempSync(path.join(parent, 'istory-db-backup-'));
    fs.chmodSync(directory, 0o700);
    const manifest = { formatVersion: 2, projectRef, cliVersion, startedAt: new Date().toISOString(), status: 'INCOMPLETE', parts: [],
      encryption: 'GnuPG symmetric AES256; operator-managed passphrase',
      limits: ['Database export only: media object bytes, role passwords and external provider configuration are not included.', 'Vault/encryption-root recovery and CLI-excluded event triggers require separate coverage.', 'Export parts use separate snapshots; a completed export is not a verified restore or off-site delivery.'] };
    const saveManifest = () => fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    saveManifest();
    console.log(`Local encrypted backup directory: ${directory}`);
    console.log('Using the passphrase entered privately in PowerShell; keep it separate from the backup folder.');
    for (const [stage, originalFlags] of exportStages) {
      const flags = stage === 'schema' ? ['--schema', catalog.schemaNames.join(',')] : originalFlags;
      console.log(`Exporting encrypted ${stage}; SQL and diagnostics will not be printed.`);
      const part = await encryptedExport({
        source: { command: process.execPath, args: [options['--supabase-cli'], 'db', 'dump', '--linked', '--project-ref', projectRef, '--workdir', workdir, ...flags], cwd: workdir,
          env: { ...safeEnv, SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD }, observe: ['data', 'migration-data'].includes(stage) ? chunk => counter.write(chunk) : undefined },
        encryption: { ...encryption, prefix },
        output: path.join(directory, `${stage}.sql.gpg`),
      });
      manifest.parts.push(part); saveManifest();
    }
    const catalogBytes = Buffer.from(JSON.stringify({ formatVersion: 2, projectRef, catalog, copyCounts: counter.finish() }), 'utf8');
    try {
      manifest.parts.push(await encryptedExport({ source: { bytes: catalogBytes }, encryption: { ...encryption, prefix }, output: path.join(directory, 'catalog.json.gpg') }));
    } finally { catalogBytes.fill(0); }
    manifest.status = 'EXPORTED_NOT_RESTORE_VERIFIED'; manifest.finishedAt = new Date().toISOString(); saveManifest();
    console.log(JSON.stringify({ directory, projectRef, status: manifest.status, encryptedParts: manifest.parts.length }));
    if (options.restore) await (await import('./recovery-restore.mjs')).restoreBackup({ directory, gpg: options['--gpg'] ?? 'gpg', prefix });
  } finally { prefix?.fill(0); encryption.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    if (error instanceof ExportFailure) console.error(JSON.stringify({ error: error.code, sourceExit: error.sourceExit, message: error.message }));
    else if (error?.code === 'LOCAL_RESTORE_FAILURE') console.error(JSON.stringify({ error: error.category }));
    console.error('Recovery operation failed. Retain completed encrypted files; partial files and an unverified restore are not recovery proof. No credentials or SQL were printed.'); process.exitCode = 1;
  });
}
