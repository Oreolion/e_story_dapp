-- Synthetic records only. Every write, including quotas, is rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $probe$
DECLARE
  v_owner uuid := '11000000-0000-4000-8000-000000000001';
  v_story uuid := '22000000-0000-4000-8000-000000000001';
  job public.ai_jobs;
  result jsonb := '{"themes":["work"],"emotional_tone":"reflective","life_domain":"work","intensity_score":0.5,"significance_score":0.6,"people_mentioned":[],"places_mentioned":[],"time_references":[],"brief_insight":"Synthetic observation","actionable_advice":"Consider a short note."}';
BEGIN
  INSERT INTO public.users(id,wallet_address,auth_provider,email,location,website,subscription_plan,subscription_expires_at)
  VALUES(v_owner,NULL,'google','synthetic@example.test','Synthetic','https://example.test','storyteller',now()+interval '30 days');
  INSERT INTO public.stories(id,author_id,title,content)
  VALUES(v_story,v_owner,'Synthetic journal','A synthetic journal entry long enough for analysis. No actual personal information is present.');
  IF NOT EXISTS(SELECT 1 FROM public.stories WHERE id=v_story AND numeric_id IS NOT NULL AND revision=1) THEN
    RAISE EXCEPTION 'BOOTSTRAP_STORY_FAILED';
  END IF;
  SELECT * INTO job FROM public.claim_ai_job(NULL,4,8);
  IF job.id IS NULL OR job.status <> 'running' OR job.attempts <> 1 THEN RAISE EXCEPTION 'BOOTSTRAP_CLAIM_FAILED'; END IF;
  IF NOT public.complete_ai_job(job.id,job.lease_token,result,'{}'::jsonb) THEN RAISE EXCEPTION 'BOOTSTRAP_COMPLETION_FAILED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.story_metadata WHERE story_id=v_story AND source_revision=1) THEN
    RAISE EXCEPTION 'BOOTSTRAP_METADATA_FAILED';
  END IF;
  INSERT INTO public.books(author_id,title,story_ids) VALUES(v_owner,'Synthetic book',ARRAY[v_story]);
  INSERT INTO public.weekly_reflections(user_id,user_wallet,reflection_text,week_start,week_end)
  VALUES(v_owner,NULL,'Synthetic reflection',now()-interval '7 days',now());
  PERFORM public.increment_story_likes(v_story);
  IF NOT EXISTS(SELECT 1 FROM public.stories WHERE id=v_story AND likes=1) THEN RAISE EXCEPTION 'BOOTSTRAP_COUNTER_FAILED'; END IF;
  PERFORM public.delete_user_account_data(v_owner);
  IF EXISTS(SELECT 1 FROM public.users WHERE id=v_owner) OR EXISTS(SELECT 1 FROM public.books WHERE author_id=v_owner)
    OR EXISTS(SELECT 1 FROM public.ai_jobs WHERE owner_id=v_owner) THEN RAISE EXCEPTION 'BOOTSTRAP_DELETION_FAILED'; END IF;
END;
$probe$;
ROLLBACK;
DO $empty$
DECLARE item record; populated boolean;
BEGIN
  FOR item IN SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',item.relname) INTO populated;
    IF populated THEN RAISE EXCEPTION 'BOOTSTRAP_SYNTHETIC_ROWS_RETAINED'; END IF;
  END LOOP;
END;
$empty$;
