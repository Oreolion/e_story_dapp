import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { z } from "zod";
import { createTextGenerator, providerUnavailable } from "./provider";
import { hasTextProvider } from "./providerPolicy";
import type { ProviderUsage } from "./deepseek";
import { InvalidModelOutput, runAnalysis } from "./tasks";
import { InferencePrivacyError, assertPrivateInferenceConfiguration } from "./workflow";
import { runtimeConfiguration } from "@/lib/runtime/config";
type Admin = ReturnType<typeof createSupabaseAdminClient>;
const jobContract = z.object({ id: z.string().uuid(), owner_id: z.string().uuid(), story_id: z.string().uuid(), source_revision: z.number().int().positive(), lease_token: z.string().uuid(), deadline_at: z.string(), prompt_version: z.literal("analysis-v2"), model_version: z.literal("gemini-2.5-flash"), schema_version: z.literal(1), attempts: z.number().int().min(1).max(2), error_code: z.string().nullable() });
export async function processAnalysisJob(admin: Admin, jobId?: string) {
  assertPrivateInferenceConfiguration();
  const config = runtimeConfiguration();
  if (config.aiMode === "disabled" || config.aiMode === "live" && !hasTextProvider()) throw new Error("AI provider unavailable");
  const { data, error } = await admin.rpc("claim_ai_job", { p_job_id: jobId ?? null, p_daily_limit: config.dailyCallLimit, ...(config.totalCallLimit === null ? {} : { p_total_limit: config.totalCallLimit }) });
  if (error) throw new Error("Job dispatch unavailable");
  const value = Array.isArray(data) ? data[0] : data;
  if (!value) return { status: "idle" as const };
  const job = jobContract.parse(value);
  try {
    const { data: story, error: readError } = await admin.from("stories").select("id, author_id, revision, content, story_type").eq("id", job.story_id).eq("author_id", job.owner_id).single();
    if (readError || !story || story.revision !== job.source_revision) throw new Error("source_changed");
    const remaining = Date.parse(job.deadline_at) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("deadline");
    let usage: ProviderUsage = {};
    const result = await runAnalysis(story.content, story.story_type, createTextGenerator(remaining, value => { usage = value; }, "analysis", { preferFallback: job.attempts === 2 && job.error_code === "provider_transient" }));
    const { data: committed, error: persistError } = await admin.rpc("complete_ai_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_result: result, p_usage: usage });
    if (persistError) throw new Error("persistence_unavailable");
    return { status: committed === true ? "succeeded" as const : "superseded" as const };
  } catch (error) {
    const code = error instanceof InferencePrivacyError ? "privacy_configuration" : error instanceof InvalidModelOutput ? "invalid_output" : error instanceof Error && error.message === "source_changed" ? "source_changed" : error instanceof Error && error.message === "persistence_unavailable" ? "persistence_unavailable" : "provider_failure";
    const transient = code === "persistence_unavailable" || code === "provider_failure" && providerUnavailable(error);
    const { error: failError } = await admin.rpc("fail_ai_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_error_code: transient && code === "provider_failure" ? "provider_transient" : code, p_retryable: transient });
    // If recording failure is unavailable, the lease still expires and is bounded.
    if (failError) throw new Error("Job failure persistence unavailable");
    return { status: "failed" as const, code };
  }
}
