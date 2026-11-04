import { afterEach, beforeEach, vi } from "vitest";

// No implicit dotenv loading, telemetry, or real provider/production requests.
beforeEach(() => {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("AI_PROVIDER_MODE", "live");
  vi.stubEnv("PAYMENT_PROVIDER_MODE", "live");
  vi.stubEnv("AI_WORKER_ENABLED", "true");
  vi.stubEnv("PAYMENT_NOTICE_WORKER_ENABLED", "true");
  for (const flag of ["LANGSMITH_TRACING", "LANGSMITH_TRACING_V2", "LANGCHAIN_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_VERBOSE", "LANGSMITH_OTEL_ENABLED"]) vi.stubEnv(flag, "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-placeholder");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "synthetic-provider-placeholder");
  vi.stubEnv("ELEVENLABS_API_KEY", "synthetic-provider-placeholder");
  vi.stubEnv("CRE_CALLBACK_SECRET", "synthetic-callback-placeholder");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Evaluation network access denied"))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
