import { describe, expect, it } from "vitest";
import { analysisContract, evaluateObservation, wordErrorRate, setF1, quantile } from "./metrics";
import { decideGate } from "./gate";
import { cases } from "./fixtures";

describe("deterministic evaluator negative controls", () => {
  it("distinguishes exact speech, deletions, and silence without a judge", () => {
    expect(wordErrorRate("Ada did not resign", "Ada did not resign")).toBe(0);
    expect(wordErrorRate("Ada did not resign", "Ada did resign")).toBe(0.25);
    expect(wordErrorRate("", "invented speech")).toBeNull();
    expect(wordErrorRate("", "")).toBeNull();
  });
  it("normalizes punctuation but preserves negation and numbers", () => {
    expect(wordErrorRate("Ada, I paid 20.", "ada i paid 20")).toBe(0);
    expect(wordErrorRate("I paid 20", "I paid 200")).toBeGreaterThan(0);
  });
  it("reports entity precision/recall and does not invent empty true positives", () => {
    expect(setF1(["Ada"], ["ada", "Invented"])).toEqual({ precision: 0.5, recall: 1, f1: 2 / 3 });
    expect(setF1([], [])).toEqual({ precision: null, recall: null, f1: null });
  });
  it("rejects missing fields and invalid model labels instead of rewarding sanitizer defaults", () => {
    expect(analysisContract.safeParse({ emotional_tone: "invented" }).success).toBe(false);
    expect(analysisContract.safeParse(cases[0].fixtureOutput).success).toBe(true);
  });
  it("rejects an injected person and a changed protected fact", () => {
    const row = cases.find(row => row.workflow === "enhancement")!;
    const result = evaluateObservation(row, { output: { text: "I resigned and moved to Rome." }, latencyMs: 1 });
    expect(result.checks.some(check => check.key === "protected_facts" && !check.pass)).toBe(true);
    expect(result.criticalFailures.length).toBeGreaterThan(0);
  });
  it("uses a correct nearest-rank quantile for small corpora", () => {
    expect(quantile([1, 5, 2, 4, 3], 0.95)).toBe(5);
    expect(quantile([], 0.95)).toBeNull();
  });
});

describe("fail-closed experiment gate", () => {
  const pass = () => evaluateObservation(cases[0], { output: cases[0].fixtureOutput, latencyMs: 5 });
  it("reports deterministic success as advisory when semantics are unreviewed", () => {
    expect(decideGate([cases[0]], [pass()]).status).toBe("ADVISORY");
  });
  it("does not turn an empty or incomplete experiment green", () => {
    expect(decideGate([], []).status).toBe("INCONCLUSIVE");
    expect(decideGate(cases, [pass()]).status).toBe("INCONCLUSIVE");
  });
  it("rejects duplicate case results and unknown IDs", () => {
    expect(decideGate([cases[0]], [pass(), pass()]).status).toBe("INCONCLUSIVE");
    expect(decideGate([cases[0]], [{ ...pass(), caseId: "unknown" }]).status).toBe("INCONCLUSIVE");
  });
  it("fails on a critical correctness defect even with otherwise good scores", () => {
    expect(decideGate([cases[0]], [{ ...pass(), criticalFailures: ["data isolation failure"] }]).status).toBe("FAIL");
  });
  it("does not accept nonfinite latency or missing measurements", () => {
    expect(decideGate([cases[0]], [{ ...pass(), latencyMs: NaN }]).status).toBe("INCONCLUSIVE");
  });
  it("rejects missing metric keys even when the remaining checks pass", () => {
    expect(decideGate([cases[0]], [{ ...pass(), checks: [{ key: "raw_schema", pass: true, critical: false }] }]).status).toBe("INCONCLUSIVE");
  });
});
