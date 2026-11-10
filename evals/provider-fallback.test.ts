import { beforeEach, describe, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => ({ generate: vi.fn(), provider: vi.fn() }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: effects.provider }));
import { createTextGenerator } from "@/lib/ai/provider";
import { hasTextProvider } from "@/lib/ai/providerPolicy";
import { runAnalysis } from "@/lib/ai/tasks";
import { analysisOutput, syntheticText } from "./fixtures";

const result = (content = JSON.stringify(analysisOutput)) => ({ model: "deepseek-flash", choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
beforeEach(() => {
  vi.clearAllMocks();
  effects.provider.mockImplementation(function () { return { getGenerativeModel: () => ({ generateContent: effects.generate }) }; });
  effects.generate.mockReset();
  vi.stubEnv("AI_DEEPSEEK_FALLBACK_ENABLED", "false");
  vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-deepseek-placeholder");
});
const enable = () => vi.stubEnv("AI_DEEPSEEK_FALLBACK_ENABLED", "true");

describe("bounded and explicitly enabled DeepSeek fallback", () => {
  it("preserves Gemini behavior and does not use a fallback merely because a key exists", async () => {
    effects.generate.mockRejectedValue({ status: 503 });
    await expect(createTextGenerator()("Synthetic")).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["", "TRUE", "yes"])("rejects ambiguous fallback enablement %s", flag => {
    vi.stubEnv("AI_DEEPSEEK_FALLBACK_ENABLED", flag);
    expect(() => hasTextProvider()).toThrow();
  });
  it("rejects an enabled but missing fallback credential", () => {
    enable(); vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(() => createTextGenerator()).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("routes directly to the enabled fallback when the primary key is absent, using one admission", async () => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    vi.mocked(fetch).mockResolvedValue(Response.json(result()));
    const usage = vi.fn();
    expect(hasTextProvider()).toBe(true);
    expect(await runAnalysis(syntheticText, undefined, createTextGenerator(25000, usage))).toEqual(analysisOutput);
    expect(effects.provider).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "deepseek-flash", thinking: { type: "disabled" }, max_tokens: 4096, stream: false, response_format: { type: "json_object" } });
    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ provider: "deepseek", model: "deepseek-flash", reservedProviderCalls: 1 }));
  });
  it.each([429, 500, 502, 503, 504])("reserves a second call before fallback after primary status %s", async status => {
    enable(); effects.generate.mockRejectedValue({ status });
    const reserveFallback = vi.fn(async () => { expect(fetch).not.toHaveBeenCalled(); return true; });
    vi.mocked(fetch).mockResolvedValue(Response.json(result("Edited synthetic text")));
    expect(await createTextGenerator(25000, undefined, "enhancement", { reserveFallback })("Synthetic")).toBe("Edited synthetic text");
    expect(reserveFallback).toHaveBeenCalledOnce();
    expect(effects.generate).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([400, 401, 403, 404])("does not hide primary configuration/input failures with fallback (%s)", async status => {
    enable(); effects.generate.mockRejectedValue({ status });
    const reserveFallback = vi.fn(async () => true);
    await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toMatchObject({ status });
    expect(reserveFallback).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not make an unreserved fallback call when admission is missing, denied or unavailable", async () => {
    enable(); effects.generate.mockRejectedValue({ status: 503 });
    for (const reserveFallback of [undefined, vi.fn(async () => false), vi.fn(async () => { throw new Error("PRIVATE_DATABASE_DIAGNOSTIC"); })]) {
      await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the separately admitted job retry for fallback without another primary call", async () => {
    enable(); vi.mocked(fetch).mockResolvedValue(Response.json(result()));
    await createTextGenerator(25000, undefined, "analysis", { preferFallback: true })("Synthetic JSON");
    expect(effects.provider).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("shares one deadline and does not start fallback after the remaining budget expires", async () => {
    enable(); const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    effects.generate.mockImplementation(async () => { clock.mockReturnValue(27000); throw { status: 503 }; });
    const reserveFallback = vi.fn(async () => true);
    await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toThrow();
    expect(reserveFallback).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not bypass paused mode or tracing privacy policy", () => {
    enable(); vi.stubEnv("LANGSMITH_TRACING", "true");
    expect(() => createTextGenerator()).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([402, 429, 500, 503])("bounds fallback failure %s to one HTTP request and suppresses provider diagnostics", async status => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    vi.mocked(fetch).mockResolvedValue(new Response("PRIVATE_PROVIDER_DIAGNOSTIC", { status }));
    await expect(createTextGenerator()("Synthetic")).rejects.toThrow("AI provider unavailable");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects incomplete or refused fallback results: %s", async finish => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const data = result(); data.choices[0].finish_reason = finish;
    vi.mocked(fetch).mockResolvedValue(Response.json(data));
    await expect(createTextGenerator()("Synthetic")).rejects.toThrow();
  });
  it("retains strict semantic output validation without a repair call or LLM judge", async () => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    vi.mocked(fetch).mockResolvedValue(Response.json(result('{"invented":true}')));
    await expect(runAnalysis(syntheticText, undefined, createTextGenerator())).rejects.toThrow("Invalid model output");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not use another provider to bypass a Gemini safety response", async () => {
    enable();
    effects.generate.mockResolvedValue({ response: { text: () => { throw Object.assign(new Error("SYNTHETIC_SAFETY_BLOCK"), { status: 503 }); } } });
    const reserveFallback = vi.fn(async () => true);
    await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toThrow("SYNTHETIC_SAFETY_BLOCK");
    expect(reserveFallback).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("recognizes actual SDK transport failures but excludes response and input errors", async () => {
    const sdk = await vi.importActual<typeof import("@google/generative-ai")>("@google/generative-ai");
    enable();
    for (const error of [new sdk.GoogleGenerativeAIError("Synthetic transport"), new sdk.GoogleGenerativeAIAbortError("Synthetic timeout")]) {
      effects.generate.mockRejectedValueOnce(error);
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(result()));
      await createTextGenerator(25000, undefined, "analysis", { reserveFallback: async () => true })("Synthetic JSON");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const error of [new sdk.GoogleGenerativeAIRequestInputError("Synthetic input"), new sdk.GoogleGenerativeAIResponseError("Synthetic refusal")]) {
      effects.generate.mockRejectedValueOnce(error);
      await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback: async () => true })("Synthetic")).rejects.toThrow();
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not reserve another call after the release is paused during primary work", async () => {
    enable(); effects.generate.mockImplementation(async () => { vi.stubEnv("APP_RELEASE_MODE", "paused"); throw { status: 503 }; });
    const reserveFallback = vi.fn(async () => true);
    await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toThrow();
    expect(reserveFallback).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("cancels oversized response streams even with a false Content-Length", async () => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024 + 1)); }, cancel });
    vi.mocked(fetch).mockResolvedValue(new Response(stream, { headers: { "Content-Length": "1" } }));
    await expect(createTextGenerator()("Synthetic")).rejects.toThrow("Invalid model output");
    expect(cancel).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("uses only the remaining deadline for fallback and rechecks after admission", async () => {
    enable(); const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    effects.generate.mockImplementation(async () => { clock.mockReturnValue(18000); throw { status: 503 }; });
    const timers = vi.spyOn(globalThis, "setTimeout");
    vi.mocked(fetch).mockResolvedValue(Response.json(result()));
    await createTextGenerator(25000, undefined, "analysis", { reserveFallback: async () => true })("Synthetic JSON");
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 8000);
    clock.mockReturnValue(1000);
    const reserveFallback = async () => { clock.mockReturnValue(27000); return true; };
    await expect(createTextGenerator(25000, undefined, "analysis", { reserveFallback })("Synthetic")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([
    { ...result(), model: "unreviewed-model" },
    { ...result(), usage: { prompt_tokens: -1, completion_tokens: 20, total_tokens: 19 } },
    result("   "),
    { ...result(), choices: [{ message: { role: "assistant", content: "Synthetic", tool_calls: [{}] }, finish_reason: "stop" }] },
  ])("rejects unreviewed models, invalid accounting, empty responses and tool calls", async value => {
    enable(); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", ""); vi.mocked(fetch).mockResolvedValue(Response.json(value));
    await expect(createTextGenerator()("Synthetic")).rejects.toThrow("Invalid model output");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
