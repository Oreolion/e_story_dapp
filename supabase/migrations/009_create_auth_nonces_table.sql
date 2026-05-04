-- ============================================================================
-- Migration 009: Create auth_nonces table for wallet login
--
-- Replaces in-memory Map() nonce store that fails in multi-instance
-- serverless deployments (Vercel). Nonces are one-time use with 5-min expiry.
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_nonces (
  address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (address)
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_auth_nonces_created ON auth_nonces(created_at);

-- RLS: only service_role can access (used by API routes via admin client)
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
