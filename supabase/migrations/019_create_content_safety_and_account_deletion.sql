-- Google Play UGC safety and account-deletion foundation.
-- All writes go through authenticated API routes using the service-role client.

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('story', 'comment', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('spam', 'harassment', 'hate', 'sexual_content', 'violence', 'self_harm', 'other')
  ),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON content_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON content_reports(target_type, target_id);

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Durable, atomic quotas for cost-bearing API routes. Application code uses
-- distinct action names for different windows (for example, ai_enhance_day).
CREATE TABLE IF NOT EXISTS api_rate_limits (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 64),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client policies. The service role bypasses RLS and API handlers
-- perform authentication, authorization, validation, and rate limiting.

CREATE OR REPLACE FUNCTION consume_api_quota(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_started_at TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Quota limits must be positive';
  END IF;

  IF p_action IS NULL OR char_length(p_action) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Invalid quota action';
  END IF;

  INSERT INTO api_rate_limits (
    user_id,
    action,
    window_started_at,
    request_count
  )
  VALUES (p_user_id, p_action, v_now, 1)
  ON CONFLICT (user_id, action) DO UPDATE SET
    window_started_at = CASE
      WHEN api_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      THEN v_now
      ELSE api_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN api_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE api_rate_limits.request_count + 1
    END
  RETURNING api_rate_limits.window_started_at, api_rate_limits.request_count
  INTO v_window_started_at, v_request_count;

  RETURN QUERY SELECT
    v_request_count <= p_max_requests,
    GREATEST(p_max_requests - v_request_count, 0),
    v_window_started_at + make_interval(secs => p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION consume_api_quota(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_api_quota(UUID, TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION block_user(p_blocker_id UUID, p_blocked_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_blocker_id = p_blocked_id THEN
    RAISE EXCEPTION 'Users cannot block themselves';
  END IF;

  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (p_blocker_id, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  DELETE FROM follows
  WHERE (follower_id = p_blocker_id AND following_id = p_blocked_id)
     OR (follower_id = p_blocked_id AND following_id = p_blocker_id);
END;
$$;

REVOKE ALL ON FUNCTION block_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION block_user(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION delete_user_account_data(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_wallet TEXT;
BEGIN
  SELECT email, wallet_address
  INTO v_email, v_wallet
  FROM users
  WHERE id = p_user_id;

  -- Remove safety data authored by or targeting this user and their content.
  DELETE FROM content_reports
  WHERE reporter_id = p_user_id
     OR (target_type = 'user' AND target_id = p_user_id)
     OR (target_type = 'story' AND target_id IN (
       SELECT id FROM stories WHERE author_id = p_user_id
     ))
     OR (target_type = 'comment' AND target_id IN (
       SELECT id FROM comments WHERE author_id = p_user_id
     ));

  DELETE FROM user_blocks
  WHERE blocker_id = p_user_id OR blocked_id = p_user_id;

  -- These relationships use SET NULL or have no user foreign key.
  DELETE FROM notifications WHERE related_user_id = p_user_id;
  DELETE FROM verification_logs WHERE triggered_by = p_user_id;
  DELETE FROM story_collections WHERE author_id = p_user_id;

  -- Some production environments contain the legacy books table even though
  -- it was created outside the versioned migrations.
  IF to_regclass('public.books') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.books WHERE author_id = $1' USING p_user_id;
  END IF;

  IF v_email IS NOT NULL THEN
    DELETE FROM waitlist WHERE lower(email) = lower(v_email);
  END IF;

  IF v_wallet IS NOT NULL THEN
    DELETE FROM auth_nonces WHERE lower(address) = lower(v_wallet);
  END IF;

  -- Cascades remove stories, metadata, comments, likes, follows, saved and
  -- unlocked content, payments, notifications, habits, logs, and reflections.
  DELETE FROM users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_user_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account_data(UUID) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
