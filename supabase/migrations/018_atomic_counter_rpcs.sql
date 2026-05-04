-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  018_atomic_counter_rpcs                                                  ║
-- ║                                                                          ║
-- ║  Replaces read-then-write counter updates (which are racy under          ║
-- ║  concurrency) with atomic SQL UPDATEs exposed as RPC functions.          ║
-- ║                                                                          ║
-- ║  Used by:                                                                ║
-- ║    - app/api/social/like/route.ts      → increment_story_likes           ║
-- ║    - app/api/social/follow/route.ts    → increment_user_followers        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Story likes counter ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_story_likes(p_story_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE stories
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = p_story_id
  RETURNING likes INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION decrement_story_likes(p_story_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE stories
  SET likes = GREATEST(0, COALESCE(likes, 0) - 1)
  WHERE id = p_story_id
  RETURNING likes INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

-- ─── User followers counter ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_user_followers(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE users
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE id = p_user_id
  RETURNING followers_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION decrement_user_followers(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE users
  SET followers_count = GREATEST(0, COALESCE(followers_count, 0) - 1)
  WHERE id = p_user_id
  RETURNING followers_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

-- Allow service role + authenticated role to call these RPCs
GRANT EXECUTE ON FUNCTION increment_story_likes(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION decrement_story_likes(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION increment_user_followers(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION decrement_user_followers(UUID) TO service_role, authenticated;
