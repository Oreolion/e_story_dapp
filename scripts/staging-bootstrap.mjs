// Builds an atomic fresh-only SQL plan. No credentials, drivers or remote I/O.
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8').replace(/\r\n/g, '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";

export function buildFreshBootstrap() {
  const files = fs.readdirSync(new URL('supabase/migrations/', root)).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort();
  if (files.length !== 24 || files.some((name, index) => !name.startsWith(String(index).padStart(3, '0') + '_'))) throw new Error('STAGING_BOOTSTRAP_MIGRATION_INVENTORY_CHANGED');
  const manifest = { formatVersion: 1, migrations: [], supplements: [] };
  const parts = ['BEGIN;', read('ops/staging/fresh-preconditions.sql'),
    'CREATE SCHEMA IF NOT EXISTS supabase_migrations;',
    'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);'];
  for (const name of ['fresh-preconditions.sql','fresh-schema-gaps.sql','fresh-hardening.sql']) {
    manifest.supplements.push({ file: name, sha256: hash(read('ops/staging/' + name)) });
  }
  for (const file of files) {
    const version = file.slice(0, 3);
    const source = read('supabase/migrations/' + file);
    let sql = source;
    if (version === '014') {
      // This repair is for populated legacy schemas. A fresh bootstrap has no
      // old follows table to repair. Never include a table-deletion operation.
      const start = sql.indexOf('-- Drop old follows table if it has wrong schema');
      const end = sql.indexOf('CREATE TABLE IF NOT EXISTS follows (');
      if (start < 0 || end <= start || hash(sql.slice(start, end)) !== '0f5d9078af935c6682b9ab6e08d000dc43320b0588916e484795003f51a36d2d') throw new Error('STAGING_BOOTSTRAP_014_ADAPTER_CHANGED');
      sql = sql.slice(0, start) + '-- Legacy follows repair omitted for this empty database.\n' + sql.slice(end);
    }
    if (/^BEGIN;\s*$/m.test(sql)) {
      if (!['020','021','022','023'].includes(version) || (sql.match(/^BEGIN;\s*$/gm) ?? []).length !== 1 || (sql.match(/^COMMIT;\s*$/gm) ?? []).length !== 1 || !/\nCOMMIT;\s*$/.test(sql)) throw new Error('STAGING_BOOTSTRAP_TRANSACTION_CHANGED');
      sql = sql.replace(/^BEGIN;\s*$/m, '').replace(/\nCOMMIT;\s*$/, '\n');
    }
    if (/\bDROP\s+(TABLE|DATABASE)\b/i.test(sql)) throw new Error('STAGING_BOOTSTRAP_DESTRUCTIVE_SQL');
    if (version === '016') parts.push(read('ops/staging/fresh-schema-gaps.sql'));
    parts.push(sql);
    parts.push(`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${literal(version)},${literal(file.slice(4,-4))},ARRAY[${literal(sql)}]);`);
    manifest.migrations.push({ version, file, sourceSha256: hash(source), appliedSha256: hash(sql), adapted: sql !== source });
  }
  parts.push(read('ops/staging/fresh-hardening.sql'));
  const manifestJson = JSON.stringify(manifest);
  parts.push('CREATE SCHEMA istory_staging_bootstrap; REVOKE ALL ON SCHEMA istory_staging_bootstrap FROM PUBLIC,anon,authenticated;',
    'CREATE TABLE istory_staging_bootstrap.manifest(id boolean PRIMARY KEY DEFAULT true CHECK(id),metadata jsonb NOT NULL);',
    `INSERT INTO istory_staging_bootstrap.manifest(metadata) VALUES(${literal(manifestJson)}::jsonb);`, 'COMMIT;');
  const sql = parts.join('\n');
  return { sql, sha256: hash(sql), manifest };
}
