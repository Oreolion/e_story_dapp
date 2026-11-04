import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { withRunTree } from "langsmith/traceable";
import { RunTree } from "langsmith/run_trees";

export type TextTask = "analysis" | "enhancement" | "reflection" | "tracker";
export interface TextWorkflowInput {
  task: TextTask;
  prompt: string;
  generate: (prompt: string) => Promise<string>;
  parse?: (output: string) => unknown;
}
const State = Annotation.Root({
  request: Annotation<TextWorkflowInput>(),
  output: Annotation<string>(),
  value: Annotation<unknown>(),
});

// No checkpointer, tools, persistent state or automatic retries. Authorization,
// quotas and database commits belong to the calling service, outside inference.
const graph = new StateGraph(State)
  .addNode("validate_input", ({ request }) => {
    if (!["analysis", "enhancement", "reflection", "tracker"].includes(request.task) ||
        !request.prompt.trim() || request.prompt.length > 100_000) {
      throw new Error("Invalid text workflow input");
    }
    return {};
  })
  .addNode("generate", async ({ request }) => ({ output: await request.generate(request.prompt) }))
  .addNode("validate_output", ({ output, request }) => {
    if (!output?.trim()) throw new Error("Provider returned empty output");
    if (output.length > 100_000) throw new Error("Provider output exceeds limit");
    return { value: request.parse ? request.parse(output) : output };
  })
  .addEdge(START, "validate_input")
  .addEdge("validate_input", "generate")
  .addEdge("generate", "validate_output")
  .addEdge("validate_output", END)
  .compile();

export class InferencePrivacyError extends Error {
  constructor() { super("Production inference requires ambient tracing and verbose logging to be disabled"); }
}

// Private inference and synthetic LangSmith experiments run in separate processes.
// Fail closed before graph creation/execution when host-wide tracing is enabled:
// installed SDKs can re-enable nested tracing despite a disabled parent context.
export function runTextWorkflow<T>(request: TextWorkflowInput & { parse: (output: string) => T }): Promise<T>;
export function runTextWorkflow(request: TextWorkflowInput): Promise<string>;
export async function runTextWorkflow(request: TextWorkflowInput): Promise<unknown> {
  assertPrivateInferenceConfiguration();
  return withRunTree(new RunTree({ name: "private-text-workflow", tracingEnabled: false }), async () => {
    const result = await graph.invoke({ request }, { recursionLimit: 6 });
    return result.value;
  });
}
export function assertPrivateInferenceConfiguration() {
  if (["LANGSMITH_TRACING", "LANGSMITH_TRACING_V2", "LANGCHAIN_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_VERBOSE", "LANGSMITH_OTEL_ENABLED"].some(key => process.env[key]?.toLowerCase() === "true")) throw new InferencePrivacyError();
}

export const TEXT_GENERATION_CONFIG = { maxOutputTokens: 4096 } as const;
export const TEXT_REQUEST_OPTIONS = { timeout: 25_000 } as const;
