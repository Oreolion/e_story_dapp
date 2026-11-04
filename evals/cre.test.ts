import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => { throw new Error("Parked CRE must not access storage"); } }));
import { POST as trigger } from "@/app/api/cre/trigger/route";
import { POST as callback } from "@/app/api/cre/callback/route";
import { POST as check } from "@/app/api/cre/check/route";
const handlers = { trigger, callback, check };
describe("parked on-chain verification", () => {
  it.each(["trigger", "callback", "check"])("%s performs no work, even for legacy requests", async endpoint => {
    const POST = handlers[endpoint as keyof typeof handlers];
    const response = await POST(new NextRequest(`http://localhost/api/cre/${endpoint}`, { method: "POST", body: JSON.stringify({ storyId: "legacy-story", verified: true }) }));
    expect(response.status).toBe(endpoint === "check" ? 200 : 410);
    expect(await response.json()).toMatchObject({ verified: false, status: "coming_soon", code: "ONCHAIN_VERIFICATION_PARKED" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
