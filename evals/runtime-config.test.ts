import { describe, expect, it } from "vitest";
import { assertEmailRecipient, runtimeConfiguration, RuntimeConfigurationError } from "../lib/runtime/config";

const productionRef = "p".repeat(20), stagingRef = "s".repeat(20);
const stage = () => ({ APP_ENV: "staging", NEXT_PUBLIC_APP_URL: "https://istory-staging.vercel.app", NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`, EXPECTED_SUPABASE_PROJECT_REF: stagingRef, PRODUCTION_SUPABASE_PROJECT_REF: productionRef, PRODUCTION_APP_ORIGIN: "https://estories.app" });
describe("deployment environment isolation", () => {
  it("requires an explicit free allowance confirmation for live staging inference", () => {
    expect(() => runtimeConfiguration({ ...stage(), AI_PROVIDER_MODE: "live" })).toThrow();
    expect(runtimeConfiguration({ ...stage(), AI_PROVIDER_MODE: "live", STAGING_FREE_AI_CONFIRMED: "true", AI_DAILY_CALL_LIMIT: "100" })).toMatchObject({ dailyCallLimit: 4, totalCallLimit: 8 });
  });
  it("permits only exact allowlisted staging email recipients", () => {
    const env = { ...stage(), STAGING_EMAIL_ALLOWLIST: " Tester@example.invalid " };
    expect(() => assertEmailRecipient("tester@example.invalid", env)).not.toThrow();
    expect(() => assertEmailRecipient("outsider@example.invalid", env)).toThrow();
    expect(() => assertEmailRecipient("tester@example.invalid.attacker.invalid", env)).toThrow();
    expect(() => assertEmailRecipient("tester@example.invalid", stage())).toThrow();
  });
  it("defaults isolated staging to mock inference, disabled payments and paused workers", () => {
    expect(runtimeConfiguration(stage())).toMatchObject({ environment: "staging", aiMode: "mock", paymentMode: "disabled", aiWorkerEnabled: false, paymentWorkerEnabled: false });
  });
  it("rejects a staging database that is actually production even if expected ref was copied", () => {
    expect(() => runtimeConfiguration({ ...stage(), NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`, EXPECTED_SUPABASE_PROJECT_REF: productionRef })).toThrow(RuntimeConfigurationError);
  });
  it.each(["https://estories.app", "https://www.estories.app", "http://istory-staging.vercel.app", "https://user:password@istory-staging.vercel.app", "https://istory-staging.vercel.app/path"])("rejects an unsafe staging origin: %s", url => {
    expect(() => runtimeConfiguration({ ...stage(), NEXT_PUBLIC_APP_URL: url })).toThrow(RuntimeConfigurationError);
  });
  it("requires the actual project URL to match its independently configured identity", () => {
    expect(() => runtimeConfiguration({ ...stage(), EXPECTED_SUPABASE_PROJECT_REF: "x".repeat(20) })).toThrow(RuntimeConfigurationError);
    expect(() => runtimeConfiguration({ ...stage(), PRODUCTION_SUPABASE_PROJECT_REF: undefined })).toThrow(RuntimeConfigurationError);
  });
  it("requires testnet for staging payment sandbox mode", () => {
    expect(() => runtimeConfiguration({ ...stage(), PAYMENT_PROVIDER_MODE: "sandbox", BLOCKRADAR_PAYMENT_NETWORK: "mainnet" })).toThrow();
    expect(runtimeConfiguration({ ...stage(), PAYMENT_PROVIDER_MODE: "sandbox", BLOCKRADAR_PAYMENT_NETWORK: "testnet" }).paymentMode).toBe("sandbox");
  });
  it("does not allow a production deployment to use mock AI", () => {
    expect(() => runtimeConfiguration({ ...stage(), APP_ENV: "production", NEXT_PUBLIC_APP_URL: "https://estories.app", NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`, EXPECTED_SUPABASE_PROJECT_REF: productionRef, AI_PROVIDER_MODE: "mock" })).toThrow();
  });
  it("rejects ambiguous boolean flags and mismatched Vercel project identity", () => {
    expect(() => runtimeConfiguration({ ...stage(), AI_WORKER_ENABLED: "yes" })).toThrow();
    expect(() => runtimeConfiguration({ ...stage(), VERCEL_PROJECT_ID: "actual", EXPECTED_VERCEL_PROJECT_ID: "different" })).toThrow();
  });
  it("keeps CI away from hosted database projects", () => {
    expect(() => runtimeConfiguration({ ...stage(), APP_ENV: "ci" })).toThrow();
    expect(runtimeConfiguration({ APP_ENV: "ci", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001" }).environment).toBe("ci");
  });
  it("cannot deploy a test-only configuration to Vercel", () => {
    expect(() => runtimeConfiguration({ APP_ENV: "test", VERCEL: "1", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_APP_URL: "http://localhost" })).toThrow();
  });
});
