-- Additive migration. Apply only after isolated rehearsal and release approval.
-- Story content is never placed in the job payload or a telemetry event.
BEGIN;
-- The observed deployed users table predates this shared runtime field.
-- Payment activation and verified linking must not assume the fresh-schema DDL.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.story_metadata ADD COLUMN IF NOT EXISTS source_revision bigint;
CREATE TABLE public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  source_revision bigint NOT NULL,
  task text NOT NULL DEFAULT 'analysis' CHECK(task='analysis'),
  prompt_version text NOT NULL DEFAULT 'analysis-v2',
  model_version text NOT NULL DEFAULT 'gemini-2.5-flash',
  schema_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry_wait','succeeded','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  quota_reserved boolean NOT NULL DEFAULT false,
  available_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  result jsonb,
  usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,story_id,source_revision,task,prompt_version,model_version,schema_version)
);
CREATE INDEX ai_jobs_dispatch ON public.ai_jobs(status,available_at,created_at);
CREATE INDEX ai_jobs_owner ON public.ai_jobs(owner_id,story_id,source_revision);
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
CREATE TABLE public.ai_daily_provider_calls (usage_day date PRIMARY KEY, reserved_calls integer NOT NULL DEFAULT 0 CHECK(reserved_calls>=0));
ALTER TABLE public.ai_daily_provider_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_daily_provider_calls FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ai_daily_provider_calls TO service_role;

CREATE FUNCTION public.ensure_ai_job(p_owner_id uuid,p_story_id uuid) RETURNS public.ai_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.stories; j public.ai_jobs;
BEGIN
  -- Historical deployments store author_id as TEXT; newer schemas use UUID.
  -- Compare without casting legacy rows, and keep job/quota identities UUID.
  SELECT * INTO s FROM public.stories WHERE id=p_story_id AND author_id::text=p_owner_id::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Story not found'; END IF;
  IF char_length(btrim(s.content))<50 OR char_length(s.content)>50000 THEN RETURN NULL; END IF;
  INSERT INTO public.ai_jobs(owner_id,story_id,source_revision) VALUES(p_owner_id,s.id,s.revision)
  ON CONFLICT(owner_id,story_id,source_revision,task,prompt_version,model_version,schema_version) DO NOTHING;
  SELECT * INTO j FROM public.ai_jobs WHERE story_id=s.id AND source_revision=s.revision
    AND prompt_version='analysis-v2' AND model_version='gemini-2.5-flash' AND schema_version=1;
  RETURN j;
