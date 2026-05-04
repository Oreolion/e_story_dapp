-- ============================================================================
-- Migration 014: Create social interaction tables (likes, follows, comments)
--
-- These tables are required by:
--   - POST /api/social/like     (likes table)
--   - GET  /api/social/like/status (likes table)
--   - POST /api/social/follow   (follows table)
--   - GET  /api/social/follow   (follows table)
--   - GET  /api/stories/[id]    (comments table)
--   - POST /api/stories/[id]    (comments table)
--
-- Without these tables, all like/follow/comment operations fail with 500.
-- Uses DROP + CREATE for follows to fix column mismatch from old schema.
-- ============================================================================

-- ─── Likes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_story ON likes(story_id);

-- ─── Follows ───────────────────────────────────────────────────────────────
-- Drop old follows table if it has wrong schema (missing follower_id column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'follows'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follows' AND column_name = 'follower_id'
  ) THEN
    DROP TABLE follows;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follower_wallet TEXT,
  followed_wallet TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ─── Comments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_wallet TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_story ON comments(story_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);

-- ─── Saved Stories (Bookmarks) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_stories_user ON saved_stories(user_id);

-- ─── Unlocked Content ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unlocked_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_content_user ON unlocked_content(user_id);
