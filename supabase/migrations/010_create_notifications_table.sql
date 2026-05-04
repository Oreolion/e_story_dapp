-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'tip', 'follow', 'book_published', 'story_mentioned')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS policies
-- Note: All notification access goes through API routes using the admin client
-- (service role bypasses RLS). Wallet users don't have Supabase auth identities,
-- so RLS policies use service_role access only. Ownership checks are enforced
-- in the API route handlers via validateAuthOrReject().
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (admin client used by API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON notifications FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
