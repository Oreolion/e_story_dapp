-- Read-only catalog inspection. No secrets, customer content or mutations.
-- Run against the intended environment using its authorized SQL interface.
BEGIN READ ONLY;
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND (table_name='stories' AND column_name IN ('id','author_id','revision')
    OR table_name='story_metadata' AND column_name='source_revision'
    OR table_name='payments' AND column_name IN ('activated_expires_at','provider_receipt_id','deferred'))
ORDER BY table_name,column_name;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') AS authenticated_can_write,
  has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS service_any_access
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('ai_jobs','ai_daily_provider_calls','payments','payment_notification_outbox','notifications','auth_identity_links','auth_link_challenges','users');

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('consume_api_quota','admit_ai_text_call','ensure_ai_job','claim_ai_job','complete_ai_job','retry_ai_job','activate_paid_payment','claim_payment_notice','increment_story_likes','finalize_identity_link','consume_wallet_nonce','identity_profile_has_data')
ORDER BY p.proname;
ROLLBACK;
