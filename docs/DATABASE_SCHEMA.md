# Database Schema (Supabase PostgreSQL)

## Current Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles (wallet, name, avatar, badges) |
| `stories` | Journal entries (title, content, mood, paywall, audio) |
| `notifications` | In-app notifications |
| `comments` | Story comments |
| `saved_stories` | Bookmarks |
| `likes` | Like records |
| `waitlist` | Pre-launch email capture |
| `verified_metrics` | CRE-verified story metrics (full data, author-only access) |
| `verification_logs` | CRE verification request audit log |
| `story_collections` | User-created story collections/series |
| `collection_stories` | Junction table: stories in collections (many-to-many) |
| `follows` | Follower relationships between users |
| `unlocked_content` | Paywall unlock records |

**Storage Bucket:** `story-audio` - Audio file uploads

**Client-Side Database:** `estory-vault` (IndexedDB via Dexie.js) - Encrypted local story storage

## Social Tables (Migration 014)

```sql
-- Likes: tracks which users liked which stories
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- Follows: tracks follower relationships
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follower_wallet TEXT,
  followed_wallet TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Comments: story comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_wallet TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved Stories (bookmarks)
CREATE TABLE saved_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- Unlocked Content (paywall)
CREATE TABLE unlocked_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);
```

## Local Vault — IndexedDB Schema (Dexie.js)

The vault is a client-side encrypted database using Dexie.js (IndexedDB wrapper). It stores stories encrypted with AES-256-GCM, keyed by a user PIN. This is **not** a Supabase table — it lives entirely in the browser.

**Database name:** `estory-vault` (singleton via `getVaultDb()` in `lib/vault/db.ts`)

### `stories` store

Encrypted story records. All text fields are base64-encoded AES-256-GCM ciphertext.

| Field | Type | Description |
|-------|------|-------------|
| `localId` (PK) | string | UUID, primary key |
| `userId` | string (indexed) | Owner's user ID |
| `encrypted_title` | string | Base64 AES-GCM ciphertext |
| `title_iv` | string | Base64 IV for title |
| `encrypted_content` | string | Base64 AES-GCM ciphertext |
| `content_iv` | string | Base64 IV for content |
| `encrypted_audio` | string? | Base64 encrypted audio blob |
| `audio_iv` | string? | Base64 IV for audio |
| `encrypted_metadata` | string? | Base64 encrypted JSON (mood, tags) |
| `metadata_iv` | string? | Base64 IV for metadata |
| `checksum` | string | SHA-256 hash of plaintext for integrity |
| `cloud_id` | string? (indexed) | Cloud story ID after sync |
| `sync_status` | SyncStatus (indexed) | `"local"` \| `"pending"` \| `"synced"` \| `"error"` |
| `is_public` | boolean | Whether story is public |
| `story_date` | string | User-selected story date |
| `created_at` | string | ISO timestamp |
| `updated_at` | string (indexed) | ISO timestamp |

### `vaultKeys` store

Per-user vault key material. One record per user.

| Field | Type | Description |
|-------|------|-------------|
| `userId` (PK) | string | Owner's user ID |
| `salt` | string | Base64 PBKDF2 salt (16 bytes) |
| `wrapped_dek` | string | Base64 AES-KW wrapped DEK |
| `pin_hash` | string | SHA-256 hash of PIN+salt for quick verification |
| `created_at` | string | ISO timestamp |

### `syncQueue` store

Pending cloud sync operations (future use).

| Field | Type | Description |
|-------|------|-------------|
| `id` (PK) | number | Auto-incremented |
| `storyLocalId` (indexed) | string | References stories.localId |
| `userId` (indexed) | string | Owner's user ID |
| `action` | string | `"upload"` \| `"update"` \| `"delete"` |
| `status` (indexed) | string | `"pending"` \| `"processing"` \| `"failed"` |
| `retryCount` | number | Retry attempts |
| `lastAttempt` | string? | ISO timestamp of last attempt |
| `error` | string? | Last error message |
| `created_at` | string | ISO timestamp |

## Waitlist Table

```sql
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT DEFAULT 'web_homepage',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_created ON waitlist(created_at DESC);
```

## CRE Verified Metrics Tables

```sql
-- Full metrics from CRE callback (author-only access via API)
CREATE TABLE verified_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  significance_score INTEGER DEFAULT 0,      -- 0-100
  emotional_depth INTEGER DEFAULT 1,          -- 1-5
  quality_score INTEGER DEFAULT 0,            -- 0-100
  word_count INTEGER DEFAULT 0,
  verified_themes TEXT[] DEFAULT '{}',
  metrics_hash TEXT,                          -- keccak256 of all metrics + salt
  quality_tier INTEGER DEFAULT 1,             -- 1-5 derived from quality_score
  meets_quality_threshold BOOLEAN DEFAULT FALSE,
  cre_attestation_id TEXT,
  on_chain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id)
);

CREATE INDEX idx_verified_metrics_story ON verified_metrics(story_id);

-- Audit log for CRE verification requests
CREATE TABLE verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
  triggered_by UUID,                       -- user who triggered verification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verification_logs_story ON verification_logs(story_id);
CREATE INDEX idx_verification_logs_status ON verification_logs(status);
```

## Story Collections Tables

