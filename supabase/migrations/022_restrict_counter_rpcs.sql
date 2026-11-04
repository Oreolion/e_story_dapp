-- Existing UI callers use authenticated APIs; these privileged counter helpers
-- must not be callable directly by anonymous/authenticated database roles.
BEGIN;
REVOKE ALL ON FUNCTION public.increment_story_likes(uuid),public.decrement_story_likes(uuid),public.increment_user_followers(uuid),public.decrement_user_followers(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.increment_story_likes(uuid),public.decrement_story_likes(uuid),public.increment_user_followers(uuid),public.decrement_user_followers(uuid) TO service_role;
ALTER FUNCTION public.increment_story_likes(uuid) SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.decrement_story_likes(uuid) SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.increment_user_followers(uuid) SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.decrement_user_followers(uuid) SET search_path=pg_catalog,public,pg_temp;
COMMIT;
