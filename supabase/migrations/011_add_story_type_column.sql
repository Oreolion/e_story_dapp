-- Add story_type column to stories table
-- Supports: personal_journal, historical_narrative, geopolitical_analysis, cultural_tale, creative_nonfiction
ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_type TEXT DEFAULT 'personal_journal';

-- Index for filtering by story type
CREATE INDEX IF NOT EXISTS idx_stories_type ON stories(story_type);
