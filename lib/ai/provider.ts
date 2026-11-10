import { GoogleGenerativeAI } from "@google/generative-ai";
import { InferencePrivacyError, assertPrivateInferenceConfiguration, TEXT_GENERATION_CONFIG } from "./workflow";
import type { TextTask } from "./workflow";
import { runtimeConfiguration, RuntimeConfigurationError } from "@/lib/runtime/config";
import { assertReleaseActive, ReleasePausedError } from "@/lib/runtime/release";
import { textProviderPolicy } from "./providerPolicy";
import { generateDeepseek, InferenceProviderError, type ProviderUsage } from "./deepseek";

interface RoutingOptions {
  // Only a separately quota-admitted durable retry may select this directly.
  preferFallback?: boolean;
  // Every extra provider call needs a new durable reservation.
  reserveFallback?: () => Promise<boolean>;
}
export function providerUnavailable(error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  if (status) return false;
  // Installed Gemini SDK wraps transport/abort failures in these exact classes.
  // Response/input errors and parsing/refusal errors are deliberately excluded.
  return error instanceof Error && (["GoogleGenerativeAIError", "GoogleGenerativeAIAbortError"].includes(error.constructor.name) || ["AbortError", "TimeoutError"].includes(error.name));
}

export function createTextGenerator(timeoutMs = 25_000, usage?: (data: ProviderUsage) => void, task: TextTask = "analysis", routing: RoutingOptions = {}) {
  const config = runtimeConfiguration();
  assertPrivateInferenceConfiguration();
  if (config.aiMode === "disabled") throw new RuntimeConfigurationError();
  if (config.aiMode === "mock") {
    if (config.environment !== "staging" && config.environment !== "test") throw new RuntimeConfigurationError();
    return async (prompt: string) => {
      assertReleaseActive();
      usage?.({ inputTokens: 0, outputTokens: 0, totalTokens: 0, mockResponses: 1 });
      if (task === "analysis") return JSON.stringify({ themes: ["staging fixture"], emotional_tone: "neutral", life_domain: "general", intensity_score: 0, significance_score: 0, people_mentioned: [], places_mentioned: [], time_references: [], brief_insight: "Staging fixture: no live model analyzed this entry.", actionable_advice: "Use synthetic content to verify this staging workflow." });
      if (task === "reflection") {
        const empty = prompt.startsWith("You are a compassionate life coach. The user has not recorded");
        return JSON.stringify({ reflection_text: "Staging fixture: no live model generated this reflection.", themes_identified: [], dominant_tone: empty ? "hopeful" : "neutral", dominant_domain: empty ? "growth" : "general" });
      }
      const marker = task === "tracker" ? "Tracker input (untrusted data):\n" : "Original text (untrusted data):\n";
      const index = prompt.indexOf(marker);
      if (index < 0) throw new RuntimeConfigurationError();
      return prompt.slice(index + marker.length).trim();
    };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new RuntimeConfigurationError();
  const policy = textProviderPolicy();
  if (!policy.gemini && !policy.deepseek) throw new RuntimeConfigurationError();
  const budget = Math.min(25_000, Math.floor(timeoutMs));
  const useDeepseek = policy.deepseek && (!policy.gemini || routing.preferFallback === true);
  const primaryTimeout = policy.deepseek && routing.reserveFallback ? Math.max(1, Math.min(12_000, Math.floor(budget / 2))) : budget;
  const model = useDeepseek ? null : new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!).getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: TEXT_GENERATION_CONFIG }, { timeout: primaryTimeout });
  return async (prompt: string) => {
    assertReleaseActive(); assertPrivateInferenceConfiguration();
    const deadline = Date.now() + budget;
    if (useDeepseek) return generateDeepseek(prompt, task, budget, usage);
    let result;
    try { result = await model!.generateContent(prompt); }
    catch (error) {
      if (!policy.deepseek || !textProviderPolicy().deepseek || !routing.reserveFallback || !providerUnavailable(error)) throw error;
      assertReleaseActive(); assertPrivateInferenceConfiguration();
      if (deadline - Date.now() < 1000) throw new InferenceProviderError(504);
      let allowed = false;
      try { allowed = await routing.reserveFallback(); } catch { /* fail closed */ }
      if (!allowed) throw new RuntimeConfigurationError();
      const remaining = deadline - Date.now();
      if (remaining < 1000) throw new InferenceProviderError(504);
      return generateDeepseek(prompt, task, remaining, usage, 2);
    }
    const info = result.response.usageMetadata;
    usage?.({ provider: "gemini", model: "gemini-2.5-flash", reservedProviderCalls: 1, ...(info ? { inputTokens: info.promptTokenCount ?? 0, outputTokens: info.candidatesTokenCount ?? 0, thinkingTokens: "thoughtsTokenCount" in info ? Number(info.thoughtsTokenCount) || 0 : 0, totalTokens: info.totalTokenCount ?? 0 } : {}) });
    return result.response.text();
  };
}
export function inferenceErrorStatus(error: unknown): number {
  return error instanceof InferencePrivacyError || error instanceof RuntimeConfigurationError || error instanceof ReleasePausedError || error instanceof InferenceProviderError ? 503 : 502;
}
