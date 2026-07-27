import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const SYNC_QUEUE_KEY = "@estory:sync_queue";
const SYNC_LOCK_KEY = "@estory:sync_lock";

export interface QueuedRequest {
  id: string;
  ownerId: string;
  idempotencyKey: string;
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

let isProcessingQueue = false;
type QueueChangeListener = (ownerId: string | null) => void;
const queueChangeListeners = new Set<QueueChangeListener>();

function emitQueueChange(ownerId: string | null): void {
  queueChangeListeners.forEach((listener) => listener(ownerId));
}

export function onQueueChange(listener: QueueChangeListener): () => void {
  queueChangeListeners.add(listener);
  return () => queueChangeListeners.delete(listener);
}

function isQueuedRequest(value: unknown): value is QueuedRequest {
  if (!value || typeof value !== "object") return false;

  const request = value as Partial<QueuedRequest>;
  return (
    typeof request.id === "string" &&
    typeof request.ownerId === "string" &&
    request.ownerId.length > 0 &&
    typeof request.idempotencyKey === "string" &&
    request.idempotencyKey.length > 0 &&
    typeof request.path === "string" &&
    request.path.startsWith("/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method ?? "") &&
    typeof request.timestamp === "number" &&
    typeof request.retryCount === "number"
  );
}

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
export async function getQueue(ownerId?: string): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Never replay legacy/unscoped queue entries created before owner scoping.
    const validQueue = parsed.filter(isQueuedRequest);
    if (validQueue.length !== parsed.length) {
      await saveQueue(validQueue);
    }

    return ownerId
      ? validQueue.filter((request) => request.ownerId === ownerId)
      : validQueue;
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
  emitQueueChange(request.ownerId);
}

/**
 * Remove a request from the queue by ID
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const removed = queue.find((item) => item.id === id);
  const filtered = queue.filter((item) => item.id !== id);
  await saveQueue(filtered);
  if (removed) emitQueueChange(removed.ownerId);
}

/**
 * Clear entire queue
 */
export async function clearQueue(ownerId?: string): Promise<void> {
  if (!ownerId) {
    await Promise.all([
      AsyncStorage.removeItem(SYNC_QUEUE_KEY),
      AsyncStorage.removeItem(SYNC_LOCK_KEY),
    ]);
    emitQueueChange(null);
    return;
  }

  const queue = await getQueue();
  await saveQueue(queue.filter((item) => item.ownerId !== ownerId));
  emitQueueChange(ownerId);
}

/**
 * Get count of pending items
 */
export async function getPendingCount(ownerId?: string): Promise<number> {
  const queue = await getQueue(ownerId);
  return queue.length;
}

/**
 * Process the sync queue — retry all pending requests
 * This should be called when coming back online
 */
export async function processQueue(
  ownerId: string,
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
    const allRequests = await getQueue();
    const queue = allRequests.filter((request) => request.ownerId === ownerId);
    if (queue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    const remaining = allRequests.filter(
      (request) => request.ownerId !== ownerId
    );

    for (const req of queue) {
      // Max 3 retries
      if (req.retryCount >= 3) {
        failed++;
        remaining.push(req); // Keep for user-visible/manual recovery.
        continue;
      }

      try {
        const result = await executeRequest(req);
        if (result.ok) {
          processed++;
        } else {
          req.retryCount++;
          req.lastError = result.error || "Request failed";
          remaining.push(req);
        }
      } catch (error) {
        req.retryCount++;
        req.lastError =
          error instanceof Error ? error.message : "Request failed";
        remaining.push(req);
      }
    }

    await saveQueue(remaining);
    emitQueueChange(ownerId);
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
