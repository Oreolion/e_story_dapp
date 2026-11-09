// This runner accepts only an in-process owned restore target, never a URL.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { targetMigrationQuery } from './recovery-restore.mjs';

const migrations = Object.freeze([
  ['020_durable_ai_jobs.sql', 'fed22f300fa65cc560a0fbc6f9876c3362728c004b961b94e6f96062b2d458be'],
  ['021_atomic_payment_activation.sql', '8bd2cb0c1c6c85c19411a202be77873fb137e38a4c6e0ae3f5c2c4884e00318c'],
  ['022_restrict_counter_rpcs.sql', 'ce601335c836d7ece5c7dd71dd1a9f87eca89b9659791e26ffaf5bb66f695d47'],
  ['023_verified_identity_links.sql', 'c3a90f2d5a9faaee0dc5426245ac00c82f4c57b2e717cff148a06b4ad6e2e18c'],
]);
const failure = category => Object.assign(new Error(category), { code: 'LOCAL_RESTORE_FAILURE', category });

export function reviewedMigrations() {
  return migrations.map(([file, sha256]) => {
    const url = new URL('../supabase/migrations/' + file, import.meta.url);
    const stat = fs.lstatSync(url);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100000) throw failure('REHEARSAL_MIGRATION_IDENTITY_FAILED');
    const sql = fs.readFileSync(url, 'utf8').replaceAll('\r\n', '\n');
    if (createHash('sha256').update(sql).digest('hex') !== sha256) throw failure('REHEARSAL_MIGRATION_IDENTITY_FAILED');
    return { file, sha256, sql };
  });
}

// All snapshots and comparisons stay inside the network-disabled tmpfs database.
// Record text preserves duplicates, NULLs and original JSON text; no row hashes
// or customer values leave PostgreSQL. New columns are deliberately excluded.
export const snapshotSql = `
SET statement_timeout='20s'; SET lock_timeout='5s'; SET search_path=pg_catalog,public;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='019')
    OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version !~ '^0(0[0-9]|1[0-9])$')
    THEN RAISE EXCEPTION 'REHEARSAL_HISTORY_MISMATCH'; END IF;
END $$;
CREATE TEMP TABLE rehearsal_relations(oid oid PRIMARY KEY, schema_name text, table_name text, columns_sql text, attributes jsonb, snapshot_name text, rows bigint);
CREATE TEMP TABLE rehearsal_integrity AS SELECT
  (SELECT count(*) FROM pg_index WHERE NOT indisvalid) invalid_indexes,
  (SELECT count(*) FROM pg_constraint WHERE NOT convalidated) unvalidated_constraints;
DO $$ DECLARE r record; cols text; attrs jsonb; snapshot_name text; row_count bigint; BEGIN
  FOR r IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' ORDER BY c.oid
  LOOP
    SELECT string_agg(format('%I',attname),',' ORDER BY attnum),
      jsonb_agg(jsonb_build_array(attnum,attname,atttypid,atttypmod,attcollation,attnotnull) ORDER BY attnum)
      INTO cols,attrs FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped;
    IF cols IS NULL THEN RAISE EXCEPTION 'REHEARSAL_UNSUPPORTED_TABLE'; END IF;
    snapshot_name:='rehearsal_rows_'||r.oid;
    EXECUTE format('CREATE TEMP TABLE %I AS SELECT ROW(%s)::text AS original_row FROM ONLY %I.%I',snapshot_name,cols,r.nspname,r.relname);
    GET DIAGNOSTICS row_count=ROW_COUNT;
    INSERT INTO rehearsal_relations VALUES(r.oid,r.nspname,r.relname,cols,attrs,snapshot_name,row_count);
  END LOOP;
END $$;
`;

