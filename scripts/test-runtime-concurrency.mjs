// Real PostgreSQL 17, independent connections, synthetic data only. Uses the
// existing CI rehearsal container; never accepts a URL or host credentials.
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const container = process.env.ISTORY_REHEARSAL_CONTAINER ?? 'istory-migration019-rehearsal-20261014';
assert.ok(container === 'istory-migration019-rehearsal-20261014' || /^istory-runtime-rehearsal-[a-z0-9-]+$/.test(container), 'Only a dedicated rehearsal container may be selected');
const inspect = spawnSync('docker', ['inspect', '--format', '{{.Config.Image}}|{{.HostConfig.NetworkMode}}|{{index .Config.Labels "istory.rehearsal"}}', container], { encoding: 'utf8', timeout: 15000, windowsHide: true });
assert.equal(inspect.status, 0, 'The dedicated rehearsal container must be running');
assert.equal(inspect.stdout.trim(), 'postgres@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f|none|runtime', 'Refuse an unlabelled container, different image or network access');

const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
function connection(database, input, barrier) {
  const child = spawn('docker', ['exec', '-i', '-e', 'PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=5000', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], { windowsHide: true });
  let output = '', error = '';
  let resolveBarrier, rejectBarrier, barrierSeen = false;
  const ready = new Promise((resolve, reject) => { resolveBarrier = resolve; rejectBarrier = reject; });
  if (!barrier) resolveBarrier();
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Rehearsal connection exceeded 25 seconds')); }, 25000);
    child.stdout.on('data', chunk => { output += chunk; if (barrier && output.includes(`${barrier}\n`)) { barrierSeen = true; resolveBarrier(); } });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', failure => { clearTimeout(timer); reject(failure); });
    child.on('close', code => { clearTimeout(timer); if (barrier && !barrierSeen) rejectBarrier(new Error('Admission barrier was not reached')); if (code === 0) resolve(output.trim()); else reject(new Error(error || `psql exited ${code}`)); });
    child.stdin.on('error', () => {}); // The process error/exit is authoritative.
    child.stdin.end(input);
  });
  // A failed first connection must also release a waiter for its barrier.
  done.catch(failure => { if (barrier) rejectBarrier(failure); });
  return { done, ready };
}
const sql = (database, input) => connection(database, input).done;
const uid = index => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const sid = index => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

await sql('postgres', `DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;`);

