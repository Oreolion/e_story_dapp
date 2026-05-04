// eStories Mobile - API Client
// Wraps all fetch calls with API_BASE_URL prefix and Bearer token from SecureStore

import Constants from "expo-constants";
import { getItem, setItem, removeItem } from "./storage";

const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL || "https://estories.app";

const TOKEN_KEY = "supabase_access_token";

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown> | FormData;
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
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
  if (options.body instanceof FormData) {
    body = options.body;
    // Don't set Content-Type for FormData — browser/RN sets it with boundary
  } else if (options.body) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      ...options,
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
