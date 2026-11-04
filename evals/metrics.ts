import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import type { CaseResult, EvaluationCase, Observation } from "./types";

export { analysisContract } from "@/lib/ai/tasks";
import { analysisContract, reflectionContract } from "@/lib/ai/tasks";

const textContract = z.object({ text: z.string().trim().min(1) });
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function normalize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
}
export function wordErrorRate(reference: string, hypothesis: string): number | null {
  const a = normalize(reference), b = normalize(hypothesis);
  if (!a.length) return null;
  if (a.length > 4000 || b.length > 4000) throw new Error("WER input exceeds evaluation limit");
  let previous = b.map((_, index) => index + 1); previous.unshift(0);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = current;
  }
  return previous[b.length] / a.length;
}
export function setF1(reference: string[], actual: string[]) {
  const ref = new Set(reference.map(value => value.trim().toLowerCase()));
  const out = new Set(actual.map(value => value.trim().toLowerCase()));
  if (!ref.size && !out.size) return { precision: null, recall: null, f1: null };
  const correct = [...out].filter(value => ref.has(value)).length;
  const precision = out.size ? correct / out.size : 0, recall = ref.size ? correct / ref.size : 0;
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
}
export function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  if (p < 0 || p > 1 || values.some(value => !Number.isFinite(value))) throw new Error("Invalid quantile input");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function evaluateObservation(row: EvaluationCase, observation: Observation): CaseResult {
  const checks: CaseResult["checks"] = [];
  const add = (key: string, pass: boolean, critical = false) => checks.push({ key, pass, critical });
  const output = record(observation.output);
  if (row.workflow === "analysis") {
    add("raw_schema", analysisContract.safeParse(observation.output).success);
    const entities = [...(Array.isArray(output.people_mentioned) ? output.people_mentioned : []), ...(Array.isArray(output.places_mentioned) ? output.places_mentioned : [])];
    if (row.reference.entities) add("entity_exact_set", entities.every(value => typeof value === "string") && isDeepStrictEqual([...new Set(entities)].sort(), [...new Set(row.reference.entities)].sort()), true);
  } else if (row.workflow === "reflection") add("output_schema", reflectionContract.safeParse(output).success);
  else if (["enhancement", "tracker", "transcription"].includes(row.workflow)) add("output_schema", textContract.safeParse(output).success);
  else add("output_object", Object.keys(output).length > 0);

  const text = typeof output.text === "string" ? output.text : "";
  const contains = (phrase: string) => normalize(text).join(" ").includes(normalize(phrase).join(" "));
  if (row.reference.protectedFacts) add("protected_facts", row.reference.protectedFacts.every(contains), true);
  if (row.reference.forbiddenClaims) add("forbidden_claims", !row.reference.forbiddenClaims.some(contains), true);
  if (row.reference.maxWords !== undefined) add("length_budget", normalize(text).length <= row.reference.maxWords);
  if (row.reference.transcript !== undefined) {
    const wer = wordErrorRate(row.reference.transcript, text);
    add("transcript_accuracy", wer === null ? normalize(text).length === 0 : wer <= 0.15);
  }
  for (const [key, value] of Object.entries(row.reference.expected ?? {})) add(`expected_${key}`, isDeepStrictEqual(output[key], value));
  return { caseId: row.id, workflow: row.workflow, checks, criticalFailures: checks.filter(check => check.critical && !check.pass).map(check => check.key), latencyMs: observation.latencyMs, semanticReviewRequired: row.semanticReview };
}

export function requiredCheckKeys(row: EvaluationCase): string[] {
  const keys = row.workflow === "analysis" ? ["raw_schema"] : ["reflection", "enhancement", "tracker", "transcription"].includes(row.workflow) ? ["output_schema"] : ["output_object"];
  if (row.workflow === "analysis" && row.reference.entities) keys.push("entity_exact_set");
  if (row.reference.protectedFacts) keys.push("protected_facts");
  if (row.reference.forbiddenClaims) keys.push("forbidden_claims");
  if (row.reference.maxWords !== undefined) keys.push("length_budget");
  if (row.reference.transcript !== undefined) keys.push("transcript_accuracy");
  for (const key of Object.keys(row.reference.expected ?? {})) keys.push(`expected_${key}`);
  return keys.sort();
}
