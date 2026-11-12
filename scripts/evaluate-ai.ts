import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureSourceIdentity } from "../evals/provenance";
import { cases } from "../evals/fixtures";
import { createEvaluationGraph, runBounded } from "../evals/graph";
import { evaluateObservation } from "../evals/metrics";
import { decideGate } from "../evals/gate";
import { createProductTarget } from "../evals/product-target";
import { createBudgetedLiveGenerator } from "../evals/live-target";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--publish", "--require-quality-pass", "--product", "--live"].includes(arg) && !/^--(?:budget-usd|input-price|output-price|max-cases)=\d+(?:\.\d+)?$/.test(arg))) throw new Error("Unknown evaluation argument");
  if (new Set(args.map(arg => arg.split("=")[0])).size !== args.length) throw new Error("Duplicate evaluation argument");
  const sourceIdentity = captureSourceIdentity();
  // A standalone synthetic runner, separate from private inference processes.
  for (const key of ["LANGSMITH_TRACING", "LANGSMITH_TRACING_V2", "LANGCHAIN_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_VERBOSE", "LANGSMITH_OTEL_ENABLED"]) process.env[key] = "false";
  if (args.includes("--product") && args.includes("--live")) throw new Error("Choose one target mode");
  if (!args.includes("--live") && args.some(arg => arg.includes("="))) throw new Error("Budget arguments require live mode");
  const numberArg = (name: string) => Number(args.find(arg => arg.startsWith(`--${name}=`))?.split("=")[1]);
  const live = args.includes("--live") ? createBudgetedLiveGenerator({ budgetUsd: numberArg("budget-usd"), inputPricePerMillion: numberArg("input-price"), outputPricePerMillion: numberArg("output-price"), maxCalls: numberArg("max-cases") }) : null;
  const selected = live ? cases.filter(row => ["analysis", "enhancement", "tracker", "reflection"].includes(row.workflow)).slice(0, numberArg("max-cases")) : cases;
  const mode = live ? "live" : args.includes("--product") ? "product-mock" : "fixture";
  const outputs = new Map(cases.map(row => [row.id, row.fixtureOutput]));
  const liveProduct = live ? createProductTarget(live.generate) : null;
  const graph = createEvaluationGraph(mode === "fixture" ? async ({ id }) => { if (!outputs.has(id)) throw new Error("Missing fixture"); return structuredClone(outputs.get(id)); } : async request => {
    if (liveProduct) return liveProduct(request);
    if (!outputs.has(request.id)) throw new Error("Missing fixture");
    // Each concurrent case owns its mock response. References and grading rules
    // stay outside target inputs and production prompt construction.
    const output = structuredClone(outputs.get(request.id));
    const fixtureText = () => {
      if (typeof output !== "object" || output === null || !("text" in output) || typeof output.text !== "string") throw new Error("Missing text fixture");
      return output.text;
    };
    const product = createProductTarget(async () => {
      if (typeof output === "object" && output !== null && "text" in output) return fixtureText();
      const serialized = JSON.stringify(output);
      if (serialized === undefined) throw new Error("Missing structured fixture");
      return serialized;
    }, async () => fixtureText());
    return product(request);
  });
  const results = await runBounded(selected, async (row, signal) => {
    const start = performance.now();
    const state = await graph.invoke({ request: { id: row.id, workflow: row.workflow, input: row.input } }, { signal, recursionLimit: 5 });
    return evaluateObservation(row, { output: state.output, latencyMs: performance.now() - start, mode });
  }, { concurrency: live ? 1 : 2, timeoutMs: live ? 60000 : 10000, maxCases: 100 });
  const gate = decideGate(selected, results);
  const sources = ["package-lock.json", "scripts/evaluate-ai.ts", "evals/provenance.ts", "evals/fixtures.ts", "evals/metrics.ts", "evals/graph.ts", "evals/gate.ts", "evals/judge.ts", "evals/langsmith.ts", "evals/product-target.ts", "evals/live-target.ts", "lib/ai/tasks.ts", "lib/ai/admission.ts", "lib/ai/workflow.ts", "lib/ai/jobs.ts", "lib/ai/provider.ts", "supabase/migrations/020_durable_ai_jobs.sql", "app/api/ai/analyze/route.ts", "app/api/ai/enhance/route.ts", "app/api/ai/reflection/route.ts", "app/api/ai/transcribe/route.ts"];
  sources.push("lib/ai/providerPolicy.ts", "lib/ai/deepseek.ts", "evals/provider-fallback.test.ts");
  sources.push("lib/ai/availability.ts", "lib/ai/messages.ts", "evals/ai-disabled.test.ts");
  sources.push("lib/runtime/cohort.ts", "lib/runtime/cohortResponse.ts", "lib/runtime/config.ts", "app/api/release/access/route.ts", "evals/operator-access.test.ts");
  sources.push("lib/runtime/dataApiFence.ts", "lib/payments/callbacks.ts", "lib/payments/receipts.ts", "app/api/payment/webhook/route.ts", "ops/release/cutover/install-bridge.sql", "scripts/cutover-bridge-contract.mjs", "scripts/prepare-cutover.mjs", "evals/payment-retention.test.ts");
  const fingerprints = Object.fromEntries(await Promise.all(sources.map(async file => [file, createHash("sha256").update(await readFile(resolve(file))).digest("hex")])));
  const manifest = { ...sourceIdentity, capturedAt: new Date().toISOString(), budget: live ? { budgetUsd: numberArg("budget-usd"), inputPricePerMillion: numberArg("input-price"), outputPricePerMillion: numberArg("output-price"), maxCalls: numberArg("max-cases") } : null, datasetCaseCount: cases.length, selectedCaseIds: selected.map(row => row.id), mode, providerCalls: live?.usage.providerCalls ?? 0, judgeCalls: 0, usage: live?.usage ?? null, sourceFingerprints: fingerprints };
  const report = { manifest, gate, excludedWorkflows: [...new Set(cases.map(row => row.workflow))].filter(workflow => !selected.some(row => row.workflow === workflow)), remainingValidation: ["Human-calibrated holdout quality", "Multi-connection PostgreSQL concurrency", "Production schema and worker scheduling", "Signed native device acceptance"], results, langsmithExperiment: null as string | null };
  if (args.includes("--publish")) {
    const { publishSyntheticResults } = await import("../evals/langsmith");
    report.langsmithExperiment = await publishSyntheticResults(selected, results, manifest);
  }
  const directory = resolve("output/evaluations"); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "latest.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(resolve(directory, "latest.md"), `# AI evaluation report\n\nStatus: **${gate.status}**. Mode: ${mode}.\n\n${gate.completed}/${gate.expected} cases; ${manifest.providerCalls} provider calls; 0 judge calls.\n\n${gate.limitation}\n\nCRE is parked. Synthetic mock results do not establish model quality or production readiness.\n`);
  console.log(JSON.stringify({ status: gate.status, cases: results.length, mode, providerCalls: manifest.providerCalls, judgeCalls: 0, report: "output/evaluations/latest.json" }));
  if (["FAIL", "INCONCLUSIVE"].includes(gate.status) || args.includes("--require-quality-pass") && (gate.status !== "PASS" || !sourceIdentity.sourceCommitted)) process.exitCode = 1;
}
main().catch(async () => {
  console.error("AI evaluation failed. Check configuration, dependencies and coverage; no passing report was established.");
  process.exitCode = 1;
  try {
    const directory = resolve("output/evaluations"); await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "latest.json"), JSON.stringify({ capturedAt: new Date().toISOString(), gate: { status: "INCONCLUSIVE" }, error: "execution_failed" }, null, 2) + "\n");
    await writeFile(resolve(directory, "latest.md"), "# AI evaluation\n\nINCONCLUSIVE: execution failed; no current passing evidence.\n");
  } catch { /* The nonzero process exit remains authoritative if report storage fails. */ }
});