export const preservationSql = `
DO $$ DECLARE r record; attrs jsonb; changed boolean; BEGIN
  FOR r IN SELECT * FROM rehearsal_relations LOOP
    IF to_regclass(format('%I.%I',r.schema_name,r.table_name))::oid IS DISTINCT FROM r.oid THEN RAISE EXCEPTION 'REHEARSAL_RELATION_CHANGED'; END IF;
    SELECT jsonb_agg(jsonb_build_array(attnum,attname,atttypid,atttypmod,attcollation,attnotnull) ORDER BY attnum)
      INTO attrs FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped
      AND attnum IN (SELECT (v->>0)::integer FROM jsonb_array_elements(r.attributes) v);
    IF attrs IS DISTINCT FROM r.attributes THEN RAISE EXCEPTION 'REHEARSAL_COLUMNS_CHANGED'; END IF;
    EXECUTE format('SELECT EXISTS((SELECT original_row FROM pg_temp.%I EXCEPT ALL SELECT ROW(%s)::text FROM ONLY %I.%I) UNION ALL (SELECT ROW(%s)::text FROM ONLY %I.%I EXCEPT ALL SELECT original_row FROM pg_temp.%I))',
      r.snapshot_name,r.columns_sql,r.schema_name,r.table_name,r.columns_sql,r.schema_name,r.table_name,r.snapshot_name) INTO changed;
    IF changed THEN RAISE EXCEPTION 'REHEARSAL_ORIGINAL_VALUES_CHANGED'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM rehearsal_integrity WHERE invalid_indexes<>(SELECT count(*) FROM pg_index WHERE NOT indisvalid)
    OR unvalidated_constraints<>(SELECT count(*) FROM pg_constraint WHERE NOT convalidated)) THEN RAISE EXCEPTION 'REHEARSAL_INTEGRITY_CHANGED'; END IF;
END $$;
`;

const rpcSignatures = [
  'admit_ai_text_call(uuid,text,integer,integer)', 'ensure_ai_job(uuid,uuid)', 'retry_ai_job(uuid,uuid)',
  'claim_ai_job(uuid,integer,integer)', 'complete_ai_job(uuid,uuid,jsonb,jsonb)', 'fail_ai_job(uuid,uuid,text,boolean)',
  'activate_paid_payment(uuid,numeric,uuid)', 'activate_due_payment_credit()', 'claim_payment_notice()',
  'finish_payment_notice(uuid,uuid,boolean)', 'prepare_payment_notice_email(uuid,uuid,jsonb)',
  'increment_story_likes(uuid)', 'decrement_story_likes(uuid)', 'increment_user_followers(uuid)', 'decrement_user_followers(uuid)',
  'identity_profile_has_data(uuid)', 'finalize_identity_link(text,uuid,text,text)', 'consume_wallet_nonce(text,text)',
];
export const permissionsSql = `
DO $$ DECLARE signature text; role_name text; table_name text; fn oid; BEGIN
  FOREACH signature IN ARRAY ARRAY[${rpcSignatures.map(s => "'public." + s + "'").join(',')}] LOOP
    fn:=to_regprocedure(signature);
    IF fn IS NULL OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'REHEARSAL_SERVICE_RPC_DENIED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND prosecdef AND
      (proconfig @> ARRAY['search_path=pg_catalog, public'] OR proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp'])) THEN RAISE EXCEPTION 'REHEARSAL_RPC_CONFIGURATION'; END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(role_name,fn,'EXECUTE') THEN RAISE EXCEPTION 'REHEARSAL_CLIENT_RPC_EXPOSED'; END IF;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND p.proname IN (${rpcSignatures.map(s => "'" + s.split('(')[0] + "'").join(',')})
      AND has_function_privilege(role_name,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'REHEARSAL_CLIENT_RPC_OVERLOAD_EXPOSED'; END IF;
    IF has_function_privilege(role_name,'public.story_revision_guard()','EXECUTE') OR has_function_privilege(role_name,'public.enqueue_story_analysis()','EXECUTE') THEN RAISE EXCEPTION 'REHEARSAL_TRIGGER_EXPOSED'; END IF;
    FOREACH table_name IN ARRAY ARRAY['ai_jobs','ai_daily_provider_calls','payment_notification_outbox','auth_identity_links','auth_link_challenges','notifications'] LOOP
      IF has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'REHEARSAL_PRIVATE_TABLE_EXPOSED'; END IF;
    END LOOP;
    FOREACH table_name IN ARRAY ARRAY['users','payments'] LOOP
      IF has_table_privilege(role_name,'public.'||table_name,'INSERT,UPDATE,DELETE,TRUNCATE')
        OR has_any_column_privilege(role_name,'public.'||table_name,'INSERT,UPDATE') THEN RAISE EXCEPTION 'REHEARSAL_CLIENT_WRITE_EXPOSED'; END IF;
    END LOOP;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['ai_jobs','ai_daily_provider_calls','payment_notification_outbox','auth_identity_links','auth_link_challenges','users','payments','notifications'] LOOP
    IF table_name=ANY(ARRAY['ai_jobs','ai_daily_provider_calls','payment_notification_outbox','auth_identity_links','auth_link_challenges'])
      AND (NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||table_name) AND relrowsecurity)
      OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=table_name)) THEN RAISE EXCEPTION 'REHEARSAL_PRIVATE_RLS_FAILED'; END IF;
    IF NOT has_table_privilege('service_role','public.'||table_name,'SELECT') OR NOT has_table_privilege('service_role','public.'||table_name,'INSERT')
      OR NOT has_table_privilege('service_role','public.'||table_name,'UPDATE') OR NOT has_table_privilege('service_role','public.'||table_name,'DELETE') THEN RAISE EXCEPTION 'REHEARSAL_SERVICE_TABLE_DENIED'; END IF;
  END LOOP;
END $$;
`;

