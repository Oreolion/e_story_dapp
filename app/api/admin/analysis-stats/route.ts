import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { analysisLogger } from "@/app/utils/analysisLogger";
import { performanceMonitor } from "@/app/utils/performanceMonitor";
import { safeCompare } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Admin endpoint for monitoring analysis pipeline health.
 * Protected via ADMIN_SECRET bearer token + rate limiting.
 */
export async function GET(req: NextRequest) {
  // Rate limit: 60 requests per hour per IP
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`admin:analysis-stats:${ip}`, 60, 60 * 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Check admin authorization
  const authHeader = req.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    console.error("ADMIN_SECRET environment variable not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (!authHeader || !safeCompare(authHeader, `Bearer ${adminSecret}`)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Get total count of stories with metadata
    const { count: totalMetadata, error: countError } = await supabase
      .from("story_metadata")
      .select("*", { count: "exact", head: true });

    if (countError) {
      // Handle case where table doesn't exist
      if (countError.code === "42P01" || countError.message?.includes("does not exist")) {
        return NextResponse.json({
          statusCounts: {
            total: 0,
            note: "story_metadata table does not exist"
          },
          performance: performanceMonitor.getAllStats(),
          recentErrors: analysisLogger.getErrorLogs(20),
          recentLogs: analysisLogger.getRecentLogs(50),
          summary: {
            healthy: false,
            reason: "Database table not found"
          }
        });
      }
      throw countError;
    }

    // Get stories count from main stories table for comparison
    const { count: totalStories, error: storiesError } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true });

    // Get recent metadata entries to check for issues
    const { data: recentMetadata, error: recentError } = await supabase
      .from("story_metadata")
      .select("story_id, created_at, emotional_tone, life_domain")
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate health metrics
    const performanceStats = performanceMonitor.getAllStats();
    const errorLogs = analysisLogger.getErrorLogs(20);
    const recentLogs = analysisLogger.getRecentLogs(50);

    // Find full_analysis stats if available
    const fullAnalysisStats = performanceStats.find(s => s.operation === "full_analysis");

    // Calculate health summary
    const healthy = errorLogs.length < 5 &&
      (!fullAnalysisStats || fullAnalysisStats.successRate > 0.9);

    const healthReasons: string[] = [];
    if (errorLogs.length >= 5) {
      healthReasons.push(`${errorLogs.length} recent errors`);
    }
    if (fullAnalysisStats && fullAnalysisStats.successRate <= 0.9) {
      healthReasons.push(`Low success rate: ${(fullAnalysisStats.successRate * 100).toFixed(1)}%`);
    }

    return NextResponse.json({
      statusCounts: {
        totalMetadata: totalMetadata ?? 0,
        totalStories: storiesError ? "unknown" : (totalStories ?? 0),
        coverageRate: totalStories && totalStories > 0
          ? ((totalMetadata ?? 0) / totalStories * 100).toFixed(1) + "%"
          : "N/A"
      },
      recentMetadata: recentError ? null : recentMetadata,
      performance: performanceStats,
      recentErrors: errorLogs,
      recentLogs: recentLogs,
      logCounts: {
        total: analysisLogger.getLogCount(),
        errors: errorLogs.length
      },
      summary: {
        healthy,
        reasons: healthReasons.length > 0 ? healthReasons : ["All systems operational"],
        lastAnalysis: fullAnalysisStats?.lastRecordedAt ?? null,
        avgAnalysisTime: fullAnalysisStats?.avgDuration
          ? `${fullAnalysisStats.avgDuration}ms`
          : null
      }
    });

  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
