import { describe, expect, it, vi } from "vitest";
import { runTextWorkflow } from "@/lib/ai/workflow";
describe("production LangGraph text workflow", () => {
  it("fails closed before inference when host tracing is enabled", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "true"); vi.stubEnv("LANGCHAIN_TRACING_V2", "true");
    const generate = vi.fn(async () => "Edited synthetic text");
    await expect(runTextWorkflow({ task: "enhancement", prompt: "Synthetic input", generate })).rejects.toThrow("ambient tracing");
    expect(generate).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["", " "])("rejects empty provider output", async output => {
    await expect(runTextWorkflow({ task: "analysis", prompt: "Synthetic", generate: async () => output })).rejects.toThrow("empty");
  });
  it("does not retry inference when a provider fails", async () => {
    const generate = vi.fn(async () => { throw new Error("provider failure"); });
    await expect(runTextWorkflow({ task: "reflection", prompt: "Private input", generate })).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
  });
});
