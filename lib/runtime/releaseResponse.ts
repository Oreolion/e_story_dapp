import { NextResponse } from "next/server";
import { releaseMode } from "./release";

const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporarily unavailable | iStory</title></head><body><main><h1>We’ll be back shortly</h1><p>Please try again shortly.</p></main></body></html>';

export function rejectPausedRequest(request: Request): NextResponse | null {
  if (releaseMode() === "active") return null;
  const pathname = new URL(request.url).pathname;
  if ((pathname === "/api/health" || pathname === "/api/ready") && ["GET", "HEAD"].includes(request.method)) return null;
  return maintenanceResponse(request);
}

export function maintenanceResponse(request: Request): NextResponse {
  const pathname = new URL(request.url).pathname;
  const headers = {
    "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
    "Retry-After": "60", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  };
  if (pathname === "/api" || pathname.startsWith("/api/")) return NextResponse.json(
    { error: "Temporarily unavailable. Please try again shortly.", code: "SERVICE_PAUSED" }, { status: 503, headers }
  );
  return new NextResponse(request.method === "HEAD" ? null : page, { status: 503, headers: {
    ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  } });
}
