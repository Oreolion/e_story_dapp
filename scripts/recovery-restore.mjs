import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { prepareEncryption, plumbing, stop, exited, readPassphrase, projectRef, isOutsideRepository } from './recovery-export.mjs';
import { catalogSql, validateCatalog, quoteIdentifier as qi, quoteLiteral as ql } from './recovery-format.mjs';
import { canonical, securityDifferenceSummary, extensionSecuritySql } from './recovery-security.mjs';

export const restoreImage = 'public.ecr.aws/supabase/postgres@sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const files = ['roles.sql.gpg', 'schema.sql.gpg', 'data.sql.gpg', 'migration-schema.sql.gpg', 'migration-data.sql.gpg', 'catalog.json.gpg'];
const ownedTargets = new Map();
const docker = (args, input, maxBuffer = 2 * 1024 * 1024) => spawnSync('docker', args, { input, env: plumbing(), encoding: 'utf8', timeout: 30000, maxBuffer, windowsHide: true });
const failure = category => Object.assign(new Error(category), { code: 'LOCAL_RESTORE_FAILURE', category });
function requireSuccess(result, code) { if (result.status !== 0) throw failure(code); return result.stdout; }

export function checkRestoreEngine() {
  requireSuccess(docker(['info', '--format', '{{.ServerVersion}}']), 'RESTORE_DOCKER_UNAVAILABLE');
  requireSuccess(docker(['image', 'inspect', restoreImage, '--format', '{{.Id}}']), 'RESTORE_PINNED_IMAGE_MISSING');
}

function inspectTarget(name) {
  const rows = JSON.parse(requireSuccess(docker(['inspect', name]), 'RESTORE_TARGET_INSPECT_FAILED'));
  const info = rows[0];
  if (!info || info.Id !== ownedTargets.get(name) || info.Config.Image !== restoreImage ||
    info.Config.Labels?.['istory.rehearsal'] !== 'isolated-recovery-v2' || info.HostConfig.NetworkMode !== 'none' ||
    info.HostConfig.ReadonlyRootfs !== true || info.Config.User !== '100:101' ||
    info.HostConfig.Memory !== 512 * 1024 * 1024 || info.HostConfig.MemorySwap !== info.HostConfig.Memory ||
    info.HostConfig.NanoCpus !== 1_000_000_000 || info.HostConfig.PidsLimit !== 64 || !info.HostConfig.CapDrop?.includes('ALL') ||
    !info.HostConfig.SecurityOpt?.some(s => s === 'no-new-privileges' || s === 'no-new-privileges=true') || info.HostConfig.LogConfig?.Type !== 'none' ||
    info.HostConfig.Privileged || (info.Mounts ?? []).some(m => m.Type !== 'tmpfs') ||
    Object.keys(info.HostConfig.PortBindings ?? {}).length || (info.HostConfig.Binds?.length ?? 0)) throw failure('RESTORE_TARGET_ISOLATION_FAILED');
  return info;
}