```sql
-- Story collections for organizing story series
CREATE TABLE story_collections (
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

CREATE INDEX idx_collections_author ON story_collections(author_id);
CREATE INDEX idx_collections_public ON story_collections(is_public) WHERE is_public = true;

-- Junction table: stories in collections (many-to-many, position-ordered)
CREATE TABLE collection_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES story_collections(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, story_id)
);

CREATE INDEX idx_collection_stories_collection ON collection_stories(collection_id);
CREATE INDEX idx_collection_stories_story ON collection_stories(story_id);
```

**Also added by migration 007:**
- `stories.parent_story_id` — UUID FK to `stories(id)` for story continuations
- `story_metadata.actionable_advice` — TEXT column for AI-generated writing advice

## Planned Tables (Phase 1-3)

```sql
-- Phase 1: Story metadata for cognitive features
CREATE TABLE story_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,

  -- AI-extracted fields
  themes TEXT[] DEFAULT '{}',
  emotional_tone TEXT,           -- 'reflective', 'joyful', 'anxious', 'hopeful', etc.
  life_domain TEXT,              -- 'work', 'relationships', 'health', 'identity', 'growth'

  -- Scoring (Self-Defining Memory detection)
  intensity_score FLOAT DEFAULT 0,     -- 0-1, emotional charge
  significance_score FLOAT DEFAULT 0,  -- 0-1, life event importance

  -- User controls
  is_canonical BOOLEAN DEFAULT FALSE,  -- User-marked as important
  ai_readable BOOLEAN DEFAULT TRUE,    -- Consent for AI analysis

  -- Extracted entities
  people_mentioned TEXT[] DEFAULT '{}',
  places_mentioned TEXT[] DEFAULT '{}',
  time_references TEXT[] DEFAULT '{}',

  -- Brief insight from analysis
  brief_insight TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(story_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_story_metadata_themes ON story_metadata USING GIN(themes);
CREATE INDEX idx_story_metadata_domain ON story_metadata(life_domain);
CREATE INDEX idx_story_metadata_canonical ON story_metadata(is_canonical);
CREATE INDEX idx_story_metadata_story_id ON story_metadata(story_id);

-- Phase 3: Weekly AI reflections
CREATE TABLE weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  reflection_text TEXT NOT NULL,
  stories_analyzed UUID[] DEFAULT '{}',
  themes_identified TEXT[] DEFAULT '{}',
  week_start TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reflections_wallet ON weekly_reflections(user_wallet);
CREATE INDEX idx_reflections_created ON weekly_reflections(created_at DESC);
```

## Database Implementation Guidelines

When fixing database constraint errors (409 Conflict, duplicate key), check ALL unique constraints on the table, not just the primary key - include wallet_address, email, and other unique fields. The `users` table has unique constraints on both `id` and `wallet_address`, so upsert operations must handle conflicts on each independently.

## Type Definitions

### Current Types (`app/types/index.ts`)

- `AuthorProfile` - User/author info
- `StoryDataType` - Story object with all properties
- `StoryCardProps` - Story display component props
- `FeaturedWriterType` - Featured writer for discovery
- `CommentDataTypes` - Comment structure
- `Notification` - Notification object

Constants: `mockStories[]`, `featuredWriters[]`, `moodColors{}`

### Vault Types (`lib/vault/db.ts`, `app/hooks/useLocalStories.ts`)

```typescript
export type SyncStatus = "local" | "pending" | "synced" | "error";

export interface LocalStoryRecord {
  localId: string;
  userId: string;
  encrypted_title: string;
  title_iv: string;
  encrypted_content: string;
  content_iv: string;
  encrypted_audio?: string;
  audio_iv?: string;
  encrypted_metadata?: string;
  metadata_iv?: string;
  checksum: string;
  cloud_id?: string;
  sync_status: SyncStatus;
  is_public: boolean;
  story_date: string;
  created_at: string;
  updated_at: string;
}

export interface VaultKeyRecord {
  userId: string;
  salt: string;
  wrapped_dek: string;
  pin_hash: string;
  created_at: string;
}

export interface SyncQueueRecord {
  id?: number;
  storyLocalId: string;
  userId: string;
  action: "upload" | "update" | "delete";
  status: "pending" | "processing" | "failed";
  retryCount: number;
  lastAttempt?: string;
  error?: string;
  created_at: string;
}

// Decrypted story for UI consumption
export interface DecryptedStory {
  localId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  cloud_id?: string;
  sync_status: SyncStatus;
  is_public: boolean;
  story_date: string;
  created_at: string;
  updated_at: string;
}

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}
```

### Planned Types (Phase 1)

```typescript
export interface StoryMetadata {
  id: string;
  story_id: string;
  themes: string[];
  emotional_tone: EmotionalTone;
  life_domain: LifeDomain;
  intensity_score: number;
  significance_score: number;
  is_canonical: boolean;
  ai_readable: boolean;
  people_mentioned: string[];
  places_mentioned: string[];
  time_references: string[];
  brief_insight: string | null;
  created_at: string;
  updated_at: string;
}

export type EmotionalTone =
  | 'reflective' | 'joyful' | 'anxious' | 'hopeful' | 'melancholic'
  | 'grateful' | 'frustrated' | 'peaceful' | 'excited' | 'uncertain';

export type LifeDomain =
  | 'work' | 'relationships' | 'health' | 'identity' | 'growth'
  | 'creativity' | 'spirituality' | 'family' | 'adventure' | 'learning';

export interface NarrativeObject extends StoryDataType {
  metadata?: StoryMetadata;
}

export interface WeeklyReflection {
  id: string;
  user_wallet: string;
  reflection_text: string;
  stories_analyzed: string[];
  themes_identified: string[];
  week_start: string;
  created_at: string;
}
```
