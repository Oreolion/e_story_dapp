import { GoogleGenerativeAI } from "@google/generative-ai";
import { InferencePrivacyError, TEXT_GENERATION_CONFIG } from "./workflow";
import type { TextTask } from "./workflow";
import { runtimeConfiguration, RuntimeConfigurationError } from "@/lib/runtime/config";

export function createTextGenerator(timeoutMs = 25_000, usage?: (data: Record<string, number>) => void, task: TextTask = "analysis") {
  const config = runtimeConfiguration();
  if (config.aiMode === "disabled") throw new RuntimeConfigurationError();
  if (config.aiMode === "mock") {
    if (config.environment !== "staging" && config.environment !== "test") throw new RuntimeConfigurationError();
    return async (prompt: string) => {
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
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("AI provider is not configured");
  const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: TEXT_GENERATION_CONFIG }, { timeout: Math.max(1, Math.min(25_000, timeoutMs)) });
  return async (prompt: string) => {
    const result = await model.generateContent(prompt);
    const info = result.response.usageMetadata;
    if (info) usage?.({ inputTokens: info.promptTokenCount ?? 0, outputTokens: info.candidatesTokenCount ?? 0, thinkingTokens: "thoughtsTokenCount" in info ? Number(info.thoughtsTokenCount) || 0 : 0, totalTokens: info.totalTokenCount ?? 0 });
    return result.response.text();
  };
}
export function inferenceErrorStatus(error: unknown): number {
  return error instanceof InferencePrivacyError || error instanceof RuntimeConfigurationError ? 503 : 502;
}
