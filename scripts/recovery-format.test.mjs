import test from 'node:test';
import assert from 'node:assert/strict';
import { CopyCounter, validateCatalog, quoteIdentifier, quoteLiteral } from './recovery-format.mjs';

test('COPY counter handles byte boundaries, escaped values, empty tables and Unicode identifiers', () => {
  const counter = new CopyCounter();
  const sql = 'SET search_path = public;\nCOPY "public"."日記" ("id", "value") FROM stdin;\n1\tcafé\\nsecond line\n2\t\\\\.\n\\.\nCOPY "auth"."empty" ("id") FROM stdin;\n\\.\nRESET ALL;\n';
  for (const byte of Buffer.from(sql)) counter.write(Buffer.from([byte]));
  assert.deepEqual(counter.finish(), [{ schema: 'public', table: '日記', rows: 2 }, { schema: 'auth', table: 'empty', rows: 0 }]);
});

test('COPY counter rejects truncated and duplicate targets without retaining large row values', () => {
  const counter = new CopyCounter();
  counter.write(Buffer.from('COPY "public"."test" ("value") FROM stdin;\n' + 'x'.repeat(1_000_000)));
  assert.ok(counter.prefix.length <= 3);
  assert.throws(() => counter.finish(), /Incomplete/);
  const repeated = new CopyCounter();
  repeated.write(Buffer.from('COPY "public"."test" ("value") FROM stdin;\n\\.\n'.repeat(2)));
  assert.throws(() => repeated.finish(), /Duplicate/);
});

test('catalog schema selection excludes all system schemas and unsafe CLI patterns', () => {
  const base = { schemaNames: ['auth', 'public', 'storage'], roles: [], memberships: [], extensions: [], authMigrations: [], storageMigrations: [], integrity: { invalidIndexes: 0, unvalidatedConstraints: 0 }, security: { policies: [], tables: [] } };
  assert.deepEqual(validateCatalog(base), base);
  for (const name of ['pg_catalog', 'information_schema', '*', 'public,auth', 'bad;command', 'supabase_migrations']) {
    assert.throws(() => validateCatalog({ ...base, schemaNames: ['public', name] }));
  }
  assert.throws(() => validateCatalog({ ...base, roles: [{ name: 'postgres', superuser: 'true' }] }));
});

test('identifier and literal quoting preserve quotes as data', () => {
  assert.equal(quoteIdentifier('a"b'), '"a""b"');
  assert.equal(quoteLiteral("a'b"), "'a''b'");
});
