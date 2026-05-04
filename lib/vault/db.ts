/**
 * Vault IndexedDB Schema (Dexie.js)
 *
 * Three tables:
 *   stories   — encrypted story records
 *   vaultKeys — per-user vault key material
 *   syncQueue — pending cloud sync operations
 */

import Dexie, { type EntityTable } from "dexie";

// --- Record Types ---

export type SyncStatus = "local" | "pending" | "synced" | "error";

export interface LocalStoryRecord {
  localId: string;
  userId: string;
  /** Encrypted title (base64) */
  encrypted_title: string;
  title_iv: string;
  /** Encrypted content (base64) */
  encrypted_content: string;
  content_iv: string;
  /** Encrypted audio blob (base64), optional */
  encrypted_audio?: string;
  audio_iv?: string;
  /** Encrypted metadata JSON (base64) — mood, tags, etc. */
  encrypted_metadata?: string;
  metadata_iv?: string;
  /** SHA-256 hash of plaintext for integrity check */
  checksum: string;
  /** Cloud story ID after sync */
  cloud_id?: string;
  /** Sync state */
  sync_status: SyncStatus;
  /** Whether story is public */
  is_public: boolean;
  /** User-selected story date */
  story_date: string;
  created_at: string;
  updated_at: string;
}

export interface VaultKeyRecord {
  userId: string;
  /** PBKDF2 salt (base64) */
  salt: string;
  /** AES-KW wrapped DEK (base64) */
  wrapped_dek: string;
  /** SHA-256 PIN hash for quick verification */
  pin_hash: string;
  created_at: string;
}

export interface SyncQueueRecord {
  id?: number; // Auto-incremented
  storyLocalId: string;
  userId: string;
  action: "upload" | "update" | "delete";
  status: "pending" | "processing" | "failed";
  retryCount: number;
  lastAttempt?: string;
  error?: string;
  created_at: string;
}

// --- Database Class ---

class VaultDatabase extends Dexie {
  stories!: EntityTable<LocalStoryRecord, "localId">;
  vaultKeys!: EntityTable<VaultKeyRecord, "userId">;
  syncQueue!: EntityTable<SyncQueueRecord, "id">;

  constructor() {
    super("estory-vault");

    this.version(1).stores({
      stories: "localId, userId, sync_status, updated_at, cloud_id",
      vaultKeys: "userId",
      syncQueue: "++id, storyLocalId, userId, status",
    });
  }
}

// Singleton instance
let _db: VaultDatabase | null = null;
let _unavailableReason: string | null = null;

/**
 * Check if IndexedDB is usable in this environment. iOS Safari private mode,
 * some in-app browsers, and older devices can throw when touching indexedDB.
 */
function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.indexedDB !== "undefined" && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Get the vault database. Returns null if IndexedDB is unavailable (iOS Safari
 * private mode, disabled storage, corrupted state). Callers MUST handle null.
 */
export function getVaultDb(): VaultDatabase | null {
  if (_db) return _db;
  if (_unavailableReason) return null;

  if (!isIndexedDBAvailable()) {
    _unavailableReason = "IndexedDB not available";
    return null;
  }

  try {
    const db = new VaultDatabase();
    // Attach a catch handler so Dexie's lazy auto-open cannot surface as an
    // unhandled promise rejection on iOS Safari (UnknownError, etc.)
    db.open().catch((err) => {
      console.warn("[vault] Failed to open IndexedDB:", err);
      _unavailableReason = err?.name || "OpenFailed";
      _db = null;
    });
    _db = db;
    return _db;
  } catch (err) {
    console.warn("[vault] Failed to initialize Dexie:", err);
    _unavailableReason =
      (err as { name?: string } | null)?.name || "InitFailed";
    return null;
  }
}

/**
 * Whether the vault is usable in the current environment.
 */
export function isVaultAvailable(): boolean {
  return getVaultDb() !== null;
}

/**
 * Reset the database singleton (useful for tests).
 */
export async function resetVaultDb(): Promise<void> {
  if (_db) {
    _db.close();
    _db = null;
  }
  _unavailableReason = null;
}

export type { VaultDatabase };
