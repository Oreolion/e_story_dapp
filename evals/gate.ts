import type { CaseResult, EvaluationCase } from "./types";
import { quantile, requiredCheckKeys } from "./metrics";

export function decideGate(expected: EvaluationCase[], results: CaseResult[]) {
  const ids = new Set(expected.map(row => row.id));
  const actual = new Set(results.map(row => row.caseId));
  const coverage = expected.length > 0 && ids.size === expected.length && actual.size === results.length && actual.size === ids.size && [...actual].every(id => ids.has(id));
  const valid = results.every(result => {
    const row = expected.find(row => row.id === result.caseId);
    return row && Number.isFinite(result.latencyMs) && result.latencyMs >= 0 && result.checks.length > 0 && result.checks.every(check => typeof check.pass === "boolean") && row.workflow === result.workflow && JSON.stringify(result.checks.map(check => check.key).sort()) === JSON.stringify(requiredCheckKeys(row));
  });
  const failed = results.filter(row => row.criticalFailures.length || row.checks.some(check => !check.pass));
  const needsReview = expected.some(row => row.semanticReview);
  const status = !coverage || !valid ? "INCONCLUSIVE" : failed.length ? "FAIL" : needsReview ? "ADVISORY" : "PASS";
  return {
    status, expected: expected.length, completed: results.length,
    failedCases: failed.map(row => row.caseId), semanticReviewRequired: needsReview,
    p50Ms: valid ? quantile(results.map(row => row.latencyMs), 0.5) : null,
    p95Ms: valid ? quantile(results.map(row => row.latencyMs), 0.95) : null,
    limitation: "Deterministic checks do not establish semantic quality, real-provider latency, receipt validity, or production readiness.",
  };
}
