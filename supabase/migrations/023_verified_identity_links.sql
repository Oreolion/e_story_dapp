-- Forward-only identity ownership. Rehearse before applying to a hosted target.
-- No legacy email, google_id or editable metadata is promoted into authority.
BEGIN;
CREATE TABLE public.auth_identity_links (
  auth_user_id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  google_subject text NOT NULL UNIQUE CHECK (length(google_subject) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auth_link_challenges (
  challenge_hash text PRIMARY KEY CHECK (challenge_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  initiator_subject uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('wallet_to_google','google_to_wallet')),
  wallet_address text NOT NULL CHECK (wallet_address ~ '^0x[a-f0-9]{40}$'),
  origin text NOT NULL CHECK (length(origin) BETWEEN 8 AND 255),
  message text NOT NULL CHECK (length(message) BETWEEN 20 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '5 minutes 5 seconds')
);
CREATE INDEX auth_link_challenges_expiry ON public.auth_link_challenges(expires_at);
ALTER TABLE public.auth_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_link_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_identity_links, public.auth_link_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_identity_links, public.auth_link_challenges TO service_role;

-- A link cannot silently strand records owned by another populated profile.
-- Catalog-derived identifiers are quoted; the caller supplies only a UUID value.
CREATE FUNCTION public.identity_profile_has_data(p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE fk record; found boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id AND is_onboarded=true) THEN RETURN true; END IF;
  FOR fk IN
    SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1]
    WHERE k.contype='f' AND k.confrelid='public.users'::regclass
      AND cardinality(k.conkey)=1 AND n.nspname='public'
      AND c.relname NOT IN ('auth_link_challenges','auth_identity_links')
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',fk.schema_name,fk.table_name,fk.column_name)
      INTO found USING p_user_id;
    IF found THEN RETURN true; END IF;
  END LOOP;
  -- Historical TEXT owners may lack a foreign key.
  RETURN EXISTS(SELECT 1 FROM public.stories WHERE author_id::text=p_user_id::text);
END $$;

CREATE FUNCTION public.finalize_identity_link(
  p_challenge_hash text,p_auth_user_id uuid,p_google_subject text,p_origin text
) RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE challenge public.auth_link_challenges; target public.users; existing_id uuid;
BEGIN
  IF p_auth_user_id IS NULL OR p_google_subject IS NULL OR length(p_google_subject) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'link_conflict';
  END IF;
  -- Serializes only the short identity mutation, not OAuth or signature checks.
  PERFORM pg_advisory_xact_lock(59147723);
  SELECT * INTO challenge FROM public.auth_link_challenges WHERE challenge_hash=p_challenge_hash FOR UPDATE;
  IF NOT FOUND OR challenge.consumed_at IS NOT NULL OR challenge.expires_at<=now() THEN
    RAISE EXCEPTION 'link_restart_required';
  END IF;
  IF challenge.origin IS DISTINCT FROM p_origin THEN RAISE EXCEPTION 'link_forbidden' USING ERRCODE='42501'; END IF;
  IF challenge.direction='google_to_wallet' AND challenge.initiator_subject<>p_auth_user_id THEN
    RAISE EXCEPTION 'link_forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO target FROM public.users WHERE id=challenge.owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_conflict'; END IF;
  IF challenge.direction='wallet_to_google' AND (target.id<>challenge.initiator_subject OR lower(target.wallet_address) IS DISTINCT FROM challenge.wallet_address) THEN
    RAISE EXCEPTION 'link_conflict';
  END IF;
  IF target.wallet_address IS NOT NULL AND lower(target.wallet_address)<>challenge.wallet_address THEN RAISE EXCEPTION 'link_conflict'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE lower(wallet_address)=challenge.wallet_address AND id<>target.id) THEN RAISE EXCEPTION 'link_conflict'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE google_id=p_google_subject AND id<>target.id) THEN RAISE EXCEPTION 'link_conflict'; END IF;
  SELECT user_id INTO existing_id FROM public.auth_identity_links WHERE auth_user_id=p_auth_user_id;
  IF FOUND AND existing_id<>target.id THEN RAISE EXCEPTION 'link_conflict'; END IF;
  IF EXISTS(SELECT 1 FROM public.auth_identity_links WHERE user_id=target.id AND auth_user_id<>p_auth_user_id) THEN RAISE EXCEPTION 'link_conflict'; END IF;
  IF p_auth_user_id<>target.id AND EXISTS(SELECT 1 FROM public.users WHERE id=p_auth_user_id)
    AND public.identity_profile_has_data(p_auth_user_id) THEN RAISE EXCEPTION 'link_conflict'; END IF;
  INSERT INTO public.auth_identity_links(auth_user_id,user_id,google_subject)
    VALUES(p_auth_user_id,target.id,p_google_subject)
    ON CONFLICT(auth_user_id) DO NOTHING;
  -- An existing row must agree on both immutable identifiers, even on retries.
  IF NOT EXISTS(SELECT 1 FROM public.auth_identity_links WHERE auth_user_id=p_auth_user_id AND user_id=target.id AND google_subject=p_google_subject) THEN RAISE EXCEPTION 'link_conflict'; END IF;
  UPDATE public.users SET wallet_address=challenge.wallet_address,google_id=p_google_subject,auth_provider='both',updated_at=now() WHERE id=target.id;
  UPDATE public.auth_link_challenges SET consumed_at=now() WHERE challenge_hash=p_challenge_hash;
  RETURN QUERY SELECT * FROM public.users WHERE id=target.id;
END $$;
REVOKE ALL ON FUNCTION public.identity_profile_has_data(uuid),public.finalize_identity_link(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.identity_profile_has_data(uuid),public.finalize_identity_link(text,uuid,text,text) TO service_role;

-- Replace the old SELECT-then-DELETE nonce consumption with one atomic write.
CREATE FUNCTION public.consume_wallet_nonce(p_address text,p_nonce text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.auth_nonces WHERE address=lower(p_address) AND nonce=p_nonce
    AND created_at>now()-interval '5 minutes' AND created_at<=now();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.consume_wallet_nonce(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_wallet_nonce(text,text) TO service_role;

-- Identity mutations now go through verified server operations only.
-- TRUNCATE bypasses RLS and must not survive historical ALL table grants.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.users FROM PUBLIC,anon,authenticated;
COMMIT;
