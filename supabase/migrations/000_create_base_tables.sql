-- ============================================================================
-- Migration 000: Create base tables (users, stories, story_metadata)
--
-- These tables are referenced by all subsequent migrations but were never
-- version-controlled. Using IF NOT EXISTS for idempotency — production
-- databases already have these; fresh deploys need them created.
--
-- IMPORTANT: Tables are created in their INITIAL state (pre-migration 003/007).
-- Later migrations (003, 007) ALTER them to add columns, indexes, etc.
-- This ensures the full migration sequence works on both fresh and existing DBs.
-- ============================================================================

-- ─── Users ──────────────────────────────────────────────────────────────────
-- Initial state: wallet-only auth, no OAuth fields (migration 003 adds those).
-- NOTE: wallet_address uses a standalone unique INDEX (not inline UNIQUE constraint)
-- so that migration 003's `DROP INDEX IF EXISTS users_wallet_address_key` works.
-- Inline UNIQUE creates a constraint-backed index that can't be dropped via DROP INDEX.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  name TEXT,
  username TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  badges TEXT[] DEFAULT '{}',
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standalone unique index (migration 003 drops this and replaces with partial index).
-- Only create if migration 003 hasn't already run (i.e., users_wallet_address_unique
-- doesn't exist yet). Otherwise we'd re-create a dropped non-partial index.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_wallet_address_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'users_wallet_address_key'
    ) THEN
      CREATE UNIQUE INDEX users_wallet_address_key ON users(wallet_address);
    END IF;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Stories ────────────────────────────────────────────────────────────────
-- Initial state: no parent_story_id (migration 007 adds it)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_wallet TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  teaser TEXT,
  has_audio BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  mood TEXT DEFAULT 'neutral',
  ipfs_hash TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  paywall_amount NUMERIC DEFAULT 0,
  story_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_public ON stories(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_stories_date ON stories(story_date DESC NULLS LAST);

-- ─── Story Metadata ─────────────────────────────────────────────────────────
-- Initial state: no actionable_advice column (migration 007 adds it)
CREATE TABLE IF NOT EXISTS story_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  themes TEXT[] DEFAULT '{}',
  emotional_tone TEXT,
  life_domain TEXT,
  intensity_score FLOAT DEFAULT 0,
  significance_score FLOAT DEFAULT 0,
  is_canonical BOOLEAN DEFAULT FALSE,
  ai_readable BOOLEAN DEFAULT TRUE,
  people_mentioned TEXT[] DEFAULT '{}',
  places_mentioned TEXT[] DEFAULT '{}',
  time_references TEXT[] DEFAULT '{}',
  brief_insight TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id)
);

CREATE INDEX IF NOT EXISTS idx_story_metadata_story_id ON story_metadata(story_id);
CREATE INDEX IF NOT EXISTS idx_story_metadata_themes ON story_metadata USING GIN(themes);
CREATE INDEX IF NOT EXISTS idx_story_metadata_domain ON story_metadata(life_domain);
CREATE INDEX IF NOT EXISTS idx_story_metadata_canonical ON story_metadata(is_canonical);
