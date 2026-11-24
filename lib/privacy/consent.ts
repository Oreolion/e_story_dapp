export type ConsentChoice = "all" | "essential" | null;
const KEY = "estories_cookie_consent";
// If storage is blocked, a denial must still apply for this page's lifetime.
let volatileChoice: ConsentChoice = null;
export function getConsent(): ConsentChoice {
  if (typeof window === "undefined") return null;
  if (volatileChoice) return volatileChoice;
  try {
    const value = localStorage.getItem(KEY);
    return value === "all" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}
export function saveConsent(choice: Exclude<ConsentChoice, null>): boolean {
  try {
    localStorage.setItem(KEY, choice);
    volatileChoice = null;
    return true;
  } catch {
    volatileChoice = "essential";
    return false;
  }
}
