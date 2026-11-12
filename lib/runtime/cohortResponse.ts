import { NextRequest, NextResponse } from "next/server";
import { cohortMode, COHORT_COOKIE, COHORT_ENTRY, verifyCohortCookie } from "./cohort";
import { maintenanceResponse } from "./releaseResponse";
import { isRetainedCallbackRequest } from "./dataApiFence";

export const cohortPrivacyHeaders = {
  "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
};
export async function rejectOperatorRequest(request: NextRequest): Promise<NextResponse | null> {
  const mode = cohortMode();
  if (mode === "open") return null;
  const path = request.nextUrl.pathname;
  if (isRetainedCallbackRequest(request)) return null;
  if (["/api/health", "/api/ready"].includes(path) && ["GET", "HEAD"].includes(request.method)) return null;
  if (mode === "operator" && path === COHORT_ENTRY && ["GET", "HEAD", "POST"].includes(request.method)) return null;
  if (mode === "operator" && await verifyCohortCookie(request.cookies.get(COHORT_COOKIE)?.value)) return null;
  return maintenanceResponse(request);
}
export function protectOperatorResponse(response: NextResponse): NextResponse {
  if (cohortMode() === "operator") for (const [name, value] of Object.entries(cohortPrivacyHeaders)) response.headers.set(name, value);
  return response;
}
