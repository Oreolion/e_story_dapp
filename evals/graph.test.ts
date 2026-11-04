import { describe, expect, it, vi } from "vitest";
import { createEvaluationGraph, runBounded } from "./graph";
import { cases } from "./fixtures";
import type { Target } from "./types";

describe("LangGraph isolation and execution budget", () => {
  it("passes only task inputs to the target", async () => {
    const target = vi.fn<Target>(async () => ({ text: "synthetic result" }));
    const graph = createEvaluationGraph(target);
    const row = cases[0];
    const request = { id: row.id, workflow: row.workflow, input: row.input };
    const state = await graph.invoke({ request }, { recursionLimit: 5 });
    expect(target.mock.calls[0][0]).toEqual(request);
    expect(target.mock.calls[0][0]).not.toHaveProperty("reference");
    expect(state.output).toEqual({ text: "synthetic result" });
  });
  it("rejects unknown workflows before making a provider call", async () => {
    const target = vi.fn(async () => ({}));
    const graph = createEvaluationGraph(target);
    await expect(graph.invoke({ request: { id: "bad", workflow: "unknown", input: {} } as never })).rejects.toThrow();
    expect(target).not.toHaveBeenCalled();
  });
  it("limits concurrency and preserves result order", async () => {
    let active = 0, peak = 0;
    const result = await runBounded([1, 2, 3, 4], async value => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5)); active--; return value * 2;
    }, { concurrency: 2, timeoutMs: 1000, maxCases: 4 });
    expect(peak).toBe(2); expect(result).toEqual([2, 4, 6, 8]);
  });
  it("stops launching work after a deadline and signals cancellation", async () => {
    const calls: number[] = []; let aborted = false;
    await expect(runBounded([1, 2, 3], async (item, signal) => {
      calls.push(item); signal.addEventListener("abort", () => { aborted = true; });
      return new Promise<never>(() => {});
    }, { concurrency: 1, timeoutMs: 10, maxCases: 3 })).rejects.toThrow("batch stopped");
    expect(calls).toEqual([1]); expect(aborted).toBe(true);
  });
  it("rejects oversize batches without running a target", async () => {
    const target = vi.fn();
    await expect(runBounded([1, 2], target, { concurrency: 1, timeoutMs: 5, maxCases: 1 })).rejects.toThrow();
    expect(target).not.toHaveBeenCalled();
  });
});
