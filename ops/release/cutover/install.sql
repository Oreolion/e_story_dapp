-- Preparation only. This does not activate the Data API fence.
-- Review the exact target, existing pre-request configuration and release gate.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION public.istory_cutover_guard() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $guard$
BEGIN
  RAISE SQLSTATE 'PGRST' USING
    MESSAGE = '{"code":"ISTORY_RELEASE_PAUSED","message":"Application maintenance in progress","details":null,"hint":null}',
    DETAIL = '{"status":503,"headers":{"Cache-Control":"no-store"}}';
END;
$guard$;
REVOKE ALL ON FUNCTION public.istory_cutover_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.istory_cutover_guard() TO authenticator, anon, authenticated, service_role;
COMMIT;
