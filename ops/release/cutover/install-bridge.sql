-- Preparation only. Does not activate a hook or configure any credential.
-- New operational objects require their own scope/recovery review before use.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA istory_release;
REVOKE ALL ON SCHEMA istory_release FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE istory_release.control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  mode text NOT NULL CHECK(mode IN ('paused','candidate')),
  epoch uuid,
  key_sha256 bytea CHECK(octet_length(key_sha256)=32),
  guard_sha256 bytea,
  CHECK ((epoch IS NULL) = (key_sha256 IS NULL)),
  CHECK(mode='paused' OR epoch IS NOT NULL)
);
INSERT INTO istory_release.control(singleton,mode) VALUES(true,'paused');
CREATE TABLE istory_release.payment_callbacks (
  receipt_id uuid PRIMARY KEY,
  receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=16384),
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','processed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  processed_at timestamptz
);
CREATE INDEX payment_callbacks_ready ON istory_release.payment_callbacks(available_at,received_at) WHERE status IN ('pending','processing');
ALTER TABLE istory_release.control ENABLE ROW LEVEL SECURITY;
ALTER TABLE istory_release.payment_callbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA istory_release FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.istory_release_guard() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $bridge_guard$
DECLARE
  control istory_release.control%ROWTYPE;
  headers jsonb := nullif(current_setting('request.headers',true),'')::jsonb;
  actor text := current_setting('role',true);
  trusted boolean;
BEGIN
  SELECT * INTO control FROM istory_release.control WHERE singleton;
  trusted := actor='service_role' AND control.epoch IS NOT NULL
    AND headers->>'x-istory-release-epoch'=control.epoch::text
    AND headers->>'x-istory-release-key' ~ '^[a-f0-9]{64}$'
    AND sha256(convert_to(headers->>'x-istory-release-key','UTF8'))=control.key_sha256;
  IF control.mode='paused' AND trusted
    AND current_setting('request.method',true)='POST'
    AND current_setting('request.path',true)='/rpc/istory_retain_payment_callback' THEN RETURN; END IF;
  IF control.mode='candidate' AND (trusted OR actor IN ('anon','authenticated')) THEN RETURN; END IF;
  PERFORM public.istory_cutover_guard();
END;
$bridge_guard$;
REVOKE ALL ON FUNCTION public.istory_release_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.istory_release_guard() TO authenticator,anon,authenticated,service_role;
UPDATE istory_release.control SET guard_sha256=(SELECT sha256(convert_to(prosrc,'UTF8')) FROM pg_proc WHERE oid='public.istory_release_guard()'::regprocedure);
ALTER TABLE istory_release.control ALTER COLUMN guard_sha256 SET NOT NULL;
CREATE FUNCTION istory_release.assert_guard() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    JOIN istory_release.control c ON c.singleton
    WHERE p.oid='public.istory_release_guard()'::regprocedure AND l.lanname='plpgsql'
      AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']
      AND sha256(convert_to(p.prosrc,'UTF8'))=c.guard_sha256
      AND p.proowner=(SELECT relowner FROM pg_class WHERE oid='istory_release.control'::regclass))
    THEN RAISE EXCEPTION 'CUTOVER_BRIDGE_DEFINITION_MISMATCH'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION istory_release.assert_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.istory_retain_payment_callback(p_receipt jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE found_receipt jsonb;
BEGIN
  IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR octet_length(p_receipt::text)>16384
    OR p_receipt->>'id' IS NULL THEN RAISE EXCEPTION 'CALLBACK_INVALID'; END IF;
  INSERT INTO istory_release.payment_callbacks(receipt_id,receipt)
    VALUES((p_receipt->>'id')::uuid,p_receipt) ON CONFLICT(receipt_id) DO NOTHING;
  SELECT receipt INTO found_receipt FROM istory_release.payment_callbacks WHERE receipt_id=(p_receipt->>'id')::uuid;
  IF found_receipt IS DISTINCT FROM p_receipt THEN RAISE EXCEPTION 'CALLBACK_IDENTITY_CONFLICT'; END IF;
  RETURN true;
END;
$$;
CREATE FUNCTION public.istory_claim_payment_callback()
RETURNS TABLE(receipt jsonb, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  UPDATE istory_release.payment_callbacks SET status='failed',lease_token=NULL,lease_until=NULL
    WHERE status='processing' AND lease_until<=clock_timestamp() AND attempts>=5;
  RETURN QUERY
    WITH chosen AS (
      SELECT c.receipt_id FROM istory_release.payment_callbacks c
      WHERE (c.status='pending' AND c.available_at<=clock_timestamp()
        OR c.status='processing' AND c.lease_until<=clock_timestamp()) AND c.attempts<5
      ORDER BY c.received_at,c.receipt_id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE istory_release.payment_callbacks c SET status='processing',attempts=c.attempts+1,
      lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '120 seconds'
    FROM chosen WHERE c.receipt_id=chosen.receipt_id RETURNING c.receipt,c.lease_token;
END;
$$;
CREATE FUNCTION public.istory_finish_payment_callback(p_receipt_id uuid,p_lease_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE changed integer;
BEGIN
  IF p_success IS NULL THEN RAISE EXCEPTION 'CALLBACK_INVALID'; END IF;
  UPDATE istory_release.payment_callbacks SET
    status=CASE WHEN p_success THEN 'processed' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
    processed_at=CASE WHEN p_success THEN clock_timestamp() ELSE NULL END,
    available_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^attempts)::integer)),
    lease_token=NULL,lease_until=NULL
  WHERE receipt_id=p_receipt_id AND lease_token=p_lease_token AND status='processing' AND lease_until>clock_timestamp();
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END;
$$;
REVOKE ALL ON FUNCTION public.istory_retain_payment_callback(jsonb),public.istory_claim_payment_callback(),public.istory_finish_payment_callback(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.istory_retain_payment_callback(jsonb),public.istory_claim_payment_callback(),public.istory_finish_payment_callback(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
