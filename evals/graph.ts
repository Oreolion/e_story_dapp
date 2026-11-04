import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { workflows, type Target, type TargetInput } from "./types";

const targetInput = z.object({ id: z.string().min(1), workflow: z.enum(workflows), input: z.record(z.string(), z.unknown()) }).strict();
const State = Annotation.Root({ request: Annotation<TargetInput>(), output: Annotation<unknown>() });

/** Only task inputs enter the target; fixtures, labels and grading references never do. */
export function createEvaluationGraph(target: Target) {
  return new StateGraph(State)
    .addNode("validate", state => { targetInput.parse(state.request); return {}; })
    .addNode("target", async (state, config) => ({ output: await target(state.request, config.signal ?? new AbortController().signal) }))
    .addEdge(START, "validate").addEdge("validate", "target").addEdge("target", END).compile();
}

export async function runBounded<T, R>(items: T[], task: (item: T, signal: AbortSignal) => Promise<R>, options: { concurrency: number; timeoutMs: number; maxCases: number }): Promise<R[]> {
  const { concurrency, timeoutMs, maxCases } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Number.isFinite(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxCases) || maxCases < 1 || items.length > maxCases || items.length === 0) throw new Error("Invalid evaluation limits or case count");
  const results: R[] = new Array(items.length);
  const batch = new AbortController();
  let next = 0;
  const worker = async () => {
    while (!batch.signal.aborted && next < items.length) {
      const index = next++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        results[index] = await Promise.race([
          task(items[index], batch.signal),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { batch.abort(); reject(new Error("Evaluation deadline exceeded; remaining work stopped")); }, timeoutMs); }),
        ]);
      } catch {
        batch.abort();
        // Provider errors can contain content or credentials: expose a code, not the original message.
        throw new Error("Evaluation target failed or timed out; batch stopped");
      } finally { if (timer) clearTimeout(timer); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
