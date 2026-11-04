import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for monitoring and CI/CD smoke tests.
 * Returns 200 OK when the app is serving requests.
 */
export async function GET() {
  const source = process.env.VERCEL_GIT_COMMIT_SHA;
  const commitSha = source && /^[a-f0-9]{40}$/i.test(source) ? source.toLowerCase() : null;
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "estories-web",
      version: commitSha?.slice(0, 7) || "dev",
      commitSha,
      environment: ["staging", "production", "ci", "test", "development"].includes(process.env.APP_ENV ?? "") ? process.env.APP_ENV : "unknown",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
