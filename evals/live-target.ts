import { GoogleGenerativeAI } from "@google/generative-ai";
import { TEXT_GENERATION_CONFIG, TEXT_REQUEST_OPTIONS } from "../lib/ai/workflow";

/** Only invoked by an explicitly requested synthetic live experiment. Prices
 * must be supplied from the operator's current provider pricing agreement. */
export function createBudgetedLiveGenerator(options: { budgetUsd: number; inputPricePerMillion: number; outputPricePerMillion: number; maxCalls: number }) {
  const { budgetUsd, inputPricePerMillion, outputPricePerMillion, maxCalls } = options;
  if (![budgetUsd, inputPricePerMillion, outputPricePerMillion].every(value => Number.isFinite(value) && value > 0) || budgetUsd > 5 || !Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 20) throw new Error("Invalid live experiment budget");
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Live evaluation provider is not configured");
  const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: TEXT_GENERATION_CONFIG }, TEXT_REQUEST_OPTIONS);
  const usage = { providerCalls: 0, tokenCountCalls: 0, reservedUsd: 0, measuredUsd: 0, unknownUsageCalls: 0 };
  const generate = async (prompt: string) => {
    if (usage.providerCalls >= maxCalls || prompt.length > 100000) throw new Error("Live call/input budget exhausted");
    usage.tokenCountCalls++;
    const counted = await model.countTokens(prompt);
    if (!Number.isFinite(counted.totalTokens) || counted.totalTokens < 1) throw new Error("Token budget unavailable");
    // Conservative separate allowance for dynamic 2.5 Flash thinking. See
    // https://ai.google.dev/gemini-api/docs/generate-content/thinking
    const reserve = (counted.totalTokens * inputPricePerMillion + (TEXT_GENERATION_CONFIG.maxOutputTokens + 24576) * outputPricePerMillion) / 1e6;
    if (usage.reservedUsd + reserve > budgetUsd) throw new Error("Live spend reservation exceeds budget");
    usage.reservedUsd += reserve; usage.providerCalls++;
    const result = await model.generateContent(prompt);
    const tokens = result.response.usageMetadata;
    if (tokens) usage.measuredUsd += ((tokens.promptTokenCount ?? 0) * inputPricePerMillion + (tokens.candidatesTokenCount ?? 0) * outputPricePerMillion + ("thoughtsTokenCount" in tokens ? Number(tokens.thoughtsTokenCount) || 0 : 0) * outputPricePerMillion) / 1e6;
    else usage.unknownUsageCalls++;
    return result.response.text();
  };
  return { generate, usage };
}
