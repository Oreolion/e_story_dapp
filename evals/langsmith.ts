import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import { createHash } from "node:crypto";
import type { CaseResult, EvaluationCase } from "./types";

/** Explicit synthetic-only publication. No implicit workspace/account mutation or production tracing. */
export async function publishSyntheticResults(cases: EvaluationCase[], results: CaseResult[], manifest: Record<string, unknown>) {
  if (!process.env.LANGSMITH_API_KEY || !process.env.LANGSMITH_PROJECT) throw new Error("LangSmith publication requires an explicitly configured key and project");
  if (!cases.length || cases.some(row => row.provenance !== "synthetic") || results.length !== cases.length) throw new Error("Only complete synthetic experiments can be published");
  const byId = new Map(results.map(row => [row.caseId, row]));
  if (byId.size !== cases.length || cases.some(row => !byId.has(row.id))) throw new Error("Experiment coverage mismatch");
  const client = new Client({ hideInputs: true, hideOutputs: true });
  const datasetName = `istory-wiring-${createHash("sha256").update(JSON.stringify(cases)).digest("hex").slice(0, 16)}`;
  const dataset = await client.hasDataset({ datasetName }) ? await client.readDataset({ datasetName }) : await client.createDataset(datasetName);
  const existing = new Set<string>();
  for await (const example of client.listExamples({ datasetId: dataset.id })) existing.add(String(example.inputs.caseId));
  for (const row of cases) if (!existing.has(row.id)) await client.createExample({ caseId: row.id, workflow: row.workflow }, {}, { datasetId: dataset.id, metadata: { provenance: "synthetic", corpus: "wiring-fixtures-v1" } });
  const experiment = await evaluate(async (inputs: Record<string, unknown>) => {
    const result = byId.get(String(inputs.caseId)); if (!result) throw new Error("Missing case result");
    return { caseId: result.caseId, deterministicPass: !result.criticalFailures.length && result.checks.every(check => check.pass), semanticReviewRequired: result.semanticReviewRequired };
  }, {
    data: datasetName,
    client,
    experimentPrefix: `istory-${manifest.mode}-deterministic`,
    maxConcurrency: 2,
    evaluators: [({ outputs }: { outputs: Record<string, unknown> }) => ({ key: "deterministic_checks", score: outputs.deterministicPass ? 1 : 0 })],
    metadata: { ...manifest, publicationType: "synthetic-scored-results", semantic_judge_calls: 0 },
  });
  let count = 0;
  for await (const row of experiment) { if (row.run.error || row.evaluationResults.results.length === 0) throw new Error("Incomplete LangSmith evidence"); count++; }
  if (count !== cases.length) throw new Error("Incomplete LangSmith publication");
  await client.awaitPendingTraceBatches();
  return experiment.experimentName;
}
