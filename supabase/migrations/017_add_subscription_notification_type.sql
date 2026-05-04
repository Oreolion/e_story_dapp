-- Add 'subscription' to the notifications type check constraint
-- Needed for subscription activation/expiry notifications

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'tip', 'follow', 'book_published', 'story_mentioned', 'subscription'));
