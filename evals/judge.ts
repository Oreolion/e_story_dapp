import { z } from "zod";
import type { CaseResult } from "./types";

const verdict = z.object({ groundedness: z.number().int().min(0).max(4), helpfulness: z.number().int().min(0).max(4), criticalFailure: z.boolean() }).strict();
/** Optional injected judge. No model call for code-check failures or purely deterministic tasks. */
export async function reviewIfNeeded(result: CaseResult, judge: ((signal: AbortSignal) => Promise<unknown>) | undefined, budget: { remainingCalls: number }, timeoutMs = 10000) {
  if (!result.semanticReviewRequired || result.checks.some(check => !check.pass) || result.criticalFailures.length) return { status: "not_needed" as const };
  if (!judge) return { status: "not_run" as const };
  if (!Number.isInteger(budget.remainingCalls) || budget.remainingCalls < 1 || !Number.isFinite(timeoutMs) || timeoutMs < 1) return { status: "inconclusive" as const };
  budget.remainingCalls--;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([judge(controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Judge deadline")); }, timeoutMs); })]);
    const parsed = verdict.safeParse(raw);
    if (!parsed.success) return { status: "inconclusive" as const };
    return { status: parsed.data.criticalFailure || parsed.data.groundedness < 3 || parsed.data.helpfulness < 3 ? "fail" as const : "advisory" as const, scores: parsed.data };
  } catch { return { status: "inconclusive" as const }; }
  finally { if (timer) clearTimeout(timer); }
}
