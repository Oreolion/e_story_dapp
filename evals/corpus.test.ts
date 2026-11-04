import { describe, expect, it, vi } from "vitest";
import { cases } from "./fixtures";
import { evaluateObservation, requiredCheckKeys } from "./metrics";
import { createProductTarget } from "./product-target";
import { workflows, type TargetInput } from "./types";
import { analysisContract, buildAnalysisPrompt, buildEditingPrompt, buildReflectionPrompt, reflectionContract } from "../lib/ai/tasks";

describe("synthetic regression corpus", () => {
  it("contains distinct synthetic cases for every supported task", () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
    expect(new Set(cases.map(row => row.id)).size).toBe(cases.length);
    expect(new Set(cases.map(row => JSON.stringify([row.workflow, row.input]))).size).toBe(cases.length);
    expect(new Set(cases.map(row => row.workflow))).toEqual(new Set(workflows));
    expect(cases.every(row => row.provenance === "synthetic")).toBe(true);
  });

  it.each(cases)("$id satisfies its declared deterministic checks", async row => {
    const generate = vi.fn(async () => {
      const output = row.fixtureOutput as Record<string, unknown>;
      return typeof output.text === "string" ? output.text : JSON.stringify(output);
    });
    const transcribe = vi.fn(async () => (row.fixtureOutput as { text: string }).text);
    const target = createProductTarget(generate, transcribe);
    const input: TargetInput = { id: row.id, workflow: row.workflow, input: row.input };
    const output = await target(input);
    const result = evaluateObservation(row, { output, latencyMs: 1, mode: "product-mock" });
    expect(result.checks.map(check => check.key).sort()).toEqual(requiredCheckKeys(row));
    expect(result.checks.filter(check => !check.pass)).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(["patterns", "transcription"].includes(row.workflow) ? 0 : 1);
    expect(transcribe).toHaveBeenCalledTimes(row.workflow === "transcription" ? 1 : 0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(cases.filter(row => row.reference.forbiddenClaims?.length))("$id rejects a prohibited inserted claim", row => {
    const text = (row.fixtureOutput as { text: string }).text;
    const result = evaluateObservation(row, { output: { text: `${text} ${row.reference.forbiddenClaims![0]}` }, latencyMs: 1 });
    expect(result.criticalFailures).toContain("forbidden_claims");
  });

  it.each(cases.filter(row => row.workflow === "analysis"))("$id detects an invented entity", row => {
    const output = { ...(row.fixtureOutput as object), people_mentioned: ["Unprovided Person"] };
    expect(evaluateObservation(row, { output, latencyMs: 1 }).criticalFailures).toContain("entity_exact_set");
  });
});

describe("rejected inputs and outputs are not successful fixture cases", () => {
  it.each(["", " ", "x".repeat(49), "x".repeat(50_001)])("rejects analysis input outside bounds (%#)", text => {
    expect(() => buildAnalysisPrompt(text)).toThrow("Invalid analysis input");
  });
  it.each(["enhancement", "tracker"] as const)("%s rejects empty/oversized input before generation", task => {
    for (const text of ["", " \n", "x".repeat(50_001)]) expect(() => buildEditingPrompt(text, task)).toThrow("Invalid editing input");
    expect(buildEditingPrompt("x".repeat(50_000), task)).toContain("x".repeat(50_000));
  });
  it("rejects an excessive reflection source count", () => {
    const stories = Array.from({ length: 21 }, (_, index) => ({ id: String(index), created_at: "2026-10-01", content: "Synthetic note." }));
    expect(() => buildReflectionPrompt(stories)).toThrow("Reflection source limit exceeded");
    expect(() => buildReflectionPrompt(stories.slice(0, 20))).not.toThrow();
  });
  it.each(["", "not JSON", '{"themes":[]}'])("rejects malformed analysis provider output (%#)", async providerOutput => {
    const generate = vi.fn(async () => providerOutput);
    await expect(createProductTarget(generate)({ id: "invalid-output", workflow: "analysis", input: cases[0].input })).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported fields and out-of-range scores in model metadata", () => {
    expect(analysisContract.safeParse({ ...(cases[0].fixtureOutput as object), intensity_score: 1.01 }).success).toBe(false);
    expect(analysisContract.safeParse({ ...(cases[0].fixtureOutput as object), private_other_user_data: "synthetic sentinel" }).success).toBe(false);
    expect(reflectionContract.safeParse({ reflection_text: "A note.", themes_identified: [], dominant_tone: "diagnosed", dominant_domain: "health" }).success).toBe(false);
  });
  it("rejects invented themes for an empty reflection source", async () => {
    const generate = vi.fn(async () => JSON.stringify({ reflection_text: "Invented work event.", themes_identified: ["work"], dominant_tone: "neutral", dominant_domain: "work" }));
    await expect(createProductTarget(generate)({ id: "empty-invented", workflow: "reflection", input: { stories: [] } })).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("propagates provider failure without an implicit retry", async () => {
    const generate = vi.fn(async () => { throw new Error("Synthetic provider unavailable"); });
    await expect(createProductTarget(generate)({ id: "provider-error", workflow: "enhancement", input: { text: "A synthetic note." } })).rejects.toThrow("Synthetic provider unavailable");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("counts empty patterns without inventing a theme", async () => {
    const generate = vi.fn();
    expect(await createProductTarget(generate)({ id: "empty-patterns", workflow: "patterns", input: { themes: [] } })).toEqual({});
    expect(generate).not.toHaveBeenCalled();
  });
});
