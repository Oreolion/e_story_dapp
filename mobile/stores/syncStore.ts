import { create } from "zustand";
import { getPendingCount, isOnline, onNetworkChange, processQueue } from "../lib/offline";
import type { QueuedRequest } from "../lib/offline";

interface SyncState {
  activeOwnerId: string | null;
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
  activeOwnerId: null,
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
    if (get().activeOwnerId !== ownerId) {
      set({
        activeOwnerId: ownerId,
        pendingCount: 0,
        lastSyncAt: null,
        lastSyncResult: null,
      });
    }

    const count = ownerId ? await getPendingCount(ownerId) : 0;
    if (get().activeOwnerId === ownerId) {
      set({ pendingCount: count });
    }
  },

  sync: async (ownerId, executeRequest) => {
    if (get().activeOwnerId !== ownerId) {
      set({
        activeOwnerId: ownerId,
        pendingCount: 0,
        lastSyncAt: null,
        lastSyncResult: null,
      });
    }

    if (get().isSyncing) return;

    set({ isSyncing: true });
    try {
      const result = await processQueue(ownerId, executeRequest);
      const pendingCount = await getPendingCount(ownerId);
      if (get().activeOwnerId === ownerId) {
        set({
          lastSyncAt: Date.now(),
          lastSyncResult: result,
          pendingCount,
        });
      }
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
