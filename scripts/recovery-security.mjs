import { validateCatalog, quoteIdentifier as qi } from './recovery-format.mjs';

export const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(canonical).sort() : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value);
const tableKey = t => JSON.stringify([t.schema, t.table]);
const policyKey = p => JSON.stringify([p.schemaname, p.tablename, p.policyname]);

// Only allowlisted numeric counts leave the private comparison. Never return
// names, expressions, ACL values, SQL or arbitrary error diagnostics.
export function securityDifferenceSummary(expected, actual) {
  const tables = { missing: 0, unexpected: 0, owner: 0, acl: 0, rls: 0, forceRls: 0 };
  const policies = { missing: 0, unexpected: 0, changed: 0 };
  const actualTables = new Map(actual.tables.map(t => [tableKey(t), t]));
  for (const table of expected.tables) {
    const restored = actualTables.get(tableKey(table));
    if (!restored) { tables.missing++; continue; }
    for (const field of ['owner', 'acl', 'rls', 'forceRls']) if (canonical(table[field]) !== canonical(restored[field])) tables[field]++;
    actualTables.delete(tableKey(table));
  }
  tables.unexpected = actualTables.size;
  const actualPolicies = new Map(actual.policies.map(p => [policyKey(p), p]));
  for (const policy of expected.policies) {
    const restored = actualPolicies.get(policyKey(policy));
    if (!restored) policies.missing++;
    else { if (canonical(policy) !== canonical(restored)) policies.changed++; actualPolicies.delete(policyKey(policy)); }
  }
  policies.unexpected = actualPolicies.size;
  return { tables, policies };
}

// The caller supplies extension membership from the isolated target's
// pg_depend catalog, after checking exact extension names/versions. Application
// objects and RLS policies are never repaired by this extension-specific step.
export function extensionSecuritySql(catalog, actual, members) {
  validateCatalog(catalog);
  const actualTables = new Map(actual.tables.map(t => [tableKey(t), t]));
  const expectedTables = new Map(catalog.security.tables.map(t => [tableKey(t), t]));
  const kinds = { r: 'TABLE', p: 'TABLE', v: 'VIEW', m: 'MATERIALIZED VIEW', f: 'FOREIGN TABLE' };
  const commands = [];
  let changedObjects = 0;
  for (const member of members) {
    if (!catalog.extensions.some(e => e.name === member.extension)) throw new Error('RESTORE_EXTENSION_SECURITY_UNSUPPORTED');
    const expected = expectedTables.get(tableKey(member));
    const restored = actualTables.get(tableKey(member));
    if (!expected || !restored || !kinds[member.kind]) throw new Error('RESTORE_EXTENSION_SECURITY_UNSUPPORTED');
    if (canonical(expected) === canonical(restored)) continue;
    const supported = member.extension === 'pg_stat_statements' && member.schema === 'extensions' && ['pg_stat_statements', 'pg_stat_statements_info'].includes(member.table) ||
      member.extension === 'supabase_vault' && member.schema === 'vault' && ['secrets', 'decrypted_secrets'].includes(member.table);
    // Deliberately fail on delegated grant chains or RLS differences instead of
    // inventing grantor semantics or changing access policies to pass a check.
    if (!supported || member.hasColumnAcl || expected.rls !== restored.rls || expected.forceRls !== restored.forceRls ||
      expected.acl.some(a => a.grantor !== expected.owner) || restored.acl.some(a => a.grantor !== restored.owner)) throw new Error('RESTORE_EXTENSION_SECURITY_UNSUPPORTED');
    const object = `${qi(expected.schema)}.${qi(expected.table)}`;
    commands.push(`ALTER ${kinds[member.kind]} ${object} OWNER TO ${qi(expected.owner)};`, `SET LOCAL ROLE ${qi(expected.owner)};`);
    const grantees = new Set(['PUBLIC', ...restored.acl.map(a => a.grantee), ...expected.acl.map(a => a.grantee)]);
    const role = name => name === 'PUBLIC' ? 'PUBLIC' : qi(name);
    commands.push(`REVOKE ALL PRIVILEGES ON TABLE ${object} FROM ${[...grantees].map(role).join(',')} CASCADE;`);
    for (const acl of expected.acl) commands.push(`GRANT ${acl.privilege} ON TABLE ${object} TO ${role(acl.grantee)}${acl.grantable ? ' WITH GRANT OPTION' : ''};`);
    commands.push('RESET ROLE;');
    changedObjects++;
  }
  return { sql: commands.length ? ['BEGIN;', ...commands, 'COMMIT;'].join('\n') : '', changedObjects };
}