// Synthetic records exist only in a transaction rolled back before comparison.
// These exercise stored functions; they never send inference, email or money.
export const probesSql = `
BEGIN;
SET LOCAL ROLE service_role;
DO $$ DECLARE v_owner uuid:=gen_random_uuid(); v_story uuid:=gen_random_uuid(); v_payment uuid:=gen_random_uuid(); receipt_id uuid:=gen_random_uuid();
  auth_id uuid:=gen_random_uuid(); wallet text:='0x'||replace(gen_random_uuid()::text,'-','')||'12345678'; challenge text:=repeat(replace(gen_random_uuid()::text,'-',''),2);
  nonce text:=gen_random_uuid()::text; j public.ai_jobs; notice public.payment_notification_outbox; expiry timestamptz; ok boolean; before_likes integer;
BEGIN
  INSERT INTO public.users(id,wallet_address) VALUES(v_owner,wallet);
  INSERT INTO public.stories(id,author_id,title,content) VALUES(v_story,v_owner,'Synthetic release rehearsal','Synthetic release rehearsal content with sufficient length for deterministic analysis admission and no private data.');
  SELECT * INTO j FROM public.ensure_ai_job(v_owner,v_story);
  IF j.id IS NULL OR j.source_revision IS DISTINCT FROM 1::bigint OR (SELECT count(*) FROM public.ai_jobs a WHERE a.story_id=v_story AND a.owner_id=v_owner)<>1 THEN RAISE EXCEPTION 'REHEARSAL_JOB_ADMISSION_FAILED'; END IF;
  SELECT * INTO j FROM public.claim_ai_job(j.id,100,100);
  IF j.id IS NULL OR j.status IS DISTINCT FROM 'running' OR j.attempts IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'REHEARSAL_JOB_CLAIM_FAILED'; END IF;
  IF public.fail_ai_job(j.id,j.lease_token,'provider_failure',false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'REHEARSAL_JOB_FENCE_FAILED'; END IF;
  IF public.fail_ai_job(j.id,j.lease_token,'provider_failure',false) IS DISTINCT FROM false THEN RAISE EXCEPTION 'REHEARSAL_JOB_REPLAY_FAILED'; END IF;
  SELECT likes INTO before_likes FROM public.stories s WHERE s.id=v_story;
  PERFORM public.increment_story_likes(v_story); PERFORM public.decrement_story_likes(v_story);
  IF (SELECT s.likes FROM public.stories s WHERE s.id=v_story) IS DISTINCT FROM before_likes THEN RAISE EXCEPTION 'REHEARSAL_COUNTER_FAILED'; END IF;
  INSERT INTO public.payments(id,user_id,plan,payment_address,amount_expected) VALUES(v_payment,v_owner,'storyteller','synthetic-'||v_payment,2.99);
  PERFORM public.activate_paid_payment(v_payment,2.99,receipt_id);
  SELECT subscription_expires_at INTO expiry FROM public.users u WHERE u.id=v_owner;
  PERFORM public.activate_paid_payment(v_payment,2.99,receipt_id);
  IF (SELECT u.subscription_expires_at FROM public.users u WHERE u.id=v_owner) IS DISTINCT FROM expiry
    OR expiry IS NULL OR expiry NOT BETWEEN now()+interval '29 days' AND now()+interval '31 days'
    OR (SELECT count(*) FROM public.payment_notification_outbox p WHERE p.payment_id=v_payment)<>1 THEN RAISE EXCEPTION 'REHEARSAL_PAYMENT_REPLAY_FAILED'; END IF;
  SELECT * INTO notice FROM public.claim_payment_notice();
  IF notice.payment_id IS DISTINCT FROM v_payment THEN RAISE EXCEPTION 'REHEARSAL_NOTICE_FENCE_FAILED'; END IF;
  IF public.finish_payment_notice(v_payment,notice.lease_token,true) IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'REHEARSAL_NOTICE_FENCE_FAILED'; END IF;
  IF public.finish_payment_notice(v_payment,notice.lease_token,true) IS DISTINCT FROM false THEN RAISE EXCEPTION 'REHEARSAL_NOTICE_REPLAY_FAILED'; END IF;
  INSERT INTO public.auth_nonces(address,nonce) VALUES(wallet,nonce);
  IF public.consume_wallet_nonce(wallet,nonce) IS DISTINCT FROM true THEN RAISE EXCEPTION 'REHEARSAL_NONCE_FAILED'; END IF;
  IF public.consume_wallet_nonce(wallet,nonce) IS DISTINCT FROM false THEN RAISE EXCEPTION 'REHEARSAL_NONCE_REPLAY_FAILED'; END IF;
  INSERT INTO public.auth_link_challenges(challenge_hash,owner_id,initiator_subject,direction,wallet_address,origin,message,expires_at)
    VALUES(challenge,v_owner,v_owner,'wallet_to_google',wallet,'https://synthetic.invalid','Synthetic release identity proof',now()+interval '5 minutes');
  SELECT EXISTS(SELECT 1 FROM public.finalize_identity_link(challenge,auth_id,'synthetic-'||auth_id,'https://synthetic.invalid') u WHERE u.id=v_owner) INTO ok;
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'REHEARSAL_LINK_FAILED'; END IF;
  BEGIN
    PERFORM public.finalize_identity_link(challenge,auth_id,'synthetic-'||auth_id,'https://synthetic.invalid');
    RAISE EXCEPTION 'REHEARSAL_LINK_REPLAY_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'link_restart_required' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK;
`;

