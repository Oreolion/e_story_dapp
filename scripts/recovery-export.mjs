// Operator-run export. SQL streams directly into GPG; no plaintext dump/log is saved.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

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

function plumbing() {
  return Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME']
    .filter(name => process.env[name]).map(name => [name, process.env[name]]));
}
function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const task = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    task.on('error', () => child.kill('SIGKILL'));
  } else child.kill('SIGKILL');
}
function exited(child) {
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
  try {
    cipher = spawn(encryption.command, encryption.args, {
      cwd: encryption.cwd, env: encryption.env ?? plumbing(), windowsHide: !encryption.interactive,
      stdio: ['pipe', 'pipe', encryption.interactive ? 'inherit' : 'ignore'],
    });
    const cipherExit = exited(cipher);
    producer = spawn(source.command, source.args, {
      cwd: source.cwd, env: source.env ?? plumbing(), windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const producerExit = exited(producer);
    const abort = () => { stop(producer); stop(cipher); };
    timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    const guarded = promise => promise.catch(() => { abort(); throw new Error('Stream failed'); });
    const results = await Promise.allSettled([
      guarded(pipeline(producer.stdout, cipher.stdin)),
      guarded(pipeline(cipher.stdout, destination)),
      producerExit.then(code => { if (code !== 0) { abort(); throw new Error('Export process failed'); } }),
      cipherExit.then(code => { if (code !== 0) { abort(); throw new Error('Encryption process failed'); } }),
    ]);
    if (timedOut || results.some(result => result.status === 'rejected')) throw new Error('Export/encryption did not complete. Partial files are not backups.');
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
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--output', '--supabase-cli', '--gpg']);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.has(args[index]) || !args[index + 1] || options[args[index]]) throw new Error('Usage: recovery-export.mjs --output ABSOLUTE_PRIVATE_DIRECTORY --supabase-cli ABSOLUTE_CLI_JS [--gpg GPG_EXECUTABLE]');
    options[args[index]] = args[index + 1];
  }
  if (!options['--output'] || !path.isAbsolute(options['--output']) || !options['--supabase-cli'] || !path.isAbsolute(options['--supabase-cli'])) throw new Error('Explicit absolute output and CLI paths are required.');
  const parent = fs.realpathSync(options['--output']);
  if (!isOutsideRepository(parent)) throw new Error('Recovery files must be outside the repository.');
  // The operator wrapper asks locally. Never reset a password, read env files,
  // pass passwords in argv or fall back to a service/API credential.
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error('Use recovery-export.ps1 to enter the existing database password privately.');
  const safeEnv = { ...plumbing(), DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1' };
  // An empty workdir prevents automatic loading of the application's env files.
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-recovery-cli-'));
  fs.mkdirSync(path.join(workdir, 'supabase'));
  fs.writeFileSync(path.join(workdir, 'supabase/config.toml'), 'project_id = "istory-recovery-export"\n[db]\nmajor_version = 17\n', { mode: 0o600 });
  const version = spawnSync(process.execPath, [options['--supabase-cli'], '--version'], { cwd: workdir, env: safeEnv, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (version.status !== 0 || version.stdout.trim() !== cliVersion) throw new Error('The reviewed Supabase CLI version is required; no export started.');
  const directory = fs.mkdtempSync(path.join(parent, 'istory-db-backup-'));
  fs.chmodSync(directory, 0o700);
  const manifest = { projectRef, cliVersion, startedAt: new Date().toISOString(), status: 'INCOMPLETE', parts: [],
    encryption: 'GnuPG symmetric AES256; operator-managed passphrase',
    limits: ['Database export only: media object bytes and external provider configuration are not included.', 'Platform-managed schema customizations and Vault/encryption-root recovery require separate verification.', 'A completed export is not a verified restore or off-site delivery.'] };
  const saveManifest = () => fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  saveManifest();
  console.log(`Local encrypted backup directory: ${directory}`);
  console.log('Enter the backup passphrase only in GPG\'s local prompt; keep it separate from the backup folder.');
  for (const [stage, flags] of exportStages) {
    console.log(`Exporting encrypted ${stage}; SQL and diagnostics will not be printed.`);
    const part = await encryptedExport({
      source: { command: process.execPath, args: [options['--supabase-cli'], 'db', 'dump', '--linked', '--project-ref', projectRef, '--workdir', workdir, ...flags], cwd: workdir,
        env: { ...safeEnv, SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD } },
      encryption: { command: options['--gpg'] ?? 'gpg', args: ['--no-options', '--quiet', '--symmetric', '--cipher-algo', 'AES256', '--compress-algo', 'none', '--output', '-'], env: safeEnv, interactive: true },
      output: path.join(directory, `${stage}.sql.gpg`),
    });
    manifest.parts.push(part); saveManifest();
  }
  manifest.status = 'EXPORTED_NOT_RESTORE_VERIFIED'; manifest.finishedAt = new Date().toISOString(); saveManifest();
  console.log(JSON.stringify({ directory, projectRef, status: manifest.status, encryptedParts: manifest.parts.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Recovery export failed. Do not upload partial output or treat it as a backup. No credentials or SQL were printed.'); process.exitCode = 1; });
}
