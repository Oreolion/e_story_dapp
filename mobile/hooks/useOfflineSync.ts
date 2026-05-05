import { useEffect, useRef } from "react";
import { useSyncStore } from "../stores/syncStore";
import { api } from "../lib/api";
import type { QueuedRequest } from "../lib/offline";

/**
 * Hook to initialize offline sync monitoring
 * - Listens for network changes
 * - Auto-syncs queued mutations when coming back online
 * - Provides pending count and sync status
 *
 * Usage: Call once at app root (in _layout.tsx or a provider)
 */
export function useOfflineSync() {
  const init = useSyncStore((s) => s.init);
  const sync = useSyncStore((s) => s.sync);
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);
  const wasOfflineRef = useRef(false);

  // Initialize network monitoring
  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOfflineRef.current && pendingCount > 0) {
      sync(executeQueuedRequest);
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline, pendingCount, sync]);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing: useSyncStore((s) => s.isSyncing),
    lastSyncAt: useSyncStore((s) => s.lastSyncAt),
    syncNow: () => sync(executeQueuedRequest),
  };
}

/**
 * Execute a single queued request using the main API client
 */
async function executeQueuedRequest(req: QueuedRequest): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await api(req.path, {
      method: req.method,
      body: req.body,
      headers: req.headers,
    });
    return { ok: result.ok, error: result.error };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message };
  }
}
