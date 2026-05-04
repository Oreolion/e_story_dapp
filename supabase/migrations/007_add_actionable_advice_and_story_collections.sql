-- Migration 007: Add actionable_advice to story_metadata + story collections support
-- Date: 2026-03-19

-- 1. Add actionable_advice column to story_metadata
ALTER TABLE story_metadata
ADD COLUMN IF NOT EXISTS actionable_advice TEXT;

-- 2. Add parent_story_id for story continuations/series
ALTER TABLE stories
ADD COLUMN IF NOT EXISTS parent_story_id UUID REFERENCES stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stories_parent ON stories(parent_story_id)
WHERE parent_story_id IS NOT NULL;

-- 3. Create story_collections table for organizing story series
CREATE TABLE IF NOT EXISTS story_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID NOT NULL,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  story_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_author ON story_collections(author_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON story_collections(is_public) WHERE is_public = true;

-- 4. Junction table: stories <-> collections (a story can be in multiple collections)
CREATE TABLE IF NOT EXISTS collection_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES story_collections(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_stories_collection ON collection_stories(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_stories_story ON collection_stories(story_id);

-- 5. Enable RLS on new tables
ALTER TABLE story_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_stories ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for story_collections
-- (API routes use admin client which bypasses RLS, but these provide defense-in-depth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_collections' AND policyname = 'Users can read own collections'
  ) THEN
    CREATE POLICY "Users can read own collections" ON story_collections
      FOR SELECT USING (author_id::text = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_collections' AND policyname = 'Users can read public collections'
  ) THEN
    CREATE POLICY "Users can read public collections" ON story_collections
      FOR SELECT USING (is_public = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_collections' AND policyname = 'Users can insert own collections'
  ) THEN
    CREATE POLICY "Users can insert own collections" ON story_collections
      FOR INSERT WITH CHECK (author_id::text = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_collections' AND policyname = 'Users can update own collections'
  ) THEN
    CREATE POLICY "Users can update own collections" ON story_collections
      FOR UPDATE USING (author_id::text = auth.uid()::text)
      WITH CHECK (author_id::text = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'story_collections' AND policyname = 'Users can delete own collections'
  ) THEN
    CREATE POLICY "Users can delete own collections" ON story_collections
      FOR DELETE USING (author_id::text = auth.uid()::text);
  END IF;
END
$$;

-- 7. RLS policies for collection_stories (ownership via parent collection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collection_stories' AND policyname = 'Users can read collection_stories for accessible collections'
  ) THEN
    CREATE POLICY "Users can read collection_stories for accessible collections" ON collection_stories
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM story_collections
          WHERE story_collections.id = collection_stories.collection_id
            AND (story_collections.author_id::text = auth.uid()::text OR story_collections.is_public = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'collection_stories' AND policyname = 'Users can manage collection_stories in own collections'
  ) THEN
    CREATE POLICY "Users can manage collection_stories in own collections" ON collection_stories
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM story_collections
          WHERE story_collections.id = collection_stories.collection_id
            AND story_collections.author_id::text = auth.uid()::text
        )
      );
  END IF;
END
$$;
