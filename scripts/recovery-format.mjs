// No customer values are retained by this COPY row counter.
export class CopyCounter {
  constructor() { this.prefix = ''; this.length = 0; this.active = null; this.tables = []; }
  write(chunk) {
    for (const byte of chunk) {
      if (byte === 10) { this.line(); continue; }
      this.length++;
      if (this.prefix.length < (this.active ? 3 : 32768)) this.prefix += String.fromCharCode(byte);
    }
  }
  line() {
    if (this.active) {
      if (this.length === 2 && this.prefix === '\\.') { this.tables.push(this.active); this.active = null; }
      else this.active.rows++;
    } else if (this.prefix.startsWith('COPY ')) {
      if (this.length > 32768) throw new Error('Unsupported COPY header.');
      const header = Buffer.from(this.prefix, 'latin1').toString('utf8');
      const match = /^COPY "((?:[^"]|"")+)"\."((?:[^"]|"")+)" \(.+\) FROM stdin;$/.exec(header);
      if (!match) throw new Error('Unsupported COPY header.');
      this.active = { schema: match[1].replaceAll('""', '"'), table: match[2].replaceAll('""', '"'), rows: 0 };
    }
    this.prefix = ''; this.length = 0;
  }
  finish() {
    if (this.length) this.line();
    if (this.active) throw new Error('Incomplete COPY stream.');
    const names = this.tables.map(t => JSON.stringify([t.schema, t.table]));
    if (new Set(names).size !== names.length) throw new Error('Duplicate COPY target.');
    return this.tables;
  }
}

export const catalogSql = `SELECT jsonb_build_object(
 'schemaNames', (SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_catalog.pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema','supabase_migrations')),
 'roles', (SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls)) FROM pg_catalog.pg_roles WHERE rolname !~ '^pg_' AND rolname !~ '^cli_login_'),
 'memberships', (SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option)), '[]') FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member WHERE r.rolname !~ '^cli_login_' AND m.rolname !~ '^cli_login_'),
 'extensions', (SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)) FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace),
 'integrity', jsonb_build_object('invalidIndexes',(SELECT count(*) FROM pg_catalog.pg_index WHERE NOT indisvalid),'unvalidatedConstraints',(SELECT count(*) FROM pg_catalog.pg_constraint WHERE NOT convalidated)),
 'security', jsonb_build_object(
   'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]') FROM pg_catalog.pg_policies p WHERE schemaname !~ '^pg_' AND schemaname NOT IN ('information_schema','supabase_migrations')),
   'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_catalog.pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)), '[]') FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a))), '[]')
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname NOT IN ('information_schema','supabase_migrations'))),
 'authMigrations', (SELECT coalesce(jsonb_agg(version), '[]') FROM auth.schema_migrations),
 'storageMigrations', (SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]') FROM storage.migrations m)
) AS recovery_catalog`;

export function validateCatalog(catalog) {
  const list = (value, max = 1000) => Array.isArray(value) && value.length <= max;
  const name = value => typeof value === 'string' && /^[a-z_][a-z0-9_]{0,62}$/.test(value);
  const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 63 && !/[\0\r\n]/.test(value);
  if (!catalog || !list(catalog.schemaNames) || !catalog.schemaNames.includes('public') ||
    catalog.schemaNames.some(n => !name(n) || n.startsWith('pg_') || ['information_schema', 'supabase_migrations'].includes(n)) ||
    new Set(catalog.schemaNames).size !== catalog.schemaNames.length || !list(catalog.roles) ||
    !list(catalog.memberships, 10000) || !list(catalog.extensions) || !list(catalog.authMigrations, 10000) || !list(catalog.storageMigrations, 10000)) throw new Error('Invalid recovery catalog.');
  const attributes = ['superuser', 'inherit', 'createRole', 'createDb', 'login', 'replication', 'bypassRls'];
  if (catalog.roles.some(r => !identifier(r.name) || r.name.startsWith('pg_') || r.name.startsWith('cli_login_') || attributes.some(k => typeof r[k] !== 'boolean')) ||
    new Set(catalog.roles.map(r => r.name)).size !== catalog.roles.length ||
    catalog.memberships.some(m => !identifier(m.role) || !identifier(m.member) || ['admin', 'inherit', 'set'].some(k => typeof m[k] !== 'boolean')) ||
    catalog.extensions.some(e => !identifier(e.name) || !name(e.schema) || typeof e.version !== 'string' || !/^[a-zA-Z0-9_.+-]{1,64}$/.test(e.version)) ||
    catalog.authMigrations.some(v => typeof v !== 'string' || !/^\d{1,32}$/.test(v)) ||
    catalog.storageMigrations.some(m => !m || Object.keys(m).some(k => !['id', 'name', 'hash', 'executed_at'].includes(k)) || !Number.isSafeInteger(m.id) || typeof m.name !== 'string' || m.name.length > 1024 || (m.hash !== null && (typeof m.hash !== 'string' || m.hash.length > 256)) || (m.executed_at !== null && (typeof m.executed_at !== 'string' || m.executed_at.length > 64))) ||
    !catalog.integrity || ['invalidIndexes', 'unvalidatedConstraints'].some(k => !Number.isSafeInteger(catalog.integrity[k]) || catalog.integrity[k] < 0) ||
    !catalog.security || !list(catalog.security.policies, 10000) || !list(catalog.security.tables, 10000) ||
    new Set(catalog.extensions.map(e => e.name)).size !== catalog.extensions.length) throw new Error('Invalid recovery catalog.');
  const privileges = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']);
  if (catalog.security.tables.some(t => !t || !identifier(t.schema) || !identifier(t.table) || !identifier(t.owner) ||
    !catalog.schemaNames.includes(t.schema) || typeof t.rls !== 'boolean' || typeof t.forceRls !== 'boolean' || !list(t.acl) ||
    t.acl.some(a => !a || !identifier(a.grantor) || !identifier(a.grantee) || !privileges.has(a.privilege) || typeof a.grantable !== 'boolean')) ||
    catalog.security.policies.some(p => !p || !identifier(p.schemaname) || !identifier(p.tablename) || !identifier(p.policyname) ||
      !list(p.roles) || p.roles.some(r => !identifier(r)) || !['PERMISSIVE', 'RESTRICTIVE'].includes(p.permissive) ||
      !['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(p.cmd) || ['qual', 'with_check'].some(k => p[k] !== null && (typeof p[k] !== 'string' || p[k].length > 65536))) ||
    new Set(catalog.security.tables.map(t => JSON.stringify([t.schema, t.table]))).size !== catalog.security.tables.length ||
    new Set(catalog.security.policies.map(p => JSON.stringify([p.schemaname, p.tablename, p.policyname]))).size !== catalog.security.policies.length) throw new Error('Invalid recovery security metadata.');
  return catalog;
}

export const quoteIdentifier = value => '"' + value.replaceAll('"', '""') + '"';
export const quoteLiteral = value => "'" + value.replaceAll("'", "''") + "'";