END $$;
CREATE FUNCTION public.story_revision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE admitted boolean;
BEGIN
  IF TG_OP='INSERT' THEN NEW.revision:=1;
  ELSIF NEW.author_id IS DISTINCT FROM OLD.author_id THEN RAISE EXCEPTION 'Story owner is immutable';
  ELSIF ROW(NEW.content,NEW.title,NEW.story_type) IS DISTINCT FROM ROW(OLD.content,OLD.title,OLD.story_type) THEN NEW.revision:=OLD.revision+1;
  ELSE NEW.revision:=OLD.revision; END IF;
  -- Do not reject likes/counters or edits to another field because unchanged
  -- historical content exceeds a limit introduced by this migration.
  IF ((TG_OP='INSERT' OR NEW.content IS DISTINCT FROM OLD.content) AND char_length(NEW.content)>50000)
    OR ((TG_OP='INSERT' OR NEW.title IS DISTINCT FROM OLD.title) AND char_length(NEW.title)>200)
    THEN RAISE EXCEPTION 'Story text limit exceeded'; END IF;
  IF TG_OP='INSERT' OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    SELECT q.allowed INTO admitted FROM public.consume_api_quota(NEW.author_id::text::uuid,'story_write_day',100,86400) q;
    IF admitted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Story write quota exceeded'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.enqueue_story_analysis() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    UPDATE public.ai_jobs SET status='cancelled',error_code='source_changed',updated_at=now()
      WHERE story_id=NEW.id AND source_revision<>NEW.revision AND status IN ('queued','running','retry_wait');
    -- Keep author annotations and historical fields; clients hide revision 0.
    IF TG_OP='UPDATE' THEN UPDATE public.story_metadata SET source_revision=0 WHERE story_id=NEW.id; END IF;
    PERFORM public.ensure_ai_job(NEW.author_id::text::uuid,NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER story_revision BEFORE INSERT OR UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.story_revision_guard();
CREATE TRIGGER story_analysis_job AFTER INSERT OR UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.enqueue_story_analysis();

CREATE FUNCTION public.claim_ai_job(p_job_id uuid DEFAULT NULL,p_daily_limit integer DEFAULT 100,p_total_limit integer DEFAULT NULL) RETURNS SETOF public.ai_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.ai_jobs; paid boolean; allowed boolean;
BEGIN
  -- Serialize only the short claim transaction, not provider execution.
  PERFORM pg_advisory_xact_lock(59147720);
  IF p_daily_limit IS NULL OR p_daily_limit NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid daily call limit'; END IF;
  IF p_total_limit IS NOT NULL AND p_total_limit NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid total call limit'; END IF;
  UPDATE public.ai_jobs SET status='failed',error_code='deadline_or_attempt_limit',updated_at=now()
    WHERE status IN ('running','retry_wait') AND ((deadline_at<=now() AND deadline_at IS NOT NULL)
       OR (status='running' AND lease_expires_at<=now() AND attempts>=2));
  IF (SELECT count(*) FROM public.ai_jobs WHERE status='running' AND lease_expires_at>now())>=8 THEN RETURN; END IF;
  IF coalesce((SELECT reserved_calls FROM public.ai_daily_provider_calls WHERE usage_day=(now() AT TIME ZONE 'UTC')::date),0)>=p_daily_limit THEN RETURN; END IF;
  IF p_total_limit IS NOT NULL AND coalesce((SELECT sum(reserved_calls) FROM public.ai_daily_provider_calls),0)>=p_total_limit THEN RETURN; END IF;
  SELECT q.* INTO j FROM public.ai_jobs q JOIN public.stories s ON s.id=q.story_id AND s.author_id::text=q.owner_id::text AND s.revision=q.source_revision
    WHERE (p_job_id IS NULL OR q.id=p_job_id) AND q.attempts<2
      AND ((q.status IN ('queued','retry_wait') AND q.available_at<=now()) OR (q.status='running' AND q.lease_expires_at<=now()))
      AND (q.deadline_at IS NULL OR q.deadline_at>now())
      AND (SELECT count(*) FROM public.ai_jobs active WHERE active.owner_id=q.owner_id AND active.status='running' AND active.lease_expires_at>now())<2
    ORDER BY q.created_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.story_metadata m WHERE m.story_id=j.story_id AND m.ai_readable=false) THEN
    UPDATE public.ai_jobs SET status='cancelled',error_code='analysis_disabled',updated_at=now() WHERE id=j.id; RETURN;
  END IF;
  IF NOT j.quota_reserved THEN
    SELECT subscription_plan IN ('storyteller','creator') AND subscription_expires_at>now() INTO paid FROM public.users WHERE id=j.owner_id;
    SELECT q.allowed INTO allowed FROM public.consume_api_quota(j.owner_id,'ai_analyze_hour',10,3600) q;
    IF allowed IS DISTINCT FROM true THEN UPDATE public.ai_jobs SET status='failed',error_code='quota_exceeded',updated_at=now() WHERE id=j.id; RETURN; END IF;
    IF paid IS DISTINCT FROM true THEN
      SELECT q.allowed INTO allowed FROM public.consume_api_quota(j.owner_id,'ai_month_'||to_char(now() AT TIME ZONE 'UTC','YYYYMM'),10,2678400) q;
      IF allowed IS DISTINCT FROM true THEN UPDATE public.ai_jobs SET status='failed',error_code='quota_exceeded',updated_at=now() WHERE id=j.id; RETURN; END IF;
    END IF;
  END IF;
  INSERT INTO public.ai_daily_provider_calls(usage_day,reserved_calls) VALUES((now() AT TIME ZONE 'UTC')::date,1)
    ON CONFLICT(usage_day) DO UPDATE SET reserved_calls=public.ai_daily_provider_calls.reserved_calls+1;
  RETURN QUERY UPDATE public.ai_jobs SET status='running', attempts=attempts+1,quota_reserved=true,
    lease_token=gen_random_uuid(),lease_expires_at=now()+interval '45 seconds',deadline_at=coalesce(deadline_at,now()+interval '90 seconds'),updated_at=now()
    WHERE id=j.id RETURNING *;
END $$;

