import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyDecoder } from './decoder-compat.mjs';
import { verifyZod } from './zod-size-backport.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const zodNodes = ['node_modules/@base-org/account/node_modules/zod', 'node_modules/@reown/appkit-wallet/node_modules/zod'];

export function adjudicateAudit(audit) {
  if (audit.error || audit.auditReportVersion !== 2 || !audit.vulnerabilities || !audit.metadata?.vulnerabilities) throw new Error('Runtime audit was unavailable or malformed.');
  const high = Object.entries(audit.vulnerabilities).filter(([, entry]) => ['high', 'critical'].includes(entry.severity));
  const mitigated = [];
  const unresolved = [];
  const zod = audit.vulnerabilities.zod;
  const nodesMatch = zod && JSON.stringify([...zod.nodes].sort()) === JSON.stringify(zodNodes);
  for (const [name, entry] of high) {
    const pending = [name];
    const visited = new Set();
    const leaves = [];
    let unknown = false;
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      const item = audit.vulnerabilities[current];
      if (!item || !Array.isArray(item.via) || !item.via.length) { unknown = true; continue; }
      for (const via of item.via) {
        if (typeof via === 'string') pending.push(via);
        else if (via && typeof via === 'object' && typeof via.url === 'string' && typeof via.severity === 'string') leaves.push(via);
        else unknown = true;
      }
    }
    const severeLeaves = leaves.filter(item => ['high', 'critical'].includes(item.severity));
    const reviewed = item => item.name === 'zod' && item.dependency === 'zod'
      && item.url === 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'
      && item.source === 1243066 && item.range === '<4.6.6' && item.severity === 'high';
    if (!unknown && entry.severity === 'high' && nodesMatch && severeLeaves.length && severeLeaves.every(reviewed)) mitigated.push(name);
    else unresolved.push(name);
  }
  // Counts must agree with the individual records, including an empty report.
  const counts = audit.metadata.vulnerabilities;
  if (!Number.isInteger(counts.high) || counts.high < 0 || !Number.isInteger(counts.critical) || counts.critical < 0 || counts.high + counts.critical !== high.length) throw new Error('Runtime audit severity counts do not match its records.');
  return { rawCounts: counts, verifiedBackportCandidates: mitigated, unresolved };
}

function main() {
  const directory = path.join(root, 'output/dependency-security');
  fs.mkdirSync(directory, { recursive: true });
  const npm = process.env.npm_execpath;
  if (!npm || !fs.existsSync(npm)) throw new Error('Run through npm run audit:runtime so the installed npm executable is explicit.');
  const raw = spawnSync(process.execPath, [npm, 'audit', '--omit=dev', '--package-lock-only', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  fs.writeFileSync(path.join(directory, 'raw-npm-audit.json'), raw.stdout ?? '');
  if (raw.error || ![0, 1].includes(raw.status)) throw new Error('Runtime npm audit failed; raw output was preserved.');
  const audit = JSON.parse(raw.stdout);
  const assessment = adjudicateAudit(audit);
  const bindings = { decoder: verifyDecoder(), zod: verifyZod() };
  // A hash claim alone is insufficient: execute the actual installed parser regressions.
  const regressions = spawnSync(process.execPath, ['--test', 'scripts/decoder-compat.test.mjs', 'scripts/zod-size-backport.test.mjs', 'scripts/hono-security.test.mjs', 'scripts/audit-runtime.test.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true,
    env: Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(name => process.env[name]).map(name => [name, process.env[name]])),
  });
  fs.writeFileSync(path.join(directory, 'backport-regressions.log'), (regressions.stdout ?? '') + (regressions.stderr ?? ''));
  const testsPassed = !regressions.error && regressions.status === 0;
  const report = {
    capturedAt: new Date().toISOString(), candidate: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null,
    node: process.version, lockfileSha256: sha256(fs.readFileSync(path.join(root, 'package-lock.json'))),
    rawAuditSha256: sha256(raw.stdout), rawAuditExitCode: raw.status,
    manifestSha256: sha256(fs.readFileSync(path.join(root, 'security/zod-size-backport.json'))),
    ...assessment, bindings, testsPassed,
    decision: testsPassed && !assessment.unresolved.length ? 'PASS_WITH_VERIFIED_BACKPORT' : 'NO_GO',
  };
  fs.writeFileSync(path.join(directory, 'assessment.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.decision === 'NO_GO') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
