// Temporary, version-preserving adaptation of upstream a0ebf970f2d752e5f58527cd2942ff48be4f46bd.
// Only leading declared upper bounds are accelerated. Unconstrained schemas still need caller input limits.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');

function replaceOnce(source, expression, replacement) {
  let count = 0;
  const result = source.replace(expression, (...args) => { count++; return typeof replacement === 'function' ? replacement(...args) : replacement; });
  if (count !== 1) throw new Error(`Backport anchor matched ${count} times; review the upstream source.`);
  return result;
}

export function transformZod(source, kind) {
  if (kind === 'v3') {
    const start = source.indexOf('class ZodArray');
    const invalid = source.slice(start).match(/return ([\w.]*INVALID);/)?.[1];
    if (!invalid) throw new Error('Zod 3 invalid-result helper missing.');
    for (const [field, conditional] of [['exactLength', true], ['maxLength', false], ['maxSize', false]]) {
      const expression = new RegExp(`(message: def\\.${field}\\.message,\\s*}\\);\\s*)(status\\.dirty\\(\\);)`, 'g');
      source = replaceOnce(source, expression, (_all, before, dirty) => before + (conditional ? `if (tooBig) return ${invalid};\n` + dirty : `return ${invalid};`));
    }
    return source;
  }
  if (kind === 'next-v3') {
    source = replaceOnce(source, /message:a\.exactLength\.message\}\);s\.dirty\(\)/g,
      'message:a.exactLength.message});if(e)return i.INVALID;s.dirty()');
    source = replaceOnce(source, /message:a\.maxLength\.message\}\);s\.dirty\(\)/g,
      'message:a.maxLength.message});return i.INVALID');
    return replaceOnce(source, /message:a\.maxSize\.message\}\);t\.dirty\(\)/g,
      'message:a.maxSize.message});return i.INVALID');
  }
  if (kind === 'v4' || kind === 'v4-ts') {
    // The older v4 runChecks executes `when` checks after an aborted parse. Wrap `run`
    // after deferred initialization so an oversized raw value never reaches later checks.
    const typed = kind === 'v4-ts';
    const helper = `
function istoryCapSize(inst${typed ? ': any' : ''}, size${typed ? ': (value: any) => number' : ''}) {
  const caps${typed ? ': [number, any][]' : ''} = [];
  for (const ch of inst._zod.def.checks ?? []) {
    const d = ch._zod.def;
    if (!/_(length|size)$|_equals$/.test(d.check)) break;
    const max = d.maximum ?? d.length ?? d.size;
    if (max >= 0) caps.push([max, ch]);
  }
  if (!caps.length) return;
  (inst._zod.deferred ??= []).push(() => {
    const run = inst._zod.run;
    inst._zod.run = (payload${typed ? ': any' : ''}, ctx${typed ? ': any' : ''}) => {
      const n = size(payload.value);
      if (!ctx?.skipChecks && ctx?.direction !== 'backward') {
        for (const [max, ch] of caps) {
          if (n > max && ch._zod.def.when?.(payload)) {
            const start = payload.issues.length;
            ch._zod.check(payload);
            if (payload.issues.length > start) {
              payload.issues[start].continue = false;
              return payload;
            }
          }
        }
      }
      return run(payload, ctx);
    };
  });
}
`;
    for (const [name, size] of [['Array', 'Array.isArray(value) ? value.length : -1'], ['Map', 'value instanceof Map ? value.size : -1'], ['Set', 'value instanceof Set ? value.size : -1']]) {
      const marker = `core.$constructor("$Zod${name}", (inst, def) => {`;
      const start = source.indexOf(marker);
      if (start < 0) throw new Error(`Missing v4 ${name} constructor.`);
      const end = source.indexOf('\n});', start);
      if (end < 0) throw new Error(`Missing v4 ${name} terminator.`);
      source = source.slice(0, end) + `\n  istoryCapSize(inst, (value${typed ? ': any' : ''}) => ${size});` + source.slice(end);
    }
    // A declaration can safely appear after exports in both CommonJS and ESM.
    return source + helper;
  }
  throw new Error(`Unknown Zod backport format: ${kind}`);
}

export function verifyZod(root = repository, { apply = false } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'security/zod-size-backport.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const actual = Object.entries(lock.packages).filter(([name]) => /(?:^|\/)node_modules\/zod$/.test(name));
  if (actual.length !== manifest.packages.length) throw new Error('Zod package inventory changed; backport review required.');
  for (const item of manifest.packages) {
    const entry = lock.packages[item.path];
    if (!entry || entry.version !== item.version || entry.integrity !== item.integrity) throw new Error(`Unreviewed Zod dependency: ${item.path}`);
    if (hash(fs.readFileSync(path.join(root, item.path, 'package.json'))) !== item.packageJsonSha256) throw new Error(`Unreviewed Zod exports: ${item.path}`);
  }
  const next = lock.packages['node_modules/next'];
  if (next.version !== manifest.next.version || next.integrity !== manifest.next.integrity) throw new Error('Next vendored parser changed; review backport retirement.');
  const pending = [];
  for (const item of manifest.files) {
    const filename = path.join(root, item.path);
    const source = fs.readFileSync(filename, 'utf8');
    const actualHash = hash(source);
    if (actualHash === item.patchedSha256) continue;
    if (actualHash !== item.originalSha256) throw new Error(`Unreviewed Zod source: ${item.path}`);
    const patched = transformZod(source, item.kind);
    if (hash(patched) !== item.patchedSha256) throw new Error(`Zod backport differs from reviewed output: ${item.path}`);
    if (!apply) throw new Error('Zod size backport missing. Run postinstall or node scripts/zod-size-backport.mjs --apply after --ignore-scripts.');
    pending.push([filename, patched]);
  }
  if (apply) for (const [filename, patched] of pending) fs.writeFileSync(filename, patched);
  return { advisory: manifest.advisory, packages: actual.length, files: manifest.files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !['--apply', '--check'].includes(process.argv[2])) throw new Error('Usage: node scripts/zod-size-backport.mjs --apply|--check');
  console.log(JSON.stringify(verifyZod(repository, { apply: process.argv[2] === '--apply' })));
}