CREATE FUNCTION public.complete_ai_job(p_job_id uuid,p_lease_token uuid,p_result jsonb,p_usage jsonb DEFAULT '{}'::jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.ai_jobs; s public.stories;
BEGIN
  SELECT * INTO j FROM public.ai_jobs WHERE id=p_job_id;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Match story->job lock ordering used by story edits/deletion triggers.
  SELECT * INTO s FROM public.stories WHERE id=j.story_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO j FROM public.ai_jobs WHERE id=p_job_id FOR UPDATE;
  IF j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_expires_at<=now() OR j.deadline_at<=now()
    OR s.author_id::text<>j.owner_id::text OR s.revision<>j.source_revision THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.story_metadata WHERE story_id=s.id AND ai_readable=false) THEN
    UPDATE public.ai_jobs SET status='cancelled',error_code='analysis_disabled',updated_at=now() WHERE id=j.id; RETURN false;
  END IF;
  IF jsonb_typeof(p_result)<>'object' OR NOT p_result ?& ARRAY['themes','emotional_tone','life_domain','intensity_score','significance_score','people_mentioned','places_mentioned','time_references','brief_insight','actionable_advice'] THEN RAISE EXCEPTION 'Invalid analysis result'; END IF;
  IF jsonb_typeof(p_result->'themes')<>'array' OR jsonb_typeof(p_result->'people_mentioned')<>'array' OR jsonb_typeof(p_result->'places_mentioned')<>'array' OR jsonb_typeof(p_result->'time_references')<>'array' THEN RAISE EXCEPTION 'Invalid analysis arrays'; END IF;
  IF jsonb_array_length(p_result->'themes') NOT BETWEEN 1 AND 5 OR jsonb_array_length(p_result->'people_mentioned')>20 OR jsonb_array_length(p_result->'places_mentioned')>20 OR jsonb_array_length(p_result->'time_references')>20 THEN RAISE EXCEPTION 'Invalid analysis limits'; END IF;
  IF jsonb_typeof(p_result->'intensity_score')<>'number' OR jsonb_typeof(p_result->'significance_score')<>'number' OR (p_result->>'intensity_score')::numeric NOT BETWEEN 0 AND 1 OR (p_result->>'significance_score')::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Invalid analysis scores'; END IF;
  IF p_result->>'emotional_tone' NOT IN ('reflective','joyful','anxious','hopeful','melancholic','grateful','frustrated','peaceful','excited','uncertain','neutral') OR p_result->>'life_domain' NOT IN ('work','relationships','health','identity','growth','creativity','spirituality','family','adventure','learning','general') THEN RAISE EXCEPTION 'Invalid analysis labels'; END IF;
  IF jsonb_typeof(p_result->'brief_insight')<>'string' OR char_length(p_result->>'brief_insight') NOT BETWEEN 1 AND 500 OR jsonb_typeof(p_result->'actionable_advice')<>'string' OR char_length(p_result->>'actionable_advice') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid analysis text'; END IF;
  INSERT INTO public.story_metadata(story_id,themes,emotional_tone,life_domain,intensity_score,significance_score,people_mentioned,places_mentioned,time_references,brief_insight,actionable_advice,source_revision,updated_at)
    VALUES(s.id,ARRAY(SELECT jsonb_array_elements_text(p_result->'themes')),p_result->>'emotional_tone',p_result->>'life_domain',(p_result->>'intensity_score')::float,(p_result->>'significance_score')::float,ARRAY(SELECT jsonb_array_elements_text(p_result->'people_mentioned')),ARRAY(SELECT jsonb_array_elements_text(p_result->'places_mentioned')),ARRAY(SELECT jsonb_array_elements_text(p_result->'time_references')),p_result->>'brief_insight',p_result->>'actionable_advice',s.revision,now())
    ON CONFLICT(story_id) DO UPDATE SET themes=EXCLUDED.themes,emotional_tone=EXCLUDED.emotional_tone,life_domain=EXCLUDED.life_domain,intensity_score=EXCLUDED.intensity_score,significance_score=EXCLUDED.significance_score,people_mentioned=EXCLUDED.people_mentioned,places_mentioned=EXCLUDED.places_mentioned,time_references=EXCLUDED.time_references,brief_insight=EXCLUDED.brief_insight,actionable_advice=EXCLUDED.actionable_advice,source_revision=EXCLUDED.source_revision,updated_at=now();
  UPDATE public.ai_jobs SET status='succeeded',result=p_result,usage=p_usage,error_code=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=j.id;
  RETURN true;
