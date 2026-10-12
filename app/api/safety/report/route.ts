import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { isAuthError, resolveUserId, validateAuthOrReject } from "@/lib/auth";
import { parseSafetyReport, type SafetyReportInput } from "@/lib/contentSafety";

const MAX_REPORTS_PER_DAY = 20;

async function getTargetOwner(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  report: SafetyReportInput
): Promise<string | null> {
  if (report.targetType === "user") {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("id", report.targetId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const table = report.targetType === "story" ? "stories" : "comments";
  const ownerColumn = report.targetType === "story" ? "author_id" : "author_id";
  const { data } = await admin
    .from(table)
    .select(ownerColumn)
    .eq("id", report.targetId)
    .maybeSingle();

  return (data as { author_id?: string } | null)?.author_id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const reporterId = await resolveUserId(authResult);

    const parsed = parseSafetyReport(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const targetOwnerId = await getTargetOwner(admin, parsed.data);
    if (!targetOwnerId) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    if (targetOwnerId === reporterId) {
      return NextResponse.json({ error: "You cannot report your own content" }, { status: 400 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", reporterId)
      .gte("created_at", since);

    if (countError) {
      console.error("[SAFETY_REPORT] count failed:", countError);
      return NextResponse.json({ error: "Unable to submit report" }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_REPORTS_PER_DAY) {
      return NextResponse.json(
        { error: "Daily report limit reached. Contact support for urgent safety concerns." },
        { status: 429, headers: { "Retry-After": "86400" } }
      );
    }

    const { error } = await admin.from("content_reports").insert({
      reporter_id: reporterId,
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });

    if (error?.code === "23505") {
      return NextResponse.json({ error: "You already reported this content" }, { status: 409 });
    }
    if (error) {
      console.error("[SAFETY_REPORT] insert failed:", error);
      return NextResponse.json({ error: "Unable to submit report" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[SAFETY_REPORT] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
