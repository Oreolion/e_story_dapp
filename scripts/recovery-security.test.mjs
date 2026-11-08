import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionSecuritySql, securityDifferenceSummary } from './recovery-security.mjs';

const owner = 'postgres';
const acl = [{ grantor: owner, grantee: owner, privilege: 'SELECT', grantable: false }];
const table = { schema: 'extensions', table: 'pg_stat_statements', owner, rls: false, forceRls: false, acl };
const base = { schemaNames: ['public', 'extensions'], roles: [], memberships: [], extensions: [{ name: 'pg_stat_statements', schema: 'extensions', version: '1.11' }], authMigrations: [], storageMigrations: [], integrity: { invalidIndexes: 0, unvalidatedConstraints: 0 }, security: { tables: [table], policies: [] } };
const member = { schema: table.schema, table: table.table, kind: 'v', extension: 'pg_stat_statements' };

test('extension owner/grant differences produce a scoped transactional restoration plan', () => {
  const actual = structuredClone(base.security);
  actual.tables[0].owner = 'supabase_admin'; actual.tables[0].acl[0].grantor = 'supabase_admin';
  const result = extensionSecuritySql(base, actual, [member]);
  assert.equal(result.changedObjects, 1);
  assert.match(result.sql, /^BEGIN;/);
  assert.match(result.sql, /ALTER VIEW "extensions"\."pg_stat_statements" OWNER TO "postgres"/);
  assert.match(result.sql, /SET LOCAL ROLE "postgres"/);
  assert.match(result.sql, /COMMIT;$/);
  assert.equal(extensionSecuritySql(base, base.security, [member]).sql, '');
});

test('application ACL/RLS changes, unknown members and delegated chains cannot be repaired to pass verification', () => {
  const catalog = structuredClone(base);
  catalog.security.tables[0].schema = 'public'; catalog.security.tables[0].table = 'private_journals';
  const actual = structuredClone(catalog.security); actual.tables[0].acl = [];
  assert.throws(() => extensionSecuritySql(catalog, actual, [{ ...member, schema: 'public', table: 'private_journals' }]), /UNSUPPORTED/);
  const changedRls = structuredClone(base.security); changedRls.tables[0].rls = true;
  assert.throws(() => extensionSecuritySql(base, changedRls, [member]), /UNSUPPORTED/);
  assert.throws(() => extensionSecuritySql(base, { ...base.security, tables: [{ ...table, acl: [] }] }, [{ ...member, hasColumnAcl: true }]), /UNSUPPORTED/);
  const delegated = structuredClone(base); delegated.security.tables[0].acl[0].grantor = 'another_grantor';
  assert.throws(() => extensionSecuritySql(delegated, { ...base.security, tables: [{ ...table, acl: [] }] }, [member]), /UNSUPPORTED/);
  const unsafe = structuredClone(base); unsafe.security.tables[0].acl[0].privilege = 'SELECT; arbitrary SQL';
  assert.throws(() => extensionSecuritySql(unsafe, base.security, [member]), /Invalid recovery security/);
});

test('security differences expose only fixed numeric counts, without names, policy expressions or ACL values', () => {
  const expected = structuredClone(base.security);
  expected.policies.push({ schemaname: 'public', tablename: 'sensitive_table_name', policyname: 'sensitive_policy_name', qual: 'sensitive_expression' });
  const actual = structuredClone(expected); actual.tables[0].owner = 'sensitive_role_name'; actual.tables[0].acl = [];
  actual.policies[0].qual = 'different_sensitive_expression';
  const result = securityDifferenceSummary(expected, actual);
  assert.equal(result.tables.owner, 1); assert.equal(result.tables.acl, 1); assert.equal(result.policies.changed, 1);
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
  assert.ok(Object.values(result).flatMap(Object.values).every(Number.isSafeInteger));
});
