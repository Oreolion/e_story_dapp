-- ============================================================================
-- Migration 016: Fix Supabase Security Linter Warnings
--
-- Fixes:
-- [ERROR] RLS disabled on: likes, follows, saved_stories
-- [WARN]  Overly permissive RLS policies on: books, notifications, payments
-- [WARN]  Function search_path mutable: public.current_setting
-- [INFO]  RLS enabled but no policies: auth_nonces
--
-- Architecture note:
--   All data access goes through API routes using the admin client (service_role),
--   which bypasses RLS. These policies are defense-in-depth for direct PostgREST
--   access. Wallet users don't have Supabase auth.uid(), so policies use
--   owner-check patterns that work for OAuth users while the admin client
--   handles wallet users server-side.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Enable RLS on tables that are missing it
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_stories ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Add proper RLS policies for likes
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can read likes (public social data)
CREATE POLICY "Anyone can read likes"
  ON likes FOR SELECT
  USING (true);

-- Authenticated users can insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own likes (unlike)
CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Add proper RLS policies for follows
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can read follows (public social data)
CREATE POLICY "Anyone can read follows"
  ON follows FOR SELECT
  USING (true);

-- Authenticated users can insert their own follows
CREATE POLICY "Users can insert their own follows"
  ON follows FOR INSERT
  WITH CHECK (auth.uid()::text = follower_id::text);

-- Users can delete their own follows (unfollow)
CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  USING (auth.uid()::text = follower_id::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Add proper RLS policies for saved_stories
-- ═══════════════════════════════════════════════════════════════════════════

-- Users can read their own saved stories
CREATE POLICY "Users can read their own saved stories"
  ON saved_stories FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Users can save stories (insert)
CREATE POLICY "Users can insert their own saved stories"
  ON saved_stories FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Users can unsave stories (delete)
CREATE POLICY "Users can delete their own saved stories"
  ON saved_stories FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Fix overly permissive books INSERT policy
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the permissive policy and replace with owner-scoped one
DROP POLICY IF EXISTS "Users can create books" ON books;

CREATE POLICY "Users can create their own books"
  ON books FOR INSERT
  WITH CHECK (auth.uid()::text = author_id::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Fix overly permissive notifications policy
--    Replace blanket USING(true) with user-scoped policies
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role full access" ON notifications;

-- Users can read their own notifications
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Fix overly permissive payments policy
--    Replace blanket USING(true) with user-scoped policies
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role full access on payments" ON payments;

-- Users can read their own payments
CREATE POLICY "Users can read their own payments"
  ON payments FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- No direct INSERT/UPDATE/DELETE for payments — only via admin client in API routes

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Add policy for auth_nonces (RLS enabled, no policies)
--    Nonces are server-only — no client access allowed
-- ═══════════════════════════════════════════════════════════════════════════

-- Deny all direct client access (service_role bypasses RLS anyway)
CREATE POLICY "No direct client access to nonces"
  ON auth_nonces FOR SELECT
  USING (false);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Fix function search_path on public.current_setting
--    Set immutable search_path to prevent search_path injection
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'current_setting'
  ) THEN
    ALTER FUNCTION public.current_setting SET search_path = '';
  END IF;
END
$$;
