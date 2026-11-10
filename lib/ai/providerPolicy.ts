import { RuntimeConfigurationError } from "@/lib/runtime/config";

export function textProviderPolicy(env: Record<string, string | undefined> = process.env) {
  const flag = env.AI_DEEPSEEK_FALLBACK_ENABLED;
  if (flag !== undefined && flag !== "true" && flag !== "false") throw new RuntimeConfigurationError();
  const deepseek = flag === "true";
  if (deepseek && !env.DEEPSEEK_API_KEY?.trim()) throw new RuntimeConfigurationError();
  return { gemini: Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()), deepseek };
}

export function hasTextProvider() {
  const policy = textProviderPolicy();
  return policy.gemini || policy.deepseek;
}
