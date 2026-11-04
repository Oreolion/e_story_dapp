import assert from 'node:assert/strict';
import test from 'node:test';
import { adjudicateAudit } from './audit-runtime.mjs';

function fixture() {
  return {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { high: 2, critical: 0, moderate: 0, low: 0, info: 0, total: 2 } },
    vulnerabilities: {
      wallet: { severity: 'high', via: ['zod'], nodes: ['node_modules/wallet'] },
      zod: { severity: 'high', nodes: ['node_modules/@base-org/account/node_modules/zod', 'node_modules/@reown/appkit-wallet/node_modules/zod'], via: [{
        name: 'zod', dependency: 'zod', severity: 'high', source: 1243066,
        range: '<4.6.6', url: 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5',
      }] },
    },
  };
}

test('only the exact reviewed advisory and propagated findings are candidates for mitigation', () => {
  const report = adjudicateAudit(fixture());
  assert.deepEqual(report.verifiedBackportCandidates.sort(), ['wallet', 'zod']);
  assert.deepEqual(report.unresolved, []);
});

test('new, changed, critical and additional-node findings remain blocking', () => {
  for (const mutate of [
    audit => { audit.vulnerabilities.zod.via[0].url += '-new'; },
    audit => { audit.vulnerabilities.zod.via[0].range = '<5'; },
    audit => { audit.vulnerabilities.zod.nodes.push('node_modules/unknown/zod'); },
    audit => { audit.vulnerabilities.zod.via[0].severity = 'critical'; },
    audit => { audit.vulnerabilities.zod.via.push({ name: 'zod', dependency: 'zod', severity: 'high', url: 'https://example.invalid/new' }); },
    audit => { audit.vulnerabilities.wallet.via.push('unknown'); },
  ]) {
    const audit = fixture();
    mutate(audit);
    assert.ok(adjudicateAudit(audit).unresolved.length > 0);
  }
});

test('missing or malformed audit data fails closed', () => {
  for (const value of [{ error: {} }, { auditReportVersion: 1 }, { ...fixture(), metadata: {} }]) assert.throws(() => adjudicateAudit(value));
  const audit = fixture();
  audit.metadata.vulnerabilities.high = 0;
  assert.throws(() => adjudicateAudit(audit), /counts/);
  const cycle = fixture();
  cycle.vulnerabilities.wallet.via = ['wallet'];
  assert.ok(adjudicateAudit(cycle).unresolved.includes('wallet'));
});
