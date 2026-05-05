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
  refreshPendingCount: () => Promise<void>;
  sync: (executeRequest: (req: QueuedRequest) => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
  init: () => () => void; // returns unsubscribe function
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastSyncResult: null,

  setOnline: (online) => {
    const wasOffline = !get().isOnline && online;
    set({ isOnline: online });

    // Auto-sync when coming back online
    if (wasOffline && get().pendingCount > 0) {
      // The sync function will be called by the component/hook that has executeRequest
    }
  },

  setSyncing: (syncing) => set({ isSyncing: syncing }),

  refreshPendingCount: async () => {
    const count = await getPendingCount();
    set({ pendingCount: count });
  },

  sync: async (executeRequest) => {
    if (get().isSyncing) return;

    set({ isSyncing: true });
    try {
      const result = await processQueue(executeRequest);
      set({
        lastSyncAt: Date.now(),
        lastSyncResult: result,
        pendingCount: await getPendingCount(),
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  init: () => {
    // Check initial network state
    isOnline().then((online) => set({ isOnline: online }));
    get().refreshPendingCount();

    // Subscribe to network changes
    const unsubscribe = onNetworkChange((online) => {
      get().setOnline(online);
    });

    return unsubscribe;
  },
}));
