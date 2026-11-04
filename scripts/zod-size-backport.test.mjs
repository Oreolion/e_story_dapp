import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyZod } from './zod-size-backport.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const variants = [
  ['root v3 CommonJS', 'node_modules/zod/v3/index.cjs'],
  ['root v3 ESM', 'node_modules/zod/v3/index.js'],
  ['base v3 CommonJS', 'node_modules/@base-org/account/node_modules/zod/index.cjs'],
  ['base v3 ESM', 'node_modules/@base-org/account/node_modules/zod/index.js'],
  ['reown v3 CommonJS', 'node_modules/@reown/appkit-wallet/node_modules/zod/lib/index.js'],
  ['reown v3 ESM', 'node_modules/@reown/appkit-wallet/node_modules/zod/lib/index.mjs'],
  ['reown v3 UMD', 'node_modules/@reown/appkit-wallet/node_modules/zod/lib/index.umd.js'],
  ['Next vendored v3', 'node_modules/next/dist/compiled/zod/index.cjs'],
  ['base v4 CommonJS', 'node_modules/@base-org/account/node_modules/zod/v4/index.cjs'],
  ['base v4 ESM', 'node_modules/@base-org/account/node_modules/zod/v4/index.js'],
  ['base v4 mini CommonJS', 'node_modules/@base-org/account/node_modules/zod/v4/mini/index.cjs'],
  ['base v4 mini ESM', 'node_modules/@base-org/account/node_modules/zod/v4/mini/index.js'],
  ['official fixed v4 CommonJS', 'node_modules/zod/index.cjs'],
  ['official fixed v4 ESM', 'node_modules/zod/index.js'],
];

test('every reviewed web parser has its hash-pinned size backport', () => {
  assert.ok(verifyZod().files >= 12);
});

for (const [name, relative] of variants) {
  test(`${name}: constrained oversized collections stop before child and later checks`, async () => {
    const filename = path.join(root, relative);
    const loaded = /\.(cjs)$/.test(relative) || relative.includes('/reown/') || relative.endsWith('/lib/index.js') || relative.endsWith('/index.umd.js')
      ? require(filename) : await import(pathToFileURL(filename).href);
    const z = loaded.z ?? loaded.default ?? loaded;
    const mini = name.includes('mini');
    let children = 0;
    let later = 0;
    const element = mini ? z.string().check(z.refine(() => { children++; return true; })) : z.string().refine(() => { children++; return true; });
    const array = max => mini ? z.array(element).check(z.maxLength(max)) : z.array(element).max(max);
    const refine = schema => mini ? schema.check(z.refine(() => { later++; return true; })) : schema.refine(() => { later++; return true; });
    const schema = refine(array(2));
    const result = schema.safeParse(Array(20000).fill('x'));
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues.map(issue => [issue.code, issue.path]), [['too_big', []]]);
    assert.equal(children, 0);
    assert.equal(later, 0);
    const invalid = schema.safeParse(Array(20000).fill(1));
    assert.equal(invalid.error.issues.length, 1);
    const length = mini ? z.array(element).check(z.length(2)) : z.array(element).length(2);
    assert.equal(length.safeParse(['a', 'b', 'c']).error.issues.length, 1);
    assert.equal(children, 0);
    const nested = z.object({ values: array(1) }).safeParse({ values: ['a', 'b'] });
    assert.deepEqual(nested.error.issues[0].path, ['values']);
    const asyncResult = await schema.safeParseAsync(['a', 'b', 'c']);
    assert.equal(asyncResult.error.issues.length, 1);
    assert.equal(children, 0);
    assert.equal(later, 0);
    let asyncChildren = 0;
    const asyncRefine = async () => { asyncChildren++; return true; };
    const asyncElement = mini ? z.string().check(z.refine(asyncRefine)) : z.string().refine(asyncRefine);
    const asyncSchema = mini ? z.array(asyncElement).check(z.maxLength(1)) : z.array(asyncElement).max(1);
    assert.equal((await asyncSchema.safeParseAsync(['a', 'b'])).error.issues.length, 1);
    assert.equal(asyncChildren, 0);
    assert.deepEqual(await asyncSchema.parseAsync(['a']), ['a']);
    assert.equal(asyncChildren, 1);
    assert.deepEqual(array(2).parse(['a', 'b']), ['a', 'b']);
    assert.equal(children, 2);
    children = 0;
    const set = mini ? z.set(element).check(z.maxSize(1)) : z.set(element).max(1);
    assert.equal(set.safeParse(new Set(['a', 'b'])).error.issues.length, 1);
    assert.equal(children, 0);
    assert.equal(set.safeParse(['a', 'b']).error.issues[0].code, 'invalid_type');
    if (name.includes('v4')) {
      const map = z.map(element, element).check(z.maxSize(1));
      assert.equal(map.safeParse(new Map([['a', 'b'], ['c', 'd']])).error.issues.length, 1);
      assert.equal(children, 0);
      const rewritten = z.array(z.number()).check(z.overwrite(value => value.slice(0, 2)), z.maxLength(2));
      assert.deepEqual(rewritten.parse([1, 2, 3]), [1, 2]);
    }
    // The upstream change deliberately does not impose a new limit on unbounded schemas.
    assert.equal(z.array(z.string()).safeParse([1, 2, 3]).error.issues.length, 3);
    const tooShort = mini ? z.array(z.number()).check(z.minLength(2)) : z.array(z.number()).min(2);
    assert.ok(tooShort.safeParse(['bad']).error.issues.some(issue => issue.code === 'invalid_type'));
  });
}

