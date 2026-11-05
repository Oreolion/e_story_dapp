import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { encryptedExport, exportStages, isOutsideRepository, projectRef, prepareEncryption, classifyExportFailure } from './recovery-export.mjs';

const gpg = process.env.TEST_GPG_EXECUTABLE ?? 'gpg';
const syntheticPhrase = 'synthetic-test-phrase-not-used-for-any-real-backup';
const text = 'Synthetic journal fixture. Unicode: café 日本語.\nNo customer data.\n';
const ownedDirectories = [];
afterEach(() => {
  for (const directory of ownedDirectories.splice(0)) {
    // Stop only the agent belonging to this synthetic test home, never the
    // operator's normal GPG agent. Retain synthetic files as local evidence.
    spawnSync('gpgconf', ['--homedir', '.', '--kill', 'gpg-agent'], { cwd: directory, stdio: 'ignore', timeout: 5000, windowsHide: true });
  }
});
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-recovery-test-'));
  fs.chmodSync(directory, 0o700);
  ownedDirectories.push(directory);
  return { directory, output: path.join(directory, 'fixture.sql.gpg'),
    encryption: { command: gpg, cwd: directory, args: ['--homedir', '.', '--batch', '--no-options', '--quiet', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '--compress-algo', 'none', '--output', '-'] } };
}
function decrypt(directory, input, phrase) {
  return spawnSync(gpg, ['--homedir', '.', '--batch', '--no-options', '--quiet', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--decrypt', path.basename(input)], { cwd: directory, input: `${phrase}\n`, encoding: 'utf8', timeout: 15000, windowsHide: true });
}
test('streams a real encrypted UTF-8 export, validates decryption and detects tampering', async () => {
  const f = fixture();
  // Test-only fd 0 prefix avoids passing a secret in argv/environment and works
  // with Windows MSYS GPG as well as native GPG. Live mode privately prefixes
  // the passphrase through a separate PowerShell-to-Node pipe.
  const result = await encryptedExport({ ...f, source: { command: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(syntheticPhrase + '\n' + text)})`] }, timeoutMs: 20000 });
  assert.equal(result.bytes, fs.statSync(f.output).size);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(`${f.output}.partial`), false);
  assert.equal(fs.readFileSync(f.output).includes(Buffer.from(text)), false);
  const restored = decrypt(f.directory, f.output, syntheticPhrase);
  assert.equal(restored.status, 0); assert.equal(restored.stdout, text);
  assert.notEqual(decrypt(f.directory, f.output, 'a-different-synthetic-phrase').status, 0);
  const altered = Buffer.from(fs.readFileSync(f.output)); altered[altered.length - 5] ^= 1;
  const tampered = path.join(f.directory, 'tampered.gpg'); fs.writeFileSync(tampered, altered);
  assert.notEqual(decrypt(f.directory, tampered, syntheticPhrase).status, 0);
});
test('producer failure cannot publish a valid-looking final backup', async () => {
  const f = fixture();
  await assert.rejects(encryptedExport({ ...f, source: { command: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(syntheticPhrase + '\npartial fixture')}); process.exitCode=2;`] }, timeoutMs: 15000 }));
  assert.equal(fs.existsSync(f.output), false);
});
test('encryption failure and hung producers fail closed without overwriting files', async () => {
  const f = fixture();
  await assert.rejects(encryptedExport({ ...f, encryption: { command: process.execPath, args: ['-e', 'process.exitCode=2;'] }, source: { command: process.execPath, args: ['-e', 'process.stdout.write("fixture")'] }, timeoutMs: 5000 }));
  assert.equal(fs.existsSync(f.output), false);
  const other = fixture();
  await assert.rejects(encryptedExport({ ...other, source: { command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] }, timeoutMs: 200 }));
  assert.equal(fs.existsSync(other.output), false);
  const existing = fixture(); fs.writeFileSync(existing.output, 'existing artifact');
  await assert.rejects(encryptedExport({ ...existing, source: { command: process.execPath, args: ['-e', 'throw Error("must not run")'] } }), /already exists/);
  assert.equal(fs.readFileSync(existing.output, 'utf8'), 'existing artifact');
});
test('export inventory includes data, roles and separate migration history', () => {
  assert.equal(projectRef, 'qfwhtsmqndnocfidhdhy');
  assert.equal(exportStages.length, 5);
  assert.deepEqual(exportStages.find(([stage]) => stage === 'migration-data')?.[1], ['--schema', 'supabase_migrations', '--data-only', '--use-copy']);
});
test('repository output guard rejects descendants including names beginning with two dots', () => {
  const root = path.resolve('synthetic-repository');
  assert.equal(isOutsideRepository(root, root), false);
  assert.equal(isOutsideRepository(path.join(root, 'output'), root), false);
  assert.equal(isOutsideRepository(path.join(root, '..backup'), root), false);
  assert.equal(isOutsideRepository(path.resolve(root, '..', 'private-backups'), root), true);
});

