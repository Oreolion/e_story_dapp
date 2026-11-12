// Server/Edge only. No database, Node crypto, provider calls or client imports.
type EnvironmentValues = Record<string, string | undefined>;
export const COHORT_ENTRY = "/api/release/access";
export const COHORT_COOKIE = "__Host-istory_operator";
export const COHORT_TTL_SECONDS = 1800;
const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decode(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
    return bytes.length === 32 && encode(bytes) === value ? bytes : null;
  } catch { return null; }
}
function configuration(env: EnvironmentValues) {
  if (env.APP_FRONTDOOR_MODE === undefined || env.APP_FRONTDOOR_MODE === "open") return { mode: "open" as const };
  const invalid = { mode: "invalid" as const };
  if (env.APP_FRONTDOOR_MODE !== "operator") return invalid;
  const secret = decode(env.RELEASE_COHORT_SECRET ?? "");
  const id = env.RELEASE_COHORT_ID ?? "", commit = env.VERCEL_GIT_COMMIT_SHA ?? "", artifact = env.VERCEL_DEPLOYMENT_ID ?? "";
  if (!secret || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id) ||
    !/^[a-f0-9]{40}$/i.test(commit) || !/^dpl_[a-zA-Z0-9]{8,80}$/.test(artifact)) return invalid;
  if (env.AI_PROVIDER_MODE !== "disabled" || env.PAYMENT_PROVIDER_MODE !== "disabled" ||
    [env.AI_WORKER_ENABLED, env.PAYMENT_NOTICE_WORKER_ENABLED].some(flag => flag !== undefined && flag !== "false")) return invalid;
  let origin: URL;
  try { origin = new URL(env.NEXT_PUBLIC_APP_URL ?? ""); } catch { return invalid; }
  const localTest = ["ci", "test", "development"].includes(env.APP_ENV ?? "") && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    (origin.protocol !== "https:" && !(localTest && origin.protocol === "http:"))) return invalid;
  return { mode: "operator" as const, secret, origin: origin.origin, context: ["istory-operator-cookie-v1", id.toLowerCase(), commit.toLowerCase(), artifact, origin.origin].join("\n") };
}
export function cohortMode(env: EnvironmentValues = process.env) { return configuration(env).mode; }
export function cohortOrigin(env: EnvironmentValues = process.env): string | null {
  const config = configuration(env); return config.mode === "operator" ? config.origin : null;
}
const key = (bytes: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function issueCohortCookie(accessCode: string, env: EnvironmentValues = process.env, now = Date.now()): Promise<string | null> {
  const config = configuration(env), supplied = decode(accessCode);
  if (config.mode !== "operator" || !supplied || !Number.isFinite(now)) return null;
  const serverKey = await key(config.secret);
  // Native Web Crypto verification avoids comparing the secret in JS strings.
  const challenge = encoder.encode("istory-operator-entry-v1");
  const proof = await crypto.subtle.sign("HMAC", await key(supplied), challenge);
  if (!await crypto.subtle.verify("HMAC", serverKey, proof, challenge)) return null;
  const issued = String(Math.floor(now / 1000));
  const signature = await crypto.subtle.sign("HMAC", serverKey, encoder.encode(config.context + "\n" + issued));
  return issued + "." + encode(new Uint8Array(signature));
}
export async function verifyCohortCookie(cookie: string | null | undefined, env: EnvironmentValues = process.env, now = Date.now()): Promise<boolean> {
  const config = configuration(env);
  if (config.mode !== "operator" || !cookie || cookie.length !== 54 || !Number.isFinite(now)) return false;
  const [issued, encoded] = cookie.split(".");
  const signature = decode(encoded ?? "");
  const age = Math.floor(now / 1000) - Number(issued);
  // Allow five seconds of Node/Edge clock skew, never an unbounded future proof.
  if (!/^\d{10}$/.test(issued) || !signature || age < -5 || age >= COHORT_TTL_SECONDS) return false;
  return crypto.subtle.verify("HMAC", await key(config.secret), signature, encoder.encode(config.context + "\n" + issued));
}