export function rehearseMigrations(target) {
  const reviewed = reviewedMigrations();
  try {
    const sql = '\\echo REHEARSAL_STAGE_HISTORY\n' + snapshotSql + reviewed.map(m => '\\echo REHEARSAL_STAGE_' + m.file.slice(0, 3) + '\n' + m.sql).join('\n')
      + '\n\\echo REHEARSAL_STAGE_PERMISSIONS\n' + permissionsSql + '\n\\echo REHEARSAL_STAGE_PROBES\n' + probesSql
      + '\n\\echo REHEARSAL_STAGE_PRESERVATION\n' + preservationSql + `
      SELECT jsonb_build_object('status','ISOLATED_MIGRATIONS_VERIFIED','preservedTables',(SELECT count(*) FROM rehearsal_relations),
        'preservedRows',(SELECT coalesce(sum(rows),0) FROM rehearsal_relations),'rpcChecks',${rpcSignatures.length},'functionalProbes',true);`;
    const result = JSON.parse(targetMigrationQuery(target, sql).trim().split(/\r?\n/).at(-1));
    if (result.status !== 'ISOLATED_MIGRATIONS_VERIFIED' || !Number.isSafeInteger(result.preservedTables) || result.preservedTables<1 || !Number.isSafeInteger(result.preservedRows) || result.preservedRows<0 || result.rpcChecks!==rpcSignatures.length || result.functionalProbes!==true) throw failure('REHEARSAL_INVALID_RESULT');
    return { ...result, migrations: reviewed.map(({ file, sha256 }) => ({ file, sha256 })),
      limits: ['Only the restored snapshot is changed; migration history is preserved, not marked as deployed.', 'Database functions and effective grants only; hosted application, provider, cutover and rollback acceptance remain separate.'] };
  } catch (error) {
    if (error?.code === 'LOCAL_RESTORE_FAILURE' && /^REHEARSAL_(HISTORY|020|021|022|023|PERMISSIONS|PROBES|PRESERVATION)_FAILED$/.test(error.category)) throw error;
    throw failure('REHEARSAL_MIGRATIONS_FAILED');
  }
}
