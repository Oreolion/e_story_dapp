import { describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ generate: vi.fn(), count: vi.fn() }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: provider.generate, countTokens: provider.count }; } } }));
import { createBudgetedLiveGenerator } from "./live-target";
describe("live experiment budget admission", () => {
  it("refuses spend before inference when token reservation exceeds the cap", async () => {
    provider.count.mockResolvedValue({ totalTokens: 100 }); provider.generate.mockReset();
    const target = createBudgetedLiveGenerator({ budgetUsd: 0.00001, inputPricePerMillion: 1, outputPricePerMillion: 1, maxCalls: 1 });
    await expect(target.generate("Synthetic input")).rejects.toThrow("reservation");
    expect(provider.generate).not.toHaveBeenCalled(); expect(target.usage.providerCalls).toBe(0);
  });
  it("accounts usage and refuses extra calls rather than silently retrying", async () => {
    provider.count.mockResolvedValue({ totalTokens: 100 }); provider.generate.mockResolvedValue({ response: { text: () => "Synthetic output", usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10 } } });
    const target = createBudgetedLiveGenerator({ budgetUsd: 1, inputPricePerMillion: 1, outputPricePerMillion: 1, maxCalls: 1 });
    expect(await target.generate("Synthetic input")).toBe("Synthetic output");
    await expect(target.generate("Again")).rejects.toThrow("exhausted");
    expect(target.usage.providerCalls).toBe(1); expect(target.usage.measuredUsd).toBeCloseTo(0.00011);
    expect(fetch).not.toHaveBeenCalled();
  });
});
