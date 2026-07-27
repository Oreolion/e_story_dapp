import { create } from "zustand";
import { getPendingCount, isOnline, onNetworkChange, processQueue } from "../lib/offline";
import type { QueuedRequest } from "../lib/offline";

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastSyncResult: { processed: number; failed: number } | null;

  // Actions
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  refreshPendingCount: (ownerId: string | null) => Promise<void>;
  sync: (
    ownerId: string,
    executeRequest: (req: QueuedRequest) => Promise<{ ok: boolean; error?: string }>
  ) => Promise<void>;
  init: () => () => void; // returns unsubscribe function
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastSyncResult: null,

  setOnline: (online) => {
    set({ isOnline: online });
  },

  setSyncing: (syncing) => set({ isSyncing: syncing }),

  refreshPendingCount: async (ownerId) => {
    const count = ownerId ? await getPendingCount(ownerId) : 0;
    set({ pendingCount: count });
  },

  sync: async (ownerId, executeRequest) => {
    if (get().isSyncing) return;

    set({ isSyncing: true });
    try {
      const result = await processQueue(ownerId, executeRequest);
      set({
        lastSyncAt: Date.now(),
        lastSyncResult: result,
        pendingCount: await getPendingCount(ownerId),
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  init: () => {
    // Check initial network state
    isOnline().then((online) => set({ isOnline: online }));

    // Subscribe to network changes
    const unsubscribe = onNetworkChange((online) => {
      get().setOnline(online);
    });

    return unsubscribe;
  },
}));
