-- Receipt, entitlement and notification event commit or roll back together.
BEGIN;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS activated_expires_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_receipt_id uuid UNIQUE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deferred boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX payments_provider_address_unique ON public.payments(blockradar_address_id) WHERE blockradar_address_id IS NOT NULL;
CREATE TABLE public.payment_notification_outbox (
  payment_id uuid PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  available_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  email_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_notification_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payment_notification_outbox TO service_role;
CREATE INDEX payment_notice_dispatch ON public.payment_notification_outbox(status,available_at,created_at);
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
REVOKE ALL ON public.notifications FROM anon,authenticated;
GRANT ALL ON public.notifications TO service_role;
-- Correct the earlier policy whose name said service-role but allowed every role.
DROP POLICY IF EXISTS "Service role full access on payments" ON public.payments;
REVOKE INSERT,UPDATE,DELETE ON public.payments FROM anon,authenticated;
CREATE FUNCTION public.activate_paid_payment(p_payment_id uuid,p_amount numeric,p_receipt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.payments; expiry timestamptz; current_expiry timestamptz; current_plan text;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF p_receipt_id IS NULL THEN RAISE EXCEPTION 'Receipt identity required'; END IF;
  IF p.activated_expires_at IS NOT NULL THEN RETURN jsonb_build_object('alreadyActivated',true,'expiresAt',p.activated_expires_at,'plan',p.plan); END IF;
  -- Historical completed rows have no event binding. Never grant fresh access
  -- from an expired old payment; reconcile these separately with provider proof.
  IF p.status='completed' THEN RAISE EXCEPTION 'Legacy completed payment requires reconciliation'; END IF;
  IF p.status NOT IN ('pending','expired') THEN RAISE EXCEPTION 'Payment is not activatable'; END IF;
  IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount < p.amount_expected-0.01 THEN RAISE EXCEPTION 'Insufficient payment'; END IF;
  IF p.provider_receipt_id IS NOT NULL AND p.provider_receipt_id<>p_receipt_id THEN RETURN jsonb_build_object('alreadyActivated',false,'deferred',p.deferred,'plan',p.plan); END IF;
  SELECT subscription_expires_at,subscription_plan INTO current_expiry,current_plan FROM public.users WHERE id=p.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF current_plan='creator' AND p.plan='storyteller' AND current_expiry>now() THEN
    UPDATE public.payments SET deferred=true,provider_receipt_id=p_receipt_id,amount_received=p_amount,status='pending',updated_at=now() WHERE id=p.id;
    RETURN jsonb_build_object('alreadyActivated',false,'deferred',true,'expiresAt',current_expiry,'plan',p.plan);
  END IF;
  -- Preserve purchased time; replay uses the stored activation and adds no time.
  expiry:=greatest(coalesce(current_expiry,now()),now())+interval '30 days';
  UPDATE public.users SET subscription_plan=p.plan,subscription_expires_at=expiry,updated_at=now() WHERE id=p.user_id;
  UPDATE public.payments SET status='completed',deferred=false,amount_received=p_amount,completed_at=now(),activated_expires_at=expiry,provider_receipt_id=p_receipt_id,updated_at=now() WHERE id=p.id;
  INSERT INTO public.payment_notification_outbox(payment_id,user_id,plan,expires_at) VALUES(p.id,p.user_id,p.plan,expiry);
  RETURN jsonb_build_object('alreadyActivated',false,'expiresAt',expiry,'plan',p.plan);
END $$;
REVOKE ALL ON FUNCTION public.activate_paid_payment(uuid,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_payment(uuid,numeric,uuid) TO service_role;
CREATE FUNCTION public.activate_due_payment_credit() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.payments;
BEGIN
  SELECT paid.* INTO p FROM public.payments paid JOIN public.users u ON u.id=paid.user_id
    WHERE paid.deferred=true AND paid.status='pending' AND paid.provider_receipt_id IS NOT NULL
    AND coalesce(u.subscription_expires_at,now())<=now()
    ORDER BY paid.created_at FOR UPDATE OF paid SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.activate_paid_payment(p.id,p.amount_received,p.provider_receipt_id);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.activate_due_payment_credit() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_due_payment_credit() TO service_role;
CREATE FUNCTION public.claim_payment_notice() RETURNS SETOF public.payment_notification_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n public.payment_notification_outbox;
BEGIN
  UPDATE public.payment_notification_outbox SET status='failed' WHERE status IN ('pending','running') AND (first_attempt_at<now()-interval '23 hours' OR attempts>=3 AND lease_expires_at<=now());
  SELECT * INTO n FROM public.payment_notification_outbox WHERE attempts<3 AND ((status='pending' AND available_at<=now()) OR (status='running' AND lease_expires_at<=now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY UPDATE public.payment_notification_outbox SET status='running',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_expires_at=now()+interval '30 seconds' WHERE payment_id=n.payment_id RETURNING *;
END $$;
CREATE FUNCTION public.finish_payment_notice(p_payment_id uuid,p_lease_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.payment_notification_outbox SET status=CASE WHEN p_success THEN 'sent' WHEN attempts<3 AND first_attempt_at>now()-interval '23 hours' THEN 'pending' ELSE 'failed' END, available_at=now()+interval '2 minutes',lease_expires_at=NULL WHERE payment_id=p_payment_id AND status='running' AND lease_token=p_lease_token AND lease_expires_at>now();
  RETURN FOUND;
END $$;
CREATE FUNCTION public.prepare_payment_notice_email(p_payment_id uuid,p_lease_token uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE frozen jsonb;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>100000 THEN RAISE EXCEPTION 'Invalid email payload'; END IF;
  UPDATE public.payment_notification_outbox SET email_payload=coalesce(email_payload,p_payload)
    WHERE payment_id=p_payment_id AND status='running' AND lease_token=p_lease_token AND lease_expires_at>now()
    RETURNING email_payload INTO frozen;
  RETURN frozen;
END $$;
REVOKE ALL ON FUNCTION public.claim_payment_notice(),public.finish_payment_notice(uuid,uuid,boolean),public.prepare_payment_notice_email(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_notice(),public.finish_payment_notice(uuid,uuid,boolean),public.prepare_payment_notice_email(uuid,uuid,jsonb) TO service_role;
COMMIT;
