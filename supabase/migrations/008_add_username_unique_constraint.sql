-- ============================================================================
-- Migration 008: Add UNIQUE constraint on username
--
-- The onboarding API checks username availability at the application layer,
-- but without a DB constraint, concurrent requests can create duplicates.
-- This partial unique index prevents that race condition.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON public.users (username) WHERE username IS NOT NULL;