for (const ownerType of ['uuid', 'text']) {
  const database = `runtime_${ownerType}_${Date.now()}`;
  await sql('postgres', `CREATE DATABASE ${database};`);
  await sql(database, `CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid'; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
  const base = migration('000_create_base_tables.sql');
  const ownerAnchor = 'author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE';
  assert.ok(base.includes(ownerAnchor), 'Historical schema adapter must match the actual fixture');
  await sql(database, ownerType === 'text' ? base.replace(ownerAnchor, 'author_id TEXT NOT NULL') : base);
  for (const name of ['003_add_oauth_fields.sql', '009_create_auth_nonces_table.sql', '001_create_weekly_reflections.sql']) await sql(database, migration(name));
  await sql(database, "ALTER TABLE stories ADD COLUMN story_type text DEFAULT 'personal_journal'; ALTER TABLE stories ADD COLUMN parent_story_id uuid REFERENCES stories(id); ALTER TABLE story_metadata ADD COLUMN actionable_advice text;");
  for (const name of ['012_add_subscriptions_and_payments.sql', '010_create_notifications_table.sql', '017_add_subscription_notification_type.sql']) await sql(database, migration(name));
  const safety = migration('019_create_content_safety_and_account_deletion.sql');
  const safetyBoundary = safety.indexOf('CREATE OR REPLACE FUNCTION block_user');
  assert.ok(safetyBoundary > 0, 'Quota fixture boundary must exist');
  await sql(database, safety.slice(0, safetyBoundary));
  // Reproduce the live catalog differences with synthetic records only.
  await sql(database, 'ALTER TABLE users DROP COLUMN updated_at; ALTER TABLE stories ALTER COLUMN author_id DROP NOT NULL; ALTER TABLE stories ALTER COLUMN title DROP NOT NULL; ALTER TABLE stories ALTER COLUMN content DROP NOT NULL; ALTER TABLE stories ADD COLUMN numeric_id bigserial NOT NULL; INSERT INTO stories(author_id,title,content) VALUES(NULL,NULL,NULL);');
  for (const name of ['020_durable_ai_jobs.sql', '021_atomic_payment_activation.sql', '018_atomic_counter_rpcs.sql', '022_restrict_counter_rpcs.sql', '023_verified_identity_links.sql']) await sql(database, migration(name));
  for (let owner = 1; owner <= 5; owner++) {
    await sql(database, `INSERT INTO users(id,wallet_address,subscription_plan,subscription_expires_at) VALUES('${uid(owner)}','synthetic-${owner}','storyteller',now()+interval '30 days');`);
    for (let entry = 1; entry <= 3; entry++) await sql(database, `INSERT INTO stories(id,author_id,title,content) VALUES('${sid(owner * 10 + entry)}','${uid(owner)}','Synthetic','A synthetic concurrency fixture with enough text to admit analysis without containing private user data.');`);
  }

  // Hold the first transaction open after admission. The second independent
  // connection starts while that transaction still owns the advisory lock.
  const first = connection(database, `BEGIN; SELECT allowed FROM admit_ai_text_call('${uid(1)}','enhancement',1,8); SELECT 'admitted_barrier'; SELECT pg_sleep(3); SELECT extract(epoch FROM clock_timestamp()); COMMIT;`, 'admitted_barrier');
  await first.ready;
  const second = sql(database, `SELECT extract(epoch FROM clock_timestamp()); SELECT allowed FROM admit_ai_text_call('${uid(2)}','tracker',1,8);`);
  const [firstOutput, secondOutput] = await Promise.all([first.done, second]);
  const firstLines = firstOutput.split(/\r?\n/).filter(Boolean), secondLines = secondOutput.split(/\r?\n/).filter(Boolean);
  assert.equal(secondLines[1], 'f', 'Concurrent admission must observe the committed reservation');
  assert.equal(firstLines[0], 't', 'First admission must succeed');
  assert.ok(Number(secondLines[0]) < Number(firstLines.at(-1)), 'Second connection must enter SQL before the first commits; a sequential run is not concurrency evidence');
  assert.equal(await sql(database, 'SELECT reserved_calls FROM ai_daily_provider_calls;'), '1');

  const claims = await Promise.all(Array.from({ length: 15 }, () => sql(database, 'SELECT id FROM claim_ai_job(NULL,100,100);')));
  const claimed = claims.filter(Boolean);
  assert.equal(claimed.length, 8, 'Exactly eight global leases');
  assert.equal(new Set(claimed).size, 8, 'No duplicate claimed job');
  assert.equal(await sql(database, "SELECT max(n) FROM (SELECT count(*) n FROM ai_jobs WHERE status='running' GROUP BY owner_id) q;"), '2', 'At most two leases per owner');
  assert.equal(await sql(database, 'SELECT reserved_calls FROM ai_daily_provider_calls;'), '9', 'Each claimed attempt reserves a call');

  const payment = sid(99), receipt = sid(100);
  await sql(database, `INSERT INTO payments(id,user_id,plan,payment_address,amount_expected) VALUES('${payment}','${uid(1)}','storyteller','synthetic-receipt',2.99);`);
  await Promise.all(Array.from({ length: 12 }, () => sql(database, `SELECT activate_paid_payment('${payment}',2.99,'${receipt}');`)));
  assert.equal(await sql(database, 'SELECT count(*) FROM payment_notification_outbox;'), '1', 'Concurrent payment replay creates one notice');
  assert.equal(await sql(database, `SELECT subscription_expires_at BETWEEN now()+interval '59 days' AND now()+interval '61 days' FROM users WHERE id='${uid(1)}';`), 't', 'Payment replay grants one extension');

  await sql(database, "INSERT INTO auth_nonces(address,nonce) VALUES('synthetic-wallet','synthetic-nonce');");
  const nonceResults = await Promise.all(Array.from({ length: 8 }, () => sql(database, "SELECT consume_wallet_nonce('synthetic-wallet','synthetic-nonce');")));
  assert.equal(nonceResults.filter(result => result === 't').length, 1, 'Exactly one concurrent nonce consumer');
  const wallet = `0x${'a'.repeat(40)}`, challenge = 'c'.repeat(64);
  await sql(database, `UPDATE users SET wallet_address='${wallet}' WHERE id='${uid(5)}'; INSERT INTO auth_link_challenges(challenge_hash,owner_id,initiator_subject,direction,wallet_address,origin,message,expires_at) VALUES('${challenge}','${uid(5)}','${uid(5)}','wallet_to_google','${wallet}','https://synthetic.invalid','Synthetic verified identity proof',now()+interval '5 minutes');`);
  const links = await Promise.allSettled(Array.from({ length: 6 }, () => sql(database, `SELECT id FROM finalize_identity_link('${challenge}','${uid(6)}','synthetic-google','https://synthetic.invalid');`)));
  assert.equal(links.filter(result => result.status === 'fulfilled' && result.value === uid(5)).length, 1, 'Exactly one concurrent challenge completion');
  const rejectedLinks = links.filter(result => result.status === 'rejected');
  assert.equal(rejectedLinks.length, 5);
  assert.ok(rejectedLinks.every(result => /link_restart_required/.test(result.reason.message)), 'Replayed challenges fail for the expected reason');
  assert.equal(await sql(database, 'SELECT count(*) FROM auth_identity_links;'), '1', 'One authoritative mapping');
  await sql(database, 'UPDATE stories SET likes=1 WHERE author_id IS NULL;');
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await sql(database, `SELECT bool_or(has_function_privilege('${role}',oid,'EXECUTE')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('claim_ai_job','admit_ai_text_call','finalize_identity_link','consume_wallet_nonce');`), 'f', 'Untrusted roles cannot invoke privileged RPCs');
  }
  console.log(`PASS real PostgreSQL 17 ${ownerType}: observed legacy catalog, overlapping admission, global/per-owner lease bounds, unique claims, attempt accounting, concurrent payment replay, single-use nonce/challenge, RPC grants`);
}
