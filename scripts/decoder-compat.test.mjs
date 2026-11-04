import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { verifyDecoder } from './decoder-compat.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const upstream = path.join(root, 'security/upstream/decode-uri-component-0.5.1');

test('installed fixed decoder has the reviewed CommonJS adapter', () => {
  assert.ok(verifyDecoder().copies > 0);
  assert.equal(typeof require('decode-uri-component'), 'function');
});

test('CommonJS preserves legacy plus handling and query-string wallet URLs', () => {
  const decode = require('decode-uri-component');
  assert.equal(decode('a+b%2Bc'), 'a b+c');
  assert.equal(decode('st%C3%A5le%'), 'ståle%');
  assert.equal(decode('%25C2%zz'), '%C2%zz');
  assert.equal(decode('%20%20%25%80'), '  %%80');
  assert.throws(() => decode(null), TypeError);
  const query = require('query-string');
  const parsed = query.parse('uri=wc%3Aabc%402%3Frelay-protocol%3Dirn%26symKey%3D123&label=a+b%2Bc');
  assert.equal(parsed.uri, 'wc:abc@2?relay-protocol=irn&symKey=123');
  assert.equal(parsed.label, 'a b+c');
  assert.deepEqual(query.parse(query.stringify(parsed)), parsed);
});

test('ESM retains the official upstream interface', async () => {
  const { default: decode } = await import('decode-uri-component');
  assert.equal(decode('a+b%2Bc'), 'a+b+c');
  assert.equal(decode('%F0%9F%98%80%ab'), '😀%ab');
});

test('all pinned upstream regression tests pass in a bounded VM', () => {
  const source = fs.readFileSync(path.join(upstream, 'index.js'), 'utf8');
  const suite = fs.readFileSync(path.join(upstream, 'test.js'), 'utf8');
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(source), '6a86ac891edf15c5efa0841ebb31935e3669d58b98318b57d7b08a4530317cb0');
  assert.equal(hash(suite), 'acb81f2173ef208c173465fa98f054923c1ca78b7aa09e1493ee5936b963acba');
  let assertions = 0;
  const t = {
    is(actual, expected) { assertions++; assert.equal(actual, expected); },
    true(value) { assertions++; assert.equal(value, true); },
    throws(fn, expected) { assertions++; assert.throws(fn, error => error.message === expected.message); },
  };
  const ava = (name, ...args) => typeof name === 'function' ? name(t, ...args) : args[0](t, ...args.slice(1));
  const program = source.replace('export default function', 'function') + '\nconst m = decodeUriComponent;\n'
    + suite.replace("import test from 'ava';", '').replace("import m from './index.js';", '');
  new vm.Script(program).runInNewContext({ test: ava }, { timeout: 5000 });
  assert.ok(assertions > 150, `Expected full upstream suite; ran ${assertions} assertions`);
});

test('large malformed runs terminate with bounded time and memory in the actual CJS consumer', () => {
  const program = `
    const assert = require('node:assert/strict');
    const decode = require('decode-uri-component');
    const malformed = '%80%41'.repeat(50000);
    assert.equal(decode(malformed), '%80A'.repeat(50000));
    const many = Array.from({length: 32000}, (_, n) => '%' + Math.floor(n/256).toString(16).padStart(2,'0') + '%' + (n%256).toString(16).padStart(2,'0') + 'x').join('') + '%zz';
    assert.equal(typeof decode(many), 'string');
  `;
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '-e', program], {
    cwd: root, encoding: 'utf8', timeout: 6000, maxBuffer: 8192, windowsHide: true,
    env: Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(name => process.env[name]).map(name => [name, process.env[name]])),
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('integrity guard rejects absent adapters, tampering and unreviewed versions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-decoder-integrity-'));
  const target = path.join(directory, 'node_modules/decode-uri-component');
  fs.mkdirSync(target, { recursive: true });
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const entry = lock.packages['node_modules/decode-uri-component'];
  const fixtureLock = { packages: { 'node_modules/decode-uri-component': { ...entry } } };
  const lockPath = path.join(directory, 'package-lock.json');
  fs.writeFileSync(lockPath, JSON.stringify(fixtureLock));
  for (const name of ['index.js', 'package.json']) fs.copyFileSync(path.join(root, 'node_modules/decode-uri-component', name), path.join(target, name));
  assert.throws(() => verifyDecoder(directory), /adapter missing/);
  verifyDecoder(directory, { apply: true });
  assert.equal(verifyDecoder(directory).copies, 1);
  assert.equal(verifyDecoder(directory, { apply: true }).copies, 1);
  fs.appendFileSync(path.join(target, 'index.cjs'), '\n// tamper');
  assert.throws(() => verifyDecoder(directory, { apply: true }), /Unexpected decoder adapter source/);
  fs.appendFileSync(path.join(target, 'index.js'), '\n// tamper');
  assert.throws(() => verifyDecoder(directory), /Unreviewed decoder source/);
  fixtureLock.packages['node_modules/decode-uri-component'].version = '0.5.2';
  fs.writeFileSync(lockPath, JSON.stringify(fixtureLock));
  assert.throws(() => verifyDecoder(directory, { apply: true }), /Unreviewed decoder lock/);
  // Keep the tiny fixture for reproducible failure inspection; never deletes an arbitrary path.
});
