import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const SYNC_QUEUE_KEY = "@estory:sync_queue";
const SYNC_LOCK_KEY = "@estory:sync_lock";

export interface QueuedRequest {
  id: string;
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
}

let isProcessingQueue = false;

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Subscribe to network state changes
 */
export function onNetworkChange(callback: (isOnline: boolean) => void) {
  return NetInfo.addEventListener((state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    callback(online);
  });
}

/**
 * Get all queued requests
 */
export async function getQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save queue to AsyncStorage
 */
async function saveQueue(queue: QueuedRequest[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add a request to the sync queue
 */
export async function enqueue(request: Omit<QueuedRequest, "id" | "timestamp" | "retryCount">): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...request,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
  });
  await saveQueue(queue);
}

/**
 * Remove a request from the queue by ID
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await saveQueue(filtered);
}

/**
 * Clear entire queue
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Get count of pending items
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Process the sync queue — retry all pending requests
 * This should be called when coming back online
 */
export async function processQueue(
  executeRequest: (req: QueuedRequest) => Promise<{ ok: boolean; error?: string }>
): Promise<{ processed: number; failed: number }> {
  // Prevent concurrent queue processing
  if (isProcessingQueue) {
    return { processed: 0, failed: 0 };
  }

  const online = await isOnline();
  if (!online) {
    return { processed: 0, failed: 0 };
  }

  isProcessingQueue = true;

  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    const remaining: QueuedRequest[] = [];

    for (const req of queue) {
      // Max 3 retries
      if (req.retryCount >= 3) {
        failed++;
        continue; // Drop permanently failed requests
      }

      try {
        const result = await executeRequest(req);
        if (result.ok) {
          processed++;
        } else {
          req.retryCount++;
          remaining.push(req);
        }
      } catch {
        req.retryCount++;
        remaining.push(req);
      }
    }

    await saveQueue(remaining);
    return { processed, failed };
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Acquire a simple lock to prevent duplicate sync processing across app restarts
 */
export async function acquireSyncLock(): Promise<boolean> {
  const existing = await AsyncStorage.getItem(SYNC_LOCK_KEY);
  if (existing) {
    const lockTime = parseInt(existing, 10);
    // Lock expires after 5 minutes
    if (Date.now() - lockTime < 5 * 60 * 1000) {
      return false;
    }
  }
  await AsyncStorage.setItem(SYNC_LOCK_KEY, Date.now().toString());
  return true;
}

export async function releaseSyncLock(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_LOCK_KEY);
}