test('live encryption setup works with no default GPG home and a separate private passphrase prefix', async () => {
  const encryption = prepareEncryption(gpg);
  const prefix = Buffer.from(syntheticPhrase + '\n');
  try {
    const output = path.join(encryption.cwd, 'live-path-fixture.gpg');
    const unicode = '日本語 café';
    const result = await encryptedExport({ encryption: { ...encryption, prefix }, output,
      source: { command: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(text + unicode)})`] }, timeoutMs: 20000 });
    assert.ok(result.bytes > 0);
    assert.equal(decrypt(encryption.cwd, output, syntheticPhrase).stdout, text + unicode);
    assert.equal(fs.readFileSync(output).includes(prefix), false);
    assert.deepEqual(encryption.args.slice(0, 2), ['--homedir', '.']);
    assert.equal(encryption.interactive, undefined);
  } finally { prefix.fill(0); encryption.close(); }
});

test('missing GPG fails preflight before an export can start', () => {
  assert.throws(() => prepareEncryption(path.join(os.tmpdir(), 'istory-nonexistent-gpg-executable')), /GPG preflight failed/);
});

test('source failures expose fixed categories and exit codes without diagnostic contents', async () => {
  const f = fixture();
  const diagnostic = 'pg_dumpall: password authentication failed for user postgres; postgresql://postgres:synthetic-private-value@example.invalid/postgres';
  await assert.rejects(encryptedExport({ ...f, source: { command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(syntheticPhrase + '\n')}); process.stderr.write(${JSON.stringify(diagnostic)}); process.exitCode=2;`] } }), error => {
    assert.equal(error.code, 'DATABASE_AUTHENTICATION');
    assert.equal(error.sourceExit, 2);
    assert.equal(error.message.includes('synthetic-private-value'), false);
    assert.equal(error.message.includes('postgresql://'), false);
    return true;
  });
  assert.equal(fs.existsSync(f.output), false);
});

test('safe diagnostics distinguish CLI, login, Docker, tool image and network failures', () => {
  const examples = [
    ['unknown flag: --synthetic', 'CLI_ARGUMENTS'],
    ['Access token not provided. Run supabase login.', 'CLI_LOGIN_REQUIRED'],
    ['Cannot connect to the Docker daemon', 'DOCKER_UNAVAILABLE'],
    ['failed to resolve reference public.ecr.aws/example', 'TOOL_IMAGE_UNAVAILABLE'],
    ['connect ECONNREFUSED', 'DATABASE_NETWORK'],
    ['IPv6 is not supported on your current network', 'DATABASE_IPV6'],
    ['no space left on device', 'DISK_FULL'],
    ['unrecognized private diagnostic', 'SOURCE_EXPORT_FAILED'],
  ];
  for (const [message, expected] of examples) assert.equal(classifyExportFailure(message), expected);
});

test('Windows operator wrapper privately pipes a Unicode passphrase through all five synthetic exports', { skip: process.platform !== 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-operator-test-'));
  const cli = path.join(directory, 'synthetic-cli.cjs');
  const driver = path.join(directory, 'synthetic-operator.ps1');
  fs.writeFileSync(cli, `if (process.argv.includes('--version')) { console.log('2.120.0'); }
else { if (process.env.SUPABASE_DB_PASSWORD !== 'synthetic-database-password') process.exit(3); process.stdout.write(${JSON.stringify(text)}); }`);
  fs.writeFileSync(driver, `param($Wrapper, $OutputDirectory, $Cli, $NodeExecutable, $GpgExecutable)
function Read-Host { param($Prompt, [switch]$AsSecureString)
  $value = if ($Prompt -like 'Existing Supabase*') { 'synthetic-database-password' } else { 'synthetic café 日本語 backup phrase' }
  ConvertTo-SecureString $value -AsPlainText -Force
}
& $Wrapper -OutputDirectory $OutputDirectory -SupabaseCli $Cli -NodeExecutable $NodeExecutable -GpgExecutable $GpgExecutable
`, 'utf8');
  const run = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', driver,
    '-Wrapper', path.resolve('scripts/recovery-export.ps1'), '-OutputDirectory', directory, '-Cli', cli,
    '-NodeExecutable', process.execPath, '-GpgExecutable', gpg], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Local encryption and CLI preflight passed/);
  assert.equal((run.stdout + run.stderr).includes('synthetic-database-password'), false);
  assert.equal((run.stdout + run.stderr).includes('synthetic café 日本語 backup phrase'), false);
  const backup = fs.readdirSync(directory).find(name => name.startsWith('istory-db-backup-'));
  assert.ok(backup);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, backup, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'EXPORTED_NOT_RESTORE_VERIFIED');
  assert.equal(manifest.parts.length, 5);
  const f = fixture();
  for (const part of manifest.parts) {
    const copied = path.join(f.directory, part.file);
    fs.copyFileSync(path.join(directory, backup, part.file), copied);
    const restored = decrypt(f.directory, copied, 'synthetic café 日本語 backup phrase');
    assert.equal(restored.status, 0);
    assert.equal(restored.stdout, text);
  }
  // A broken local GPG setup must fail before Read-Host or any db dump starts.
  fs.writeFileSync(driver, `param($Wrapper, $OutputDirectory, $Cli, $NodeExecutable, $GpgExecutable)
function Read-Host { throw 'UNEXPECTED_SECRET_PROMPT' }
& $Wrapper -OutputDirectory $OutputDirectory -SupabaseCli $Cli -NodeExecutable $NodeExecutable -GpgExecutable $GpgExecutable
`);
  const failed = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', driver,
    '-Wrapper', path.resolve('scripts/recovery-export.ps1'), '-OutputDirectory', directory, '-Cli', cli,
    '-NodeExecutable', process.execPath, '-GpgExecutable', path.join(directory, 'missing-gpg.exe')], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout + failed.stderr, /Local preflight failed/);
  assert.equal((failed.stdout + failed.stderr).includes('UNEXPECTED_SECRET_PROMPT'), false);
});
