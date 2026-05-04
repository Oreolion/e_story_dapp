-- Add notification preferences column to users table
-- Stores user preferences as JSONB with defaults
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_notifications": true,
  "public_profile": true,
  "ai_enhancement": true,
  "re_engagement_emails": true
}'::jsonb;

-- Add last_active_at column for re-engagement email tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();
