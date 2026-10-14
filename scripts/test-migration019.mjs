// Isolated PostgreSQL 17 rehearsal. Never connects to Supabase or publishes a port.
// Start: docker run -d --name istory-migration019-rehearsal-20261014 --network none
//        --memory 384m --cpus 1 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { transactionSql, verificationSql } from './apply-migration019.mjs';

const container = 'istory-migration019-rehearsal-20261014';
const migration = readFileSync(new URL('../supabase/migrations/019_create_content_safety_and_account_deletion.sql', import.meta.url), 'utf8');
function sql(database, input) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}
function parallelSql(database, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At']);
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(input);
  });
}
// Cluster roles model Supabase's default grants, including the dangerous
// anon/authenticated function defaults that REVOKE FROM PUBLIC alone misses.
sql('postgres', `DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`);
const user = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const wallet = '10000000-0000-0000-0000-000000000003';
for (const type of ['text', 'uuid']) {
  const db = `migration019_${type}_${Date.now()}`;
  sql('postgres', `CREATE DATABASE ${db};`);
  sql(db, `
    CREATE SCHEMA storage;
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    INSERT INTO storage.buckets VALUES('avatars','avatars',true,NULL,NULL);
    CREATE TABLE users(id uuid PRIMARY KEY,email text,wallet_address text UNIQUE,followers_count integer DEFAULT 0);
    CREATE TABLE stories(id uuid PRIMARY KEY,author_id ${type},author_wallet text REFERENCES users(wallet_address) ON DELETE CASCADE, parent_story_id uuid REFERENCES stories(id) ON DELETE SET NULL,likes integer DEFAULT 0,comments_count integer DEFAULT 0);
    CREATE TABLE comments(id uuid PRIMARY KEY,author_id uuid REFERENCES users(id) ON DELETE CASCADE,author_wallet text REFERENCES users(wallet_address),story_id uuid REFERENCES stories(id) ON DELETE CASCADE);
    CREATE TABLE follows(follower_id uuid REFERENCES users(id) ON DELETE CASCADE,following_id uuid REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(follower_id,following_id));
    CREATE TABLE notifications(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id) ON DELETE CASCADE,related_user_id uuid REFERENCES users(id) ON DELETE SET NULL,story_id uuid REFERENCES stories(id) ON DELETE SET NULL);
    CREATE TABLE story_collections(id uuid PRIMARY KEY,author_id uuid);
    CREATE TABLE collection_stories(collection_id uuid REFERENCES story_collections(id) ON DELETE CASCADE,story_id uuid REFERENCES stories(id) ON DELETE CASCADE);
    CREATE TABLE books(id uuid PRIMARY KEY,author_id uuid REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE waitlist(email text);
    CREATE TABLE auth_nonces(address text);
    CREATE TABLE user_achievements(wallet_address text);
    CREATE TABLE user_activity(wallet_address text);
    CREATE TABLE verification_logs(id uuid PRIMARY KEY,story_id uuid REFERENCES stories(id) ON DELETE CASCADE,workflow_run_id text,status text,error_message text,created_at timestamptz,updated_at timestamptz);
    ${['story_metadata','verified_metrics'].map(table => `CREATE TABLE ${table}(id uuid PRIMARY KEY,story_id uuid REFERENCES stories(id) ON DELETE CASCADE);`).join('\n')}
    ${['likes','saved_stories','unlocked_content'].map(table => `CREATE TABLE ${table}(user_id uuid REFERENCES users(id) ON DELETE CASCADE,story_id uuid REFERENCES stories(id) ON DELETE CASCADE);`).join('\n')}
    ${['payments','habits','daily_logs','weekly_reflections'].map(table => `CREATE TABLE ${table}(user_id uuid REFERENCES users(id) ON DELETE CASCADE);`).join('\n')}
  `);
  sql(db, transactionSql(migration));
  assert.ok(Object.values(JSON.parse(sql(db, verificationSql(migration)))).every(value => value === true));
  assert.equal(sql(db, `SELECT statements[1] = $test019$${migration}$test019$ FROM supabase_migrations.schema_migrations WHERE version='019';`), 't');
  assert.throws(() => sql(db, transactionSql(migration)), /already recorded/);
  sql(db, `BEGIN; ${migration} COMMIT;`); // safe rerun
  assert.equal(sql(db, `SELECT count(*) FROM pg_class WHERE relname IN ('content_reports','user_blocks','api_rate_limits') AND relrowsecurity;`), '3');
  for (const role of ['anon', 'authenticated']) {
    assert.equal(sql(db, `SELECT bool_or(has_function_privilege('${role}',oid,'EXECUTE')) FROM pg_proc WHERE proname IN ('consume_api_quota','block_user','delete_user_account_data');`), 'f');
  }
  assert.equal(sql(db, `SELECT bool_and(has_function_privilege('service_role',oid,'EXECUTE')) FROM pg_proc WHERE proname IN ('consume_api_quota','block_user','delete_user_account_data');`), 't');
  assert.equal(sql(db, `SELECT public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] FROM storage.buckets WHERE id='avatars';`), 't');
  sql(db, `INSERT INTO users VALUES('${user}','Delete@Example.test',NULL,1),('${other}','keep@example.test','0xkeep',1),('${wallet}','wallet@example.test','0xwallet',0);`);
  const results = await Promise.all(Array.from({ length: 12 }, () => parallelSql(db, `SET ROLE service_role; SELECT allowed FROM consume_api_quota('${user}','parallel',5,3600);`)));
  assert.equal(results.filter(result => result.endsWith('t')).length, 5, 'exactly five concurrent quota grants');
  assert.equal(sql(db, `SELECT request_count FROM api_rate_limits WHERE user_id='${user}' AND action='parallel';`), '12');
  sql(db, `UPDATE api_rate_limits SET window_started_at=now()-interval '2 hours' WHERE action='parallel';`);
  assert.equal(sql(db, `SELECT allowed AND remaining=4 FROM consume_api_quota('${user}','parallel',5,3600);`), 't');
  assert.throws(() => sql(db, `SELECT * FROM consume_api_quota('${user}','null',NULL,3600);`), /positive/);
  sql(db, `INSERT INTO follows VALUES('${user}','${other}'),('${other}','${user}'); SELECT block_user('${user}','${other}'); SELECT block_user('${user}','${other}');`);
  assert.equal(sql(db, `SELECT count(*) FROM follows;`), '0');
  assert.equal(sql(db, `SELECT sum(followers_count) FROM users;`), '0');
  assert.throws(() => sql(db, `SELECT block_user('${user}','${user}');`), /themselves/);
  sql(db, `
    INSERT INTO stories(id,author_id,author_wallet,parent_story_id) VALUES('20000000-0000-0000-0000-000000000001','${user}',NULL,NULL),('20000000-0000-0000-0000-000000000002','${other}','0xkeep','20000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000003',NULL,'0xwallet',NULL);
    UPDATE stories SET likes=1,comments_count=2 WHERE id='20000000-0000-0000-0000-000000000002';
    INSERT INTO likes VALUES('${user}','20000000-0000-0000-0000-000000000002');
    INSERT INTO user_achievements VALUES('0xWALLET'),('0xkeep');
    INSERT INTO user_activity VALUES('0xwallet'),('0xkeep');
    INSERT INTO comments VALUES('30000000-0000-0000-0000-000000000001','${other}','0xkeep','20000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002','${user}',NULL,'20000000-0000-0000-0000-000000000002'),('30000000-0000-0000-0000-000000000003',NULL,'0xwallet','20000000-0000-0000-0000-000000000002');
    INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES('${other}','story','20000000-0000-0000-0000-000000000001','spam'),('${other}','comment','30000000-0000-0000-0000-000000000001','spam'),('${other}','comment','30000000-0000-0000-0000-000000000002','spam'),('${other}','comment','30000000-0000-0000-0000-000000000003','spam'),('${user}','user','${other}','spam'),('${other}','user','${user}','spam'),('${other}','story','20000000-0000-0000-0000-000000000002','spam');
    INSERT INTO verification_logs(id,story_id) VALUES(gen_random_uuid(),'20000000-0000-0000-0000-000000000001');
    INSERT INTO story_collections VALUES(gen_random_uuid(),'${user}');
    INSERT INTO books VALUES(gen_random_uuid(),'${user}');
    INSERT INTO waitlist VALUES('delete@example.test'),('keep@example.test');
    INSERT INTO auth_nonces VALUES('0xWALLET'),('0xkeep');
    INSERT INTO follows VALUES('${user}','${other}'); UPDATE users SET followers_count=1 WHERE id='${other}';
    ${['payments','habits','daily_logs','weekly_reflections'].map(table => `INSERT INTO ${table} VALUES('${user}');`).join('\n')}
  `);
  sql(db, `BEGIN; SELECT delete_user_account_data('${user}'); ROLLBACK;`);
  assert.equal(sql(db, `SELECT count(*) FROM users WHERE id='${user}';`), '1', 'rollback preserves account');
  sql(db, `SELECT delete_user_account_data('${user}'); SELECT delete_user_account_data('${user}'); SELECT delete_user_account_data('${wallet}');`);
  assert.equal(sql(db, `SELECT count(*) FROM users;`), '1');
  assert.equal(sql(db, `SELECT count(*) FROM stories;`), '1', 'another author survives');
  assert.equal(sql(db, `SELECT parent_story_id IS NULL FROM stories;`), 't');
  assert.equal(sql(db, `SELECT likes=0 AND comments_count=0 FROM stories;`), 't');
  assert.equal(sql(db, `SELECT count(*) FROM comments;`), '0');
  assert.equal(sql(db, `SELECT count(*) FROM content_reports;`), '1', 'unrelated report survives');
  assert.equal(sql(db, `SELECT count(*) FROM verification_logs;`), '0');
  assert.equal(sql(db, `SELECT count(*) FROM api_rate_limits;`), '0');
  assert.equal(sql(db, `SELECT followers_count FROM users;`), '0');
  assert.equal(sql(db, `SELECT count(*) FROM waitlist;`), '1');
  assert.equal(sql(db, `SELECT count(*) FROM auth_nonces;`), '1');
  assert.equal(sql(db, `SELECT count(*) FROM user_achievements;`), '1');
  assert.equal(sql(db, `SELECT count(*) FROM user_activity;`), '1');
  for (const table of ['story_collections','books','payments','habits','daily_logs','weekly_reflections']) {
    assert.equal(sql(db, `SELECT count(*) FROM ${table};`), '0', table);
  }
  console.log(`PASS PostgreSQL 17 ${type} authors: permissions/RLS, rerun, concurrent quotas, reset, block, rollback, email/wallet deletion, child cleanup, unrelated-account preservation`);
}
