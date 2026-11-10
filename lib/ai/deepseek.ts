import { z } from "zod";
import { InvalidModelOutput } from "./tasks";
import { assertPrivateInferenceConfiguration, TEXT_GENERATION_CONFIG, type TextTask } from "./workflow";
import { assertReleaseActive } from "@/lib/runtime/release";
import { textProviderPolicy } from "./providerPolicy";

export type ProviderUsage = Record<string, string | number>;
export class InferenceProviderError extends Error {
  constructor(public readonly status = 503) { super("AI provider unavailable"); }
}
const tokens = z.number().int().nonnegative().max(1_000_000_000);
const responseContract = z.object({
  model: z.literal("deepseek-flash"),
  choices: z.array(z.object({
    finish_reason: z.literal("stop"),
    message: z.object({ role: z.literal("assistant"), content: z.string().min(1).max(100_000), tool_calls: z.never().optional(), reasoning_content: z.string().max(0).nullish() }),
  })).length(1),
  usage: z.object({ prompt_tokens: tokens, completion_tokens: tokens, total_tokens: tokens }),
});

export async function generateDeepseek(prompt: string, task: TextTask, timeoutMs: number, usage?: (data: ProviderUsage) => void, reservedProviderCalls = 1): Promise<string> {
  assertReleaseActive(); assertPrivateInferenceConfiguration();
  if (!textProviderPolicy().deepseek || timeoutMs < 1) throw new InferenceProviderError();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "user", content: prompt }], stream: false,
        thinking: { type: "disabled" }, max_tokens: TEXT_GENERATION_CONFIG.maxOutputTokens,
        response_format: { type: task === "analysis" || task === "reflection" ? "json_object" : "text" } }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new InferenceProviderError(response.status); }
    if (!response.body) throw new InvalidModelOutput();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 256 * 1024) throw new InvalidModelOutput();
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new InvalidModelOutput(); }
    const value = responseContract.safeParse(parsed);
    if (!value.success || !value.data.choices[0].message.content.trim()) throw new InvalidModelOutput();
    usage?.({ provider: "deepseek", model: "deepseek-flash", reservedProviderCalls, inputTokens: value.data.usage.prompt_tokens, outputTokens: value.data.usage.completion_tokens, totalTokens: value.data.usage.total_tokens });
    return value.data.choices[0].message.content;
  } catch (error) {
    if (error instanceof InvalidModelOutput || error instanceof InferenceProviderError) throw error;
    throw new InferenceProviderError(controller.signal.aborted ? 504 : 503);
  } finally { clearTimeout(timer); }
}
