import { z } from "zod";
import { runAnalysis, runEditing, runReflection, type ReflectionSource } from "../lib/ai/tasks";
import type { TargetInput } from "./types";

/** References/expected outputs are never accepted by the production target. */
export function createProductTarget(generate: (prompt: string, task: TargetInput["workflow"]) => Promise<string>, transcribe?: (fixtureId: string) => Promise<string>) {
  return async ({ workflow, input }: TargetInput) => {
    if (workflow === "analysis") return runAnalysis(z.string().parse(input.text), undefined, prompt => generate(prompt, workflow));
    if (workflow === "enhancement" || workflow === "tracker") return { text: await runEditing(z.string().parse(input.text), workflow, prompt => generate(prompt, workflow)) };
    if (workflow === "reflection") {
      const stories = z.array(z.object({ id: z.string(), created_at: z.string(), title: z.string().optional(), content: z.string(), mood: z.string().optional(), isCanonical: z.boolean().optional() })).max(20).parse(input.stories) as ReflectionSource[];
      return runReflection(stories, prompt => generate(prompt, workflow));
    }
    if (workflow === "patterns") {
      const themes = z.array(z.string()).max(10000).parse(input.themes);
      const counts: Record<string, number> = Object.create(null);
      for (const theme of themes) counts[theme] = (counts[theme] ?? 0) + 1;
      return counts;
    }
    if (workflow === "transcription" && transcribe) return { text: await transcribe(z.string().parse(input.audioFixtureId)) };
    throw new Error("Target requires an explicit transcription adapter");
  };
}
