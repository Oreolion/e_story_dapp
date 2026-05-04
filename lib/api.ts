/**
 * Auth-aware API fetch utilities.
 *
 * All data fetching should go through these helpers so that:
 *   - Auth tokens are injected automatically
 *   - 401s trigger auth re-validation
 *   - Network errors are handled consistently
 */

const API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildHeaders(
  token: string | null,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (token && token !== "cookie") {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch JSON from an API endpoint with auth headers and timeout.
 * Throws ApiError on non-2xx status.
 */
export async function apiFetch<T>(
  token: string | null,
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(input, {
      ...init,
      headers: buildHeaders(
        token,
        init.headers as Record<string, string> | undefined
      ),
      signal: controller.signal,
      credentials: "same-origin",
    });

    if (!res.ok) {
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }
      throw new ApiError(
        res.status,
        (data as any)?.error || `HTTP ${res.status}`,
        data
      );
    }

    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function apiGet<T>(token: string | null, url: string) {
  return apiFetch<T>(token, url, { method: "GET" });
}

export function apiPost<T>(token: string | null, url: string, body: unknown) {
  return apiFetch<T>(token, url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(token: string | null, url: string, body: unknown) {
  return apiFetch<T>(token, url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(token: string | null, url: string) {
  return apiFetch<T>(token, url, { method: "DELETE" });
}
