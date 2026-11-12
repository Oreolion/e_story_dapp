import { NextRequest, NextResponse } from "next/server";
import { cohortMode, cohortOrigin, COHORT_COOKIE, COHORT_ENTRY, COHORT_TTL_SECONDS, issueCohortCookie } from "@/lib/runtime/cohort";
import { cohortPrivacyHeaders } from "@/lib/runtime/cohortResponse";
import { releaseMode } from "@/lib/runtime/release";

export const dynamic = "force-dynamic";
export const maxDuration = 5;
// Intentionally outside account auth: this admits only a temporary operator
// browser. Every downstream account/ownership check remains mandatory.
const form = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Release access | eStories</title></head><body><main><h1>Private release checks</h1><p>Public access is temporarily held. Authorized operators can enter the access code for this release window.</p><form method="post" action="${COHORT_ENTRY}"><label for="code">Access code</label><input id="code" name="code" type="password" required minlength="43" maxlength="43" autocomplete="off" autocapitalize="none" spellcheck="false"><button type="submit">Continue</button></form><form method="post" action="${COHORT_ENTRY}"><input type="hidden" name="action" value="end"><button type="submit">End operator access</button></form><p>Use synthetic accounts only. Normal sign-in is still required after entry.</p></main></body></html>`;
function failure(status: number) {
  return NextResponse.json({ error: status === 503 ? "Temporarily unavailable. Please try again shortly." : "Access was not accepted.", code: status === 503 ? "SERVICE_PAUSED" : "ACCESS_DENIED" }, { status, headers: cohortPrivacyHeaders });
}
function unavailable() {
  return releaseMode() !== "active" || cohortMode() === "invalid" ? failure(503) : cohortMode() === "open" ? failure(404) : null;
}
export async function GET() {
  return unavailable() ?? new NextResponse(form, { headers: { ...cohortPrivacyHeaders, "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" } });
}
export async function POST(request: NextRequest) {
  const denied = unavailable(); if (denied) return denied;
  const origin = cohortOrigin();
  if (request.nextUrl.origin !== origin || request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") return failure(403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return failure(400);
  const reader = request.body?.getReader(); if (!reader) return failure(400);
  let expired = false;
  const timeout = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 2000);
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      if (expired) return failure(400);
      size += chunk.value.byteLength;
      if (size > 512) { await reader.cancel(); return failure(413); }
      chunks.push(chunk.value);
    }
    if (expired) return failure(400);
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const params = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(body));
    const end = params.size === 1 && params.get("action") === "end";
    if (!end && (params.size !== 1 || params.getAll("code").length !== 1)) return failure(400);
    const cookie = end ? "" : await issueCohortCookie(params.get("code")!);
    if (cookie === null) return failure(401);
    const response = new NextResponse(null, { status: 303, headers: { ...cohortPrivacyHeaders, Location: "/" } });
    response.cookies.set(COHORT_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: end ? 0 : COHORT_TTL_SECONDS });
    return response;
  } catch { return failure(400); }
  finally { clearTimeout(timeout); }
}