END $$;
CREATE FUNCTION public.fail_ai_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_error_code NOT IN ('provider_transient','provider_failure','invalid_output','privacy_configuration','source_changed','persistence_unavailable') THEN RAISE EXCEPTION 'Invalid error code'; END IF;
  UPDATE public.ai_jobs SET status=CASE WHEN p_retryable AND attempts<2 AND deadline_at>now()+interval '2 seconds' THEN 'retry_wait' ELSE 'failed' END,
    available_at=now()+interval '2 seconds',error_code=p_error_code,lease_expires_at=NULL,updated_at=now()
    WHERE id=p_job_id AND status='running' AND lease_token=p_lease_token AND lease_expires_at>now();
  RETURN FOUND;
END $$;
CREATE FUNCTION public.retry_ai_job(p_owner_id uuid,p_story_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.ai_jobs j SET status='queued',deadline_at=NULL,available_at=now(),error_code=NULL,updated_at=now()
    FROM public.stories s WHERE s.id=p_story_id AND s.author_id::text=p_owner_id::text AND j.story_id=s.id AND j.owner_id=p_owner_id AND j.source_revision=s.revision
    AND j.status='failed' AND j.attempts>0 AND j.attempts<2 AND j.error_code<>'quota_exceeded';
  RETURN FOUND;
END $$;
CREATE FUNCTION public.admit_ai_text_call(p_owner_id uuid,p_task text,p_daily_limit integer DEFAULT 100,p_total_limit integer DEFAULT NULL)
RETURNS TABLE(allowed boolean,reason text,retry_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE policy_action text; policy_limit integer; policy_window integer; q record;
BEGIN
  IF p_daily_limit IS NULL OR p_daily_limit NOT BETWEEN 1 AND 100000 OR p_task NOT IN ('enhancement','tracker','reflection') THEN RAISE EXCEPTION 'Invalid text admission policy'; END IF;
  IF p_total_limit IS NOT NULL AND p_total_limit NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid total call limit'; END IF;
  PERFORM pg_advisory_xact_lock(59147720);
  IF coalesce((SELECT reserved_calls FROM public.ai_daily_provider_calls WHERE usage_day=(now() AT TIME ZONE 'UTC')::date),0)>=p_daily_limit THEN RETURN QUERY SELECT false,'budget'::text,60; RETURN; END IF;
  IF p_total_limit IS NOT NULL AND coalesce((SELECT sum(reserved_calls) FROM public.ai_daily_provider_calls),0)>=p_total_limit THEN RETURN QUERY SELECT false,'budget'::text,60; RETURN; END IF;
  IF p_task='reflection' THEN
    policy_action:='reflection_'||to_char(date_trunc('week',(now() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day','YYYY-MM-DD'); policy_limit:=3; policy_window:=604800;
  ELSE policy_action:='ai_enhance_day'; policy_limit:=30; policy_window:=86400; END IF;
  SELECT * INTO q FROM public.consume_api_quota(p_owner_id,policy_action,policy_limit,policy_window);
  IF q.allowed IS DISTINCT FROM true THEN RETURN QUERY SELECT false,'quota'::text,greatest(1,ceil(extract(epoch FROM q.reset_at-now()))::integer); RETURN; END IF;
  INSERT INTO public.ai_daily_provider_calls(usage_day,reserved_calls) VALUES((now() AT TIME ZONE 'UTC')::date,1)
    ON CONFLICT(usage_day) DO UPDATE SET reserved_calls=public.ai_daily_provider_calls.reserved_calls+1;
  RETURN QUERY SELECT true,'ok'::text,0;
END $$;
REVOKE ALL ON FUNCTION public.admit_ai_text_call(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_ai_text_call(uuid,text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_ai_job(uuid,uuid),public.retry_ai_job(uuid,uuid),public.claim_ai_job(uuid,integer,integer),public.complete_ai_job(uuid,uuid,jsonb,jsonb),public.fail_ai_job(uuid,uuid,text,boolean),public.story_revision_guard(),public.enqueue_story_analysis() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ai_job(uuid,uuid),public.retry_ai_job(uuid,uuid),public.claim_ai_job(uuid,integer,integer),public.complete_ai_job(uuid,uuid,jsonb,jsonb),public.fail_ai_job(uuid,uuid,text,boolean) TO service_role;
COMMIT;
