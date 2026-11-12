import { assertReleaseActive } from "./release";
import { cohortMode } from "./cohort";

export type AppEnvironment = "development" | "test" | "ci" | "staging" | "production";
type EnvironmentValues = Record<string, string | undefined>;
export class RuntimeConfigurationError extends Error {
  constructor() { super("Deployment configuration is unavailable or inconsistent"); }
}
function fail(): never { throw new RuntimeConfigurationError(); }
function origin(value: string | undefined, hosted: boolean): URL {
  if (!value) return fail();
  let url: URL;
  try { url = new URL(value); } catch { return fail(); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return fail();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && !hosted && url.protocol === "http:")) return fail();
  return url;
}
function flag(value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  return fail();
}
export function runtimeConfiguration(env: EnvironmentValues = process.env) {
  assertReleaseActive(env);
  if (cohortMode(env) === "invalid") return fail();
  const environment = env.APP_ENV ?? (env.CI === "1" ? "ci" : env.NODE_ENV === "test" ? "test" : env.NODE_ENV === "production" ? "production" : "development");
  if (!["development", "test", "ci", "staging", "production"].includes(environment)) return fail();
  const hosted = environment === "staging" || environment === "production";
  if (env.VERCEL && !hosted) return fail();
  const app = origin(env.NEXT_PUBLIC_APP_URL ?? (!hosted ? "http://localhost:3000" : undefined), hosted);
  const database = origin(env.NEXT_PUBLIC_SUPABASE_URL, hosted);
  const production = origin(env.PRODUCTION_APP_ORIGIN ?? "https://estories.app", true);
  if (hosted) {
    const expected = env.EXPECTED_SUPABASE_PROJECT_REF;
    const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF;
    if (!expected || !productionRef || !/^[a-z0-9]{20}$/.test(expected) || !/^[a-z0-9]{20}$/.test(productionRef) || database.hostname !== `${expected}.supabase.co`) return fail();
    if (environment === "staging" && (expected === productionRef || app.hostname === production.hostname || app.hostname.endsWith(`.${production.hostname}`))) return fail();
    if (environment === "production" && (expected !== productionRef || app.origin !== production.origin)) return fail();
    if (env.EXPECTED_VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== env.EXPECTED_VERCEL_PROJECT_ID) return fail();
  } else if (!["localhost", "127.0.0.1", "[::1]", "synthetic.invalid", "mock.supabase.co", "placeholder.supabase.co"].includes(database.hostname)) return fail();
  const aiMode = env.AI_PROVIDER_MODE ?? (environment === "staging" ? "mock" : environment === "production" ? "live" : "disabled");
  if (env.PAYMENT_CALLBACK_REPLAY_ENABLED !== undefined && !["true", "false"].includes(env.PAYMENT_CALLBACK_REPLAY_ENABLED)) return fail();
  const paymentMode = env.PAYMENT_PROVIDER_MODE ?? (environment === "production" ? "live" : "disabled");
  if (!["disabled", "mock", "live"].includes(aiMode) || !["disabled", "sandbox", "live"].includes(paymentMode)) return fail();
  if (environment === "production" && aiMode === "mock") return fail();
  if (environment === "staging" && aiMode === "live" && !flag(env.STAGING_FREE_AI_CONFIRMED)) return fail();
  if (environment === "staging" && (paymentMode === "live" || paymentMode === "sandbox" && env.BLOCKRADAR_PAYMENT_NETWORK !== "testnet")) return fail();
  const daily = Number(env.AI_DAILY_CALL_LIMIT ?? 100);
  if (!Number.isInteger(daily) || daily < 1 || daily > 100000) return fail();
  return {
    environment: environment as AppEnvironment, appOrigin: app.origin, databaseOrigin: database.origin,
    aiMode: aiMode as "disabled" | "mock" | "live", paymentMode: paymentMode as "disabled" | "sandbox" | "live",
    aiWorkerEnabled: flag(env.AI_WORKER_ENABLED), paymentWorkerEnabled: flag(env.PAYMENT_NOTICE_WORKER_ENABLED),
    dailyCallLimit: environment === "staging" ? Math.min(daily, 4) : daily,
    totalCallLimit: environment === "staging" ? 8 : null,
  };
}
export function assertEmailRecipient(recipient: string, env: EnvironmentValues = process.env) {
  const config = runtimeConfiguration(env);
  if (cohortMode(env) !== "open") return fail();
  if (config.environment === "production") return;
  if (config.environment === "test") return; // Test runner transport is independently replaced.
  const allowed = new Set((env.STAGING_EMAIL_ALLOWLIST ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  if (config.environment !== "staging" || !allowed.has(recipient.trim().toLowerCase())) return fail();
}
export function externalMediaEnabled(env: EnvironmentValues = process.env) {
  const config = runtimeConfiguration(env);
  return cohortMode(env) === "open" && (config.environment === "production" || config.environment === "test");
}