test('backport guard rejects missing patches, changed exports, new copies and tampering', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-zod-integrity-'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'security/zod-size-backport.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const copy = relative => {
    const destination = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
  };
  copy('security/zod-size-backport.json');
  for (const item of manifest.packages) copy(`${item.path}/package.json`);
  for (const item of manifest.files) copy(item.path);
  const lockPath = path.join(fixture, 'package-lock.json');
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  assert.equal(verifyZod(fixture).files, manifest.files.length);
  const sample = manifest.files.find(item => item.kind === 'v3' && item.path.endsWith('/v3/types.js'));
  const samplePath = path.join(fixture, sample.path);
  let original = fs.readFileSync(samplePath, 'utf8').replace(/if \(tooBig\) return [\w.]*INVALID;\n/, '');
  for (const field of ['maxLength', 'maxSize']) {
    original = original.replace(new RegExp(`(message: def\\.${field}\\.message,\\s*}\\);\\s*)return [\\w.]*INVALID;`), '$1status.dirty();');
  }
  assert.equal(createHash('sha256').update(original).digest('hex'), sample.originalSha256);
  fs.writeFileSync(samplePath, original);
  assert.throws(() => verifyZod(fixture), /backport missing/);
  verifyZod(fixture, { apply: true });
  assert.equal(verifyZod(fixture).files, manifest.files.length);
  const ts = require('typescript');
  for (const item of manifest.files.filter(item => item.kind === 'v4-ts')) {
    const compiled = ts.transpileModule(fs.readFileSync(path.join(fixture, item.path), 'utf8'), { reportDiagnostics: true });
    assert.equal(compiled.diagnostics.length, 0);
  }
  lock.packages['node_modules/unreviewed/node_modules/zod'] = { version: '3.0.0' };
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  assert.throws(() => verifyZod(fixture), /inventory changed/);
  delete lock.packages['node_modules/unreviewed/node_modules/zod'];
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  const metadataPath = path.join(fixture, manifest.packages[0].path, 'package.json');
  fs.appendFileSync(metadataPath, ' ');
  assert.throws(() => verifyZod(fixture, { apply: true }), /Unreviewed Zod exports/);
  copy(`${manifest.packages[0].path}/package.json`);
  fs.appendFileSync(path.join(fixture, manifest.files[0].path), '\n// tamper');
  assert.throws(() => verifyZod(fixture, { apply: true }), /Unreviewed Zod source/);
});
