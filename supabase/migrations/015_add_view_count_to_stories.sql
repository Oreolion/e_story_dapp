-- ============================================================================
-- Migration 015: Add view_count column to stories table
--
-- Tracks how many times a story's detail page has been viewed.
-- Used by:
--   - GET /api/stories/[storyId] (increments on each public view)
--   - GET /api/stories/feed (returns view_count in feed data)
--   - Library, Profile, Social pages (display real view counts)
-- ============================================================================

ALTER TABLE stories ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_stories_view_count ON stories(view_count DESC);
