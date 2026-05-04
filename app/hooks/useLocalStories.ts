"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import {
  getVaultDb,
  getDEK,
  isVaultUnlocked,
  encryptString,
  decryptString,
  encryptData,
  arrayBufferToBase64,
  type LocalStoryRecord,
  type SyncStatus,
} from "@/lib/vault";

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

export interface UseLocalStoriesResult {
  stories: DecryptedStory[];
  isLoading: boolean;
  error: string | null;
  saveStory: (params: SaveStoryParams) => Promise<string>;
  getDecryptedStory: (localId: string) => Promise<DecryptedStory | null>;
  deleteStory: (localId: string) => Promise<void>;
  updateSyncStatus: (localId: string, status: SyncStatus, cloudId?: string) => Promise<void>;
}

export interface SaveStoryParams {
  title: string;
  content: string;
  audioBlob?: Blob;
  metadata?: Record<string, unknown>;
  is_public: boolean;
  story_date: string;
  cloud_id?: string;
  sync_status?: SyncStatus;
}

export function useLocalStories(): UseLocalStoriesResult {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [decryptedStories, setDecryptedStories] = useState<DecryptedStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reactive query — re-runs whenever IndexedDB stories table changes
  const encryptedRecords = useLiveQuery(
    async () => {
      if (!userId) return [];
      const db = getVaultDb();
      if (!db) return [];
      try {
        return await db.stories
          .where("userId")
          .equals(userId)
          .reverse()
          .sortBy("updated_at");
      } catch (err) {
        console.warn("[useLocalStories] Live query failed:", err);
        return [];
      }
    },
    [userId],
    []
  );

  // Decrypt records when they change or vault is unlocked
  useEffect(() => {
    if (!userId || !encryptedRecords || encryptedRecords.length === 0) {
      setDecryptedStories([]);
      setIsLoading(false);
      return;
    }

    if (!isVaultUnlocked(userId)) {
      setDecryptedStories([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setIsLoading(true);
        const dek = getDEK(userId);
        const results: DecryptedStory[] = [];

        for (const record of encryptedRecords) {
          try {
            const title = await decryptString(record.encrypted_title, record.title_iv, dek);
            const content = await decryptString(record.encrypted_content, record.content_iv, dek);

            let metadata: Record<string, unknown> | undefined;
            if (record.encrypted_metadata && record.metadata_iv) {
              const metaJson = await decryptString(record.encrypted_metadata, record.metadata_iv, dek);
              metadata = JSON.parse(metaJson);
            }

            results.push({
              localId: record.localId,
              title,
              content,
              metadata,
              cloud_id: record.cloud_id,
              sync_status: record.sync_status,
              is_public: record.is_public,
              story_date: record.story_date,
              created_at: record.created_at,
              updated_at: record.updated_at,
            });
          } catch (decryptErr) {
            console.error(`[useLocalStories] Failed to decrypt story ${record.localId}:`, decryptErr);
          }
        }

        if (mounted) {
          setDecryptedStories(results);
          setError(null);
        }
      } catch (err) {
        console.error("[useLocalStories] Decryption error:", err);
        if (mounted) setError("Failed to decrypt local stories");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, encryptedRecords]);

  const saveStory = useCallback(
    async (params: SaveStoryParams): Promise<string> => {
      if (!userId) throw new Error("Not signed in");
      if (!isVaultUnlocked(userId)) throw new Error("Vault is locked");

      const dek = getDEK(userId);
      const now = new Date().toISOString();
      const localId = crypto.randomUUID();

      const encTitle = await encryptString(params.title, dek);
      const encContent = await encryptString(params.content, dek);

      let encAudio: string | undefined;
      let audioIv: string | undefined;
      if (params.audioBlob) {
        const audioBuffer = await params.audioBlob.arrayBuffer();
        const { ciphertext, iv } = await encryptData(audioBuffer, dek);
        encAudio = arrayBufferToBase64(ciphertext);
        audioIv = arrayBufferToBase64(iv.buffer);
      }

      let encMeta: string | undefined;
      let metaIv: string | undefined;
      if (params.metadata) {
        const metaResult = await encryptString(JSON.stringify(params.metadata), dek);
        encMeta = metaResult.ciphertext;
        metaIv = metaResult.iv;
      }

      // Compute checksum of plaintext for integrity
      const encoder = new TextEncoder();
      const checksumData = encoder.encode(params.title + params.content);
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        checksumData as unknown as BufferSource
      );
      const checksum = arrayBufferToBase64(hashBuffer);

      const record: LocalStoryRecord = {
        localId,
        userId,
        encrypted_title: encTitle.ciphertext,
        title_iv: encTitle.iv,
        encrypted_content: encContent.ciphertext,
        content_iv: encContent.iv,
        encrypted_audio: encAudio,
        audio_iv: audioIv,
        encrypted_metadata: encMeta,
        metadata_iv: metaIv,
        checksum,
        cloud_id: params.cloud_id,
        sync_status: params.sync_status ?? "local",
        is_public: params.is_public,
        story_date: params.story_date,
        created_at: now,
        updated_at: now,
      };

      const db = getVaultDb();
      if (!db) throw new Error("Local vault is not supported in this browser");
      await db.stories.put(record);

      return localId;
    },
    [userId]
  );

  const getDecryptedStory = useCallback(
    async (localId: string): Promise<DecryptedStory | null> => {
      if (!userId || !isVaultUnlocked(userId)) return null;

      const db = getVaultDb();
      if (!db) return null;
      const record = await db.stories.get(localId);
      if (!record || record.userId !== userId) return null;

      const dek = getDEK(userId);
      const title = await decryptString(record.encrypted_title, record.title_iv, dek);
      const content = await decryptString(record.encrypted_content, record.content_iv, dek);

      let metadata: Record<string, unknown> | undefined;
      if (record.encrypted_metadata && record.metadata_iv) {
        const metaJson = await decryptString(record.encrypted_metadata, record.metadata_iv, dek);
        metadata = JSON.parse(metaJson);
      }

      return {
        localId: record.localId,
        title,
        content,
        metadata,
        cloud_id: record.cloud_id,
        sync_status: record.sync_status,
        is_public: record.is_public,
        story_date: record.story_date,
        created_at: record.created_at,
        updated_at: record.updated_at,
      };
    },
    [userId]
  );

  const deleteStory = useCallback(
    async (localId: string) => {
      if (!userId) throw new Error("Not signed in");
      const db = getVaultDb();
      if (!db) return;
      await db.stories.delete(localId);
    },
    [userId]
  );

  const updateSyncStatus = useCallback(
    async (localId: string, status: SyncStatus, cloudId?: string) => {
      if (!userId) throw new Error("Not signed in");
      const db = getVaultDb();
      if (!db) return;
      const update: Partial<LocalStoryRecord> = {
        sync_status: status,
        updated_at: new Date().toISOString(),
      };
      if (cloudId !== undefined) update.cloud_id = cloudId;
      await db.stories.update(localId, update);
    },
    [userId]
  );

  return {
    stories: decryptedStories,
    isLoading,
    error,
    saveStory,
    getDecryptedStory,
    deleteStory,
    updateSyncStatus,
  };
}
