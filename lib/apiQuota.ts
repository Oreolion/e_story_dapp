import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface ApiQuotaPolicy {
  action: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface ApiQuotaResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  unavailable: boolean;
}

interface QuotaRow {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

export async function consumeApiQuota(
  admin: AdminClient,
  userId: string,
  policy: ApiQuotaPolicy
): Promise<ApiQuotaResult> {
  try {
    const { data, error } = await admin.rpc("consume_api_quota", {
      p_user_id: userId,
      p_action: policy.action,
      p_max_requests: policy.maxRequests,
      p_window_seconds: policy.windowSeconds,
    });

    const row = (Array.isArray(data) ? data[0] : data) as QuotaRow | null;
    if (error || !row || typeof row.allowed !== "boolean") {
      console.error("[API_QUOTA] Quota check failed", {
        action: policy.action,
        message: error?.message ?? "Invalid quota response",
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfter: policy.windowSeconds,
        unavailable: true,
      };
    }

    const resetAt = Date.parse(row.reset_at);
    const retryAfter = Number.isFinite(resetAt)
      ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
      : policy.windowSeconds;

    return {
      allowed: row.allowed,
      remaining: Math.max(0, row.remaining),
      retryAfter,
      unavailable: false,
    };
  } catch (error) {
    console.error("[API_QUOTA] Quota check threw", {
      action: policy.action,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfter: policy.windowSeconds,
      unavailable: true,
    };
  }
}
