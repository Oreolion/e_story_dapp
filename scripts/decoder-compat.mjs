// Compatibility adapter for the official fixed decoder; never suppresses audit findings.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceHash = '6a86ac891edf15c5efa0841ebb31935e3669d58b98318b57d7b08a4530317cb0';
const metadataHash = '8822236f8ec0fc7c8f540812dda32b81797bec92e51bd567fbb196fda04a7f13';
const hash = value => createHash('sha256').update(value).digest('hex');
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function verifyDecoder(root = repository, { apply = false } = {}) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const entries = Object.entries(lock.packages).filter(([name]) => /(?:^|\/)node_modules\/decode-uri-component$/.test(name));
  if (!entries.length) throw new Error('Decoder missing from lockfile; review whether this adapter can be retired.');
  const pending = [];
  for (const [relative, entry] of entries) {
    if (entry.version !== '0.5.1' || entry.integrity !== 'sha512-vWHQkXgg2cE3BB4rR0c+PYw9BCQzLoNIRMI7AunIkZst74tw/vpPp7VLoYtsR/cy1f55g3XDWUslfeCZjiZJyA==') {
      // Integrity is also checked by npm. This independently pins the reviewed package.
      throw new Error(`Unreviewed decoder lock entry: ${relative}`);
    }
    const directory = path.join(root, relative);
    const source = fs.readFileSync(path.join(directory, 'index.js'), 'utf8');
    if (hash(source) !== sourceHash) throw new Error(`Unreviewed decoder source: ${relative}`);
    const metadataPath = path.join(directory, 'package.json');
    const metadata = fs.readFileSync(metadataPath, 'utf8');
    const original = JSON.parse(metadata);
    if (original.name !== 'decode-uri-component' || original.version !== '0.5.1' || original.type !== 'module') {
      throw new Error(`Unexpected decoder package: ${relative}`);
    }
    const patched = { ...original, exports: { types: './index.d.ts', import: './index.js', require: './index.cjs', default: './index.js' } };
    const patchedMetadata = `${JSON.stringify(patched, null, '\t')}\n`;
    // Reconstruct pristine metadata for repeatable checking without trusting patched fields.
    const pristine = { ...original, exports: { types: './index.d.ts', default: './index.js' } };
    if (hash(`${JSON.stringify(pristine, null, '\t')}\n`) !== metadataHash) {
      throw new Error(`Unreviewed decoder metadata: ${relative}`);
    }
    if (hash(metadata) !== metadataHash && metadata !== patchedMetadata) throw new Error(`Unexpected decoder adapter metadata: ${relative}`);
    const cjs = "'use strict';\n// Generated from verified upstream 0.5.1; legacy CommonJS plus-to-space compatibility.\n"
      + source.replace('export default function decodeUriComponent', 'function decodeUriComponent')
      + "\nmodule.exports = function decodeLegacyComponent(value) {\n\treturn decodeUriComponent(typeof value === 'string' ? value.replace(/\\+/g, ' ') : value);\n};\n";
    const cjsPath = path.join(directory, 'index.cjs');
    const existing = fs.existsSync(cjsPath) ? fs.readFileSync(cjsPath, 'utf8') : null;
    if (existing !== null && existing !== cjs) throw new Error(`Unexpected decoder adapter source: ${relative}`);
    if (!apply && (metadata !== patchedMetadata || existing !== cjs)) {
      throw new Error('Decoder CommonJS adapter missing. Run npm install normally or node scripts/decoder-compat.mjs --apply after --ignore-scripts.');
    }
    pending.push({ metadataPath, patchedMetadata, cjsPath, cjs });
  }
  // Verify every copy before changing any file. Unknown versions or hashes always fail closed.
  if (apply) for (const item of pending) {
    fs.writeFileSync(item.cjsPath, item.cjs);
    fs.writeFileSync(item.metadataPath, item.patchedMetadata);
  }
  return { version: '0.5.1', copies: pending.length, sourceSha256: sourceHash };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !['--apply', '--check'].includes(process.argv[2])) throw new Error('Usage: node scripts/decoder-compat.mjs --apply|--check');
  console.log(JSON.stringify(verifyDecoder(repository, { apply: process.argv[2] === '--apply' })));
}
