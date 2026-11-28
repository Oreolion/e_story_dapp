// Navigation hints are not credentials or authorization. The server still owns
// all access decisions. Keep the registered OAuth callback URL unchanged.
const KEY = "estories_login_destination_v1";
const MAX_AGE = 10 * 60 * 1000;
let fallback: { path: string; at: number } | null = null;
let ignoreStored = false;

export function safeDestination(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 240 || /[%\\\s#]/.test(value))
    return null;
  if (value.split("?").length > 2) return null;
  const [path, query] = value.split("?");
  const simple = [
    "/home",
    "/record",
    "/library",
    "/social",
    "/profile",
    "/pricing",
    "/tracker",
    "/books",
  ];
  if (
    !simple.includes(path) &&
    !/^\/(story|books|library\/collections)\/[a-zA-Z0-9_-]{1,80}$/.test(path)
  )
    return null;
  if (
    query !== undefined &&
    !(
      path === "/record" &&
      /^(parentId=[a-zA-Z0-9_-]{1,80}|mode=interview)$/.test(query)
    ) &&
    !(
      ["/home", "/social"].includes(path) &&
      /^tab=(feed|following|trending)$/.test(query)
    )
  )
    return null;
  return value;
}

export function rememberDestination(value: unknown) {
  if (typeof window === "undefined") return;
  const hint = { path: safeDestination(value) ?? "/home", at: Date.now() };
  fallback = hint;
  ignoreStored = false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(hint));
  } catch {
    /* Tab memory remains available. */
  }
}

export function pendingDestination(): string | null {
  if (typeof window === "undefined") return null;
  let hint = fallback;
  try {
    const stored =
      !fallback && !ignoreStored ? sessionStorage.getItem(KEY) : null;
    if (stored) hint = JSON.parse(stored);
  } catch {
    /* Use this tab's memory when storage is unavailable. */
  }
  if (
    !hint ||
    !Number.isFinite(hint.at) ||
    Date.now() - hint.at > MAX_AGE ||
    hint.at > Date.now() + 5000
  )
    return null;
  return safeDestination(hint.path);
}

export function clearDestination() {
  fallback = null;
  ignoreStored = true;
  if (typeof window !== "undefined")
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* No persistent hint to remove. */
    }
}

export function authDestination({
  loading,
  authenticated,
  onboarding,
  pathname,
  intent,
}: {
  loading: boolean;
  authenticated: boolean;
  onboarding: boolean;
  pathname: string;
  intent: string | null;
}): string | null {
  if (loading || !authenticated || pathname === "/onboarding") return null;
  if (onboarding) return "/onboarding";
  return pathname === "/" || intent
    ? (safeDestination(intent) ?? "/home")
    : null;
}
