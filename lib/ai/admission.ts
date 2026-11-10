import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { assertPrivateInferenceConfiguration } from "./workflow";
import { runtimeConfiguration } from "@/lib/runtime/config";
import { hasTextProvider } from "./providerPolicy";
export async function admitTextInference(admin: ReturnType<typeof createSupabaseAdminClient>, ownerId: string, task: "enhancement" | "tracker" | "reflection") {
  try {
    const config = runtimeConfiguration();
    const dailyLimit = config.dailyCallLimit;
    assertPrivateInferenceConfiguration();
    if (config.aiMode === "disabled" || config.aiMode === "live" && !hasTextProvider()) return { allowed: false, unavailable: true, retryAfter: 60 };
    const { data, error } = await admin.rpc("admit_ai_text_call", { p_owner_id: ownerId, p_task: task, p_daily_limit: dailyLimit, ...(config.totalCallLimit === null ? {} : { p_total_limit: config.totalCallLimit }) });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || typeof row.allowed !== "boolean") return { allowed: false, unavailable: true, retryAfter: 60 };
    return { allowed: row.allowed, unavailable: row.reason === "budget", retryAfter: Math.max(1, Number(row.retry_after) || 60) };
  } catch { return { allowed: false, unavailable: true, retryAfter: 60 }; }
}
