// eStories Mobile - API Client
// Wraps all fetch calls with API_BASE_URL prefix and Bearer token from SecureStore
// Includes offline queue support for mutations (POST/PUT/PATCH/DELETE)

import Constants from "expo-constants";
import { getItem, setItem, removeItem } from "./storage";
import { enqueue, isOnline } from "./offline";

const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL || "https://estories.app";

const TOKEN_KEY = "supabase_access_token";

function withoutAuthorization(
  headers: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => name.toLowerCase() !== "authorization"
    )
  );
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown> | FormData;
  offlineQueue?: {
    ownerId: string;
    idempotencyKey: string;
  };
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
  queued?: boolean;
}

/**
 * Main API client. Automatically:
 * - Prefixes relative paths with API_BASE_URL
 * - Injects Bearer token from SecureStore
 * - Handles JSON serialization/parsing
 * - Returns typed responses
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const { body: requestBody, offlineQueue, ...requestOptions } = options;

  // Get auth token
  const token = await getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add auth header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Handle body serialization
  let body: string | FormData | undefined;
  if (requestBody instanceof FormData) {
    body = requestBody;
    // Don't set Content-Type for FormData — browser/RN sets it with boundary
  } else if (requestBody) {
    body = JSON.stringify(requestBody);
    headers["Content-Type"] = "application/json";
  }

  if (offlineQueue?.idempotencyKey) {
    headers["Idempotency-Key"] = offlineQueue.idempotencyKey;
  }

  try {
    const response = await fetch(url, {
      ...requestOptions,
      headers,
      body,
    });

    const contentType = response.headers.get("content-type");
    let data: T | undefined;

    if (contentType?.includes("application/json")) {
      data = (await response.json()) as T;
    }

    return {
      data,
      status: response.status,
      ok: response.ok,
      error: response.ok ? undefined : (data as Record<string, string>)?.error || "Request failed",
    };
  } catch (err) {
    console.error(`[API] ${options.method || "GET"} ${path} failed:`, err);

    // Queue mutations for retry when offline
    const method = (options.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const isNetworkError = err instanceof TypeError || (err as Error)?.message?.includes("Network");
    const queuePolicy =
      offlineQueue &&
      offlineQueue.ownerId.trim().length > 0 &&
      offlineQueue.idempotencyKey.trim().length > 0
        ? offlineQueue
        : null;

    if (
      isMutation &&
      isNetworkError &&
      requestBody &&
      !(requestBody instanceof FormData) &&
      queuePolicy &&
      path.startsWith("/")
    ) {
      const online = await isOnline();
      if (!online) {
        await enqueue({
          path,
          method: method as "POST" | "PUT" | "PATCH" | "DELETE",
          body: requestBody as Record<string, unknown>,
          // The active token is injected at replay time; never persist it in AsyncStorage.
          headers: withoutAuthorization(headers),
          ownerId: queuePolicy.ownerId,
          idempotencyKey: queuePolicy.idempotencyKey,
        });
        return {
          status: 0,
          ok: false,
          queued: true,
          error: "Offline — change saved and will sync when you're back online.",
        };
      }
    }

    return {
      status: 0,
      ok: false,
      error: "Network error. Please check your connection.",
    };
  }
}

// Convenience methods
export const apiGet = <T>(path: string) =>
  api<T>(path, { method: "GET" });

export const apiPost = <T>(path: string, body?: Record<string, unknown>) =>
  api<T>(path, { method: "POST", body });

export const apiPut = <T>(path: string, body?: Record<string, unknown>) =>
  api<T>(path, { method: "PUT", body });

export const apiDelete = <T>(path: string, body?: Record<string, unknown>) =>
  api<T>(path, { method: "DELETE", body });

export const apiPatch = <T>(path: string, body?: Record<string, unknown>) =>
  api<T>(path, { method: "PATCH", body });

export const apiUpload = <T>(path: string, formData: FormData) =>
  api<T>(path, { method: "POST", body: formData });

// Token management
export async function setAuthToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function clearAuthToken(): Promise<void> {
  await removeItem(TOKEN_KEY);
}
