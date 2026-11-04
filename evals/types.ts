export const workflows = ["analysis", "enhancement", "tracker", "reflection", "transcription", "patterns"] as const;
export type Workflow = typeof workflows[number];
export interface EvaluationCase {
  id: string;
  workflow: Workflow;
  provenance: "synthetic";
  input: Record<string, unknown>;
  reference: {
    entities?: string[];
    protectedFacts?: string[];
    forbiddenClaims?: string[];
    transcript?: string;
    expected?: Record<string, unknown>;
    maxWords?: number;
  };
  semanticReview: boolean;
  fixtureOutput: unknown;
}
export interface Observation {
  output: unknown;
  latencyMs: number;
  mode?: "fixture" | "route-mock" | "captured" | "product-mock" | "live";
}
export interface Check { key: string; pass: boolean; critical: boolean }
export interface CaseResult {
  caseId: string;
  workflow: Workflow;
  checks: Check[];
  criticalFailures: string[];
  latencyMs: number;
  semanticReviewRequired: boolean;
}
export type TargetInput = Pick<EvaluationCase, "id" | "workflow" | "input">;
export type Target = (input: TargetInput, signal: AbortSignal) => Promise<unknown>;
