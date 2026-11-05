import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { encryptedExport, exportStages, isOutsideRepository, projectRef } from './recovery-export.mjs';

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
  // with Windows MSYS GPG as well as native GPG. Live mode uses local pinentry.
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
