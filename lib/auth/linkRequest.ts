import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeApiQuota } from "@/lib/apiQuota";
import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { LinkError } from "./linking";

export const completionContract = z.object({ challengeId: z.string().regex(/^[a-f0-9]{64}$/), signature: z.string().regex(/^0x[0-9a-f]+$/i).max(2048) }).strict();

export function linkingOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new LinkError("link_unavailable", 503);
  let expected: URL;
  try { expected = new URL(configured); } catch { throw new LinkError("link_unavailable", 503); }
  if (expected.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname)) throw new LinkError("link_unavailable", 503);
  if (request.nextUrl.origin !== expected.origin || request.headers.get("origin") !== expected.origin || request.headers.get("sec-fetch-site") === "cross-site") throw new LinkError("link_forbidden", 403);
  return expected.origin;
}
export async function linkingQuota(admin: ReturnType<typeof createSupabaseAdminClient>, ownerId: string) {
  const quota = await consumeApiQuota(admin, ownerId, { action: "identity_link", maxRequests: 10, windowSeconds: 600 });
  if (quota.unavailable) throw new LinkError("link_unavailable", 503);
  if (!quota.allowed) return NextResponse.json({ error: "Too many linking attempts" }, { status: 429, headers: { "Retry-After": String(quota.retryAfter) } });
  return null;
}
export function linkingFailure(error: unknown) {
  if (error instanceof LinkError) return NextResponse.json({ error: error.status === 409 ? "Account link conflict. Existing account data has been preserved." : error.status === 401 ? "Restart linking and verify both accounts." : error.status === 403 ? "Account proof was not accepted." : "Account linking temporarily unavailable", code: error.code }, { status: error.status });
  return NextResponse.json({ error: "Account linking temporarily unavailable", code: "link_unavailable" }, { status: 503 });
}
export async function linkBody(request: NextRequest) {
  // Enforce bytes even when Content-Length is absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new LinkError("link_forbidden", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const value = await reader.read();
    if (value.done) break;
    size += value.value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new LinkError("link_forbidden", 413); }
    chunks.push(value.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new LinkError("link_forbidden", 400); }
}