export async function createRestoreTarget() {
  checkRestoreEngine();
  const name = 'istory-recovery-' + randomUUID();
  const command = 'initdb -D /var/lib/postgresql/data -U supabase_admin --auth=trust --encoding=UTF8 --locale=C >/dev/null 2>&1 && exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp -c shared_buffers=32MB -c max_connections=10 -c max_wal_size=64MB -c min_wal_size=32MB -c shared_preload_libraries=pg_stat_statements -c log_statement=none -c log_min_messages=panic -c log_min_error_statement=panic';
  const id = requireSuccess(docker(['create', '--name', name, '--label', 'istory.rehearsal=isolated-recovery-v2', '--network', 'none',
    '--read-only', '--user', '100:101', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '64', '--log-driver', 'none',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=256m,uid=100,gid=101,mode=0700',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777', '--entrypoint', '/bin/sh', restoreImage, '-c', command]), 'RESTORE_TARGET_CREATE_FAILED').trim();
  ownedTargets.set(name, id);
  try {
    inspectTarget(name);
    requireSuccess(docker(['start', id]), 'RESTORE_TARGET_START_FAILED');
    const readyDeadline = Date.now() + 60000;
    while (Date.now() < readyDeadline) {
      if (docker(['exec', id, 'pg_isready', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres']).status === 0) return name;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw failure('RESTORE_TARGET_NOT_READY');
  } catch (error) { stopRestoreTarget(name); throw error; }
}

export function stopRestoreTarget(name) {
  const id = ownedTargets.get(name);
  if (!id || requireSuccess(docker(['inspect', name, '--format', '{{.Id}}']), 'RESTORE_TARGET_INSPECT_FAILED').trim() !== id) throw failure('RESTORE_TARGET_IDENTITY_FAILED');
  requireSuccess(docker(['stop', '--time', '5', id]), 'RESTORE_TARGET_STOP_FAILED');
  ownedTargets.delete(name);
  // Only this run's ephemeral database is discarded; encrypted backups remain.
}

export function targetQuery(name, sql) {
  const { Id: id } = inspectTarget(name);
  return requireSuccess(docker(['exec', '-i', id, 'psql', '-X', '-q', '-t', '-A', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql), 'RESTORE_CHECK_FAILED');
}

export function bootstrapSql(catalog) {
  validateCatalog(catalog);
  // Exact reserved-role filter from CLI 2.120.0 migration/dump.go. Custom roles
  // are created by roles.sql; precreating them would make that import fail.
  const reserved = /^(anon|authenticated|authenticator|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)$/;
  const roles = catalog.roles.filter(r => r.name !== 'supabase_admin' && reserved.test(r.name)).map(r => `CREATE ROLE ${qi(r.name)} NOLOGIN;`);
  const schemas = catalog.schemaNames.map(n => `CREATE SCHEMA IF NOT EXISTS ${qi(n)};`);
  const extensions = catalog.extensions.filter(e => e.name !== 'plpgsql').map(e => `CREATE EXTENSION IF NOT EXISTS ${qi(e.name)} WITH SCHEMA ${qi(e.schema)} VERSION ${ql(e.version)};`);
  return [...roles, ...schemas, ...extensions, 'CREATE PUBLICATION supabase_realtime;'].join('\n');
}

function metadataSql(catalog) {
  const memberships = catalog.memberships.map(m => `GRANT ${qi(m.role)} TO ${qi(m.member)} WITH ADMIN ${m.admin ? 'TRUE' : 'FALSE'}, INHERIT ${m.inherit ? 'TRUE' : 'FALSE'}, SET ${m.set ? 'TRUE' : 'FALSE'};`);
  const auth = catalog.authMigrations.length ? `INSERT INTO auth.schema_migrations(version) VALUES ${catalog.authMigrations.map(v => `(${ql(v)})`).join(',')};` : '';
  const storage = catalog.storageMigrations.length ? `INSERT INTO storage.migrations SELECT * FROM jsonb_populate_recordset(NULL::storage.migrations, ${ql(JSON.stringify(catalog.storageMigrations))}::jsonb);` : '';
  const attributes = catalog.roles.map(r => `ALTER ROLE ${qi(r.name)} WITH ${r.superuser ? '' : 'NO'}SUPERUSER ${r.inherit ? '' : 'NO'}INHERIT ${r.createRole ? '' : 'NO'}CREATEROLE ${r.createDb ? '' : 'NO'}CREATEDB ${r.login ? '' : 'NO'}LOGIN ${r.replication ? '' : 'NO'}REPLICATION ${r.bypassRls ? '' : 'NO'}BYPASSRLS;`);
  return [...memberships, 'SET session_replication_role = replica;', auth, storage, ...attributes, 'RESET ALL;'].join('\n');
}

export async function verifyBackupDirectory(directory) {
  const manifestPath = path.join(directory, 'manifest.json');
  const manifestStat = fs.lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 32768) throw failure('RESTORE_INVALID_MANIFEST');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.formatVersion !== 2 || manifest.projectRef !== projectRef || manifest.status !== 'EXPORTED_NOT_RESTORE_VERIFIED' || !Array.isArray(manifest.parts) || manifest.parts.length !== files.length) throw failure('RESTORE_COMPLETE_SCHEMA_EXPORT_REQUIRED');
  for (const file of files) {
    const entries = manifest.parts.filter(p => p.file === file);
    if (entries.length !== 1 || !Number.isSafeInteger(entries[0].bytes) || entries[0].bytes <= 0 || entries[0].bytes > 1024 ** 3 || !/^[a-f0-9]{64}$/.test(entries[0].sha256)) throw failure('RESTORE_INVALID_MANIFEST');
    const full = path.join(directory, file);
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entries[0].bytes) throw failure('RESTORE_CIPHERTEXT_MISMATCH');
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(full)) hash.update(chunk);
    if (hash.digest('hex') !== entries[0].sha256) throw failure('RESTORE_CIPHERTEXT_MISMATCH');
  }
  return manifest;
}

export async function restoreBackup({ directory, gpg = 'gpg', prefix }) {
  directory = fs.realpathSync(directory);
  if (!isOutsideRepository(directory)) throw failure('RESTORE_DIRECTORY_MUST_BE_OUTSIDE_GIT');
  const startedAt = new Date().toISOString();
  const manifest = await verifyBackupDirectory(directory);
  const encryption = prepareEncryption(gpg);
  let target;
  let client;
  let timer;
  try {
    for (const file of files) fs.copyFileSync(path.join(directory, file), path.join(encryption.cwd, file), fs.constants.COPYFILE_EXCL);
    const catalogResult = spawnSync(gpg, [...encryption.decryptArgs, 'catalog.json.gpg'], { cwd: encryption.cwd, env: encryption.env, input: prefix, timeout: 30000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    if (catalogResult.status !== 0) throw failure('RESTORE_PASSPHRASE_OR_CATALOG_INVALID');
    let data;
    try { data = JSON.parse(catalogResult.stdout.toString('utf8')); } finally { catalogResult.stdout.fill(0); }
    if (data.formatVersion !== 2 || data.projectRef !== projectRef || !Array.isArray(data.copyCounts) || data.copyCounts.length > 10000 || data.copyCounts.some(t => typeof t.schema !== 'string' || typeof t.table !== 'string' || !t.schema.length || !t.table.length || Buffer.byteLength(t.schema) > 63 || Buffer.byteLength(t.table) > 63 || /[\0\r\n]/.test(t.schema + t.table) || !Number.isSafeInteger(t.rows) || t.rows < 0) || new Set(data.copyCounts.map(t => JSON.stringify([t.schema, t.table]))).size !== data.copyCounts.length) throw failure('RESTORE_INVALID_CATALOG');
    validateCatalog(data.catalog);
    target = await createRestoreTarget();
    console.log('Restoring into an isolated temporary database. SQL and database logs will not be displayed.');
    const { Id: targetId } = inspectTarget(target);
    client = spawn('docker', ['exec', '-i', targetId, 'psql', '-X', '-q', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { env: plumbing(), stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    client.stdin.on('error', () => {});
    const clientExit = exited(client);
    timer = setTimeout(() => { client.stdin.destroy(); stop(client); }, 600000);
    const write = text => new Promise((resolve, reject) => {
      if (client.stdin.destroyed) { reject(failure('RESTORE_SQL_FAILED')); return; }
      client.stdin.write(text, error => error ? reject(failure('RESTORE_SQL_FAILED')) : resolve());
    });
    await write('BEGIN;\nSET standard_conforming_strings=on;\n' + bootstrapSql(data.catalog) + '\n');
    for (const file of files.filter(f => f.endsWith('.sql.gpg'))) {
      const cipher = spawn(gpg, [...encryption.decryptArgs, file], { cwd: encryption.cwd, env: encryption.env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      const cipherExit = exited(cipher);
      const stageTimer = setTimeout(() => { stop(cipher); stop(client); }, 120000);
      try {
        cipher.stdin.on('error', () => {});
        cipher.stdin.end(prefix);
        // A per-part sink keeps pipeline's lifecycle listeners off the shared
        // SQL connection and applies backpressure without closing it early.
        await pipeline(cipher.stdout, new Writable({ write(chunk, encoding, callback) {
          if (client.stdin.destroyed) callback(failure('RESTORE_SQL_FAILED'));
          else client.stdin.write(chunk, encoding, callback);
        } }));
        if (await cipherExit !== 0) throw failure('RESTORE_DECRYPTION_FAILED');
        await write('\n');
      } finally { clearTimeout(stageTimer); stop(cipher); }
    }
    await write(metadataSql(data.catalog) + '\nCOMMIT;\n');
    client.stdin.end();
    if (await clientExit !== 0) throw failure('RESTORE_SQL_FAILED');
    clearTimeout(timer);
    const checks = data.copyCounts;
    const checkDeadline = Date.now() + 120000;
    for (let offset = 0; offset < checks.length; offset += 100) {
      if (Date.now() > checkDeadline) throw failure('RESTORE_CHECK_TIMEOUT');
      const batch = checks.slice(offset, offset + 100);
      const actual = JSON.parse(targetQuery(target, `SELECT jsonb_build_array(${batch.map(t => `(SELECT count(*)::text FROM ${qi(t.schema)}.${qi(t.table)})`).join(',')});`));
      if (actual.some((count, index) => count !== String(batch[index].rows))) throw failure('RESTORE_ROW_COUNT_MISMATCH');
    }
    let actualCatalog = JSON.parse(targetQuery(target, catalogSql));
    for (const key of ['schemaNames', 'roles', 'memberships', 'extensions', 'authMigrations', 'storageMigrations', 'integrity']) {
      if (canonical(actualCatalog[key]) !== canonical(data.catalog[key])) throw failure('RESTORE_CATALOG_MISMATCH_' + key.toUpperCase());
    }
    const members = JSON.parse(targetQuery(target, `SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'kind',c.relkind,'extension',e.extname,'hasColumnAcl',EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attacl IS NOT NULL))), '[]') FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class c ON c.oid=d.objid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_class'::regclass AND d.refclassid='pg_extension'::regclass AND d.deptype='e' AND c.relkind IN ('r','p','v','m','f');`));
    let extensionSecurity;
    try { extensionSecurity = extensionSecuritySql(data.catalog, actualCatalog.security, members); }
    catch { throw failure('RESTORE_EXTENSION_SECURITY_UNSUPPORTED'); }
    if (extensionSecurity.sql) {
      targetQuery(target, extensionSecurity.sql);
      actualCatalog = JSON.parse(targetQuery(target, catalogSql));
    }
    if (canonical(actualCatalog.security) !== canonical(data.catalog.security)) {
      console.error(JSON.stringify({ error: 'RESTORE_SECURITY_DIFFERENCES', differences: securityDifferenceSummary(data.catalog.security, actualCatalog.security) }));
      throw failure('RESTORE_CATALOG_MISMATCH_SECURITY');
    }
    const integrity = actualCatalog.integrity;
    const result = { status: 'DATABASE_RESTORE_VERIFIED', projectRef, startedAt, finishedAt: new Date().toISOString(), image: restoreImage, parts: manifest.parts, checkedTables: checks.length,
      checkedRows: checks.reduce((sum, t) => sum + t.rows, 0), integrity, restoredExtensionSecurityObjects: extensionSecurity.changedObjects, limits: ['Database import, COPY row counts and catalog comparison only; application/hosted acceptance and production migration cutover are separate gates.', 'Media bytes, role passwords, Vault root keys and external provider configuration are not restored.', 'CLI-excluded internal data, event triggers, role settings and publication configuration require separate review.'] };
    // Publish success evidence only after plaintext database disposal succeeds.
    stopRestoreTarget(target); target = undefined;
    console.log('Stopped this run\'s temporary restore database; encrypted backup files were retained.');
    const evidence = path.join(path.dirname(directory), path.basename(directory) + '.restore-' + randomUUID() + '.json');
    fs.writeFileSync(evidence, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: result.status, checkedTables: result.checkedTables, checkedRows: result.checkedRows, evidence }));
    return { ...result, evidence };
  } finally {
    clearTimeout(timer);
    stop(client);
    if (target) { stopRestoreTarget(target); console.log('Stopped this run\'s temporary restore database; encrypted backup files were retained.'); }
    encryption.close();
  }
}

async function main() {
  const options = {};
  for (let n = 2; n < process.argv.length; n += 2) {
    const key = process.argv[n];
    if (key === '--preflight' && !options.preflight) { options.preflight = true; n--; continue; }
    if (!['--directory', '--gpg'].includes(key) || !process.argv[n + 1] || options[key]) throw failure('RESTORE_INVALID_ARGUMENTS');
    options[key] = process.argv[n + 1];
  }
  if (!options['--directory'] || !path.isAbsolute(options['--directory'])) throw failure('RESTORE_INVALID_ARGUMENTS');
  const directory = fs.realpathSync(options['--directory']);
  if (!isOutsideRepository(directory)) throw failure('RESTORE_DIRECTORY_MUST_BE_OUTSIDE_GIT');
  await verifyBackupDirectory(directory);
  checkRestoreEngine();
  if (options.preflight) { const encryption = prepareEncryption(options['--gpg'] ?? 'gpg'); encryption.close(); console.log('Restore preflight passed. No database connection or backup decryption was made.'); return; }
  const prefix = await readPassphrase();
  try { await restoreBackup({ directory, gpg: options['--gpg'] ?? 'gpg', prefix }); } finally { prefix.fill(0); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { if (error?.code === 'LOCAL_RESTORE_FAILURE') console.error(JSON.stringify({ error: error.category })); console.error('Local restore failed. No SQL or credentials were displayed. Production and encrypted backups were not modified.'); process.exitCode = 1; });
}
