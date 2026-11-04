import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const providers = vi.hoisted(() => ({ audio: vi.fn(), database: vi.fn() }));
vi.mock("@elevenlabs/elevenlabs-js", () => ({ ElevenLabsClient: providers.audio }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: providers.database }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: async () => "00000000-0000-4000-8000-000000000011", isAuthError: () => false, resolveUserId: async (value: string) => value }));
import { POST as transcribe } from "@/app/api/ai/transcribe/route";
import { POST as compile } from "@/app/api/book/compile/route";
import { POST as upload } from "@/app/api/ipfs/upload/route";

function staging() {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("AI_PROVIDER_MODE", "mock");
  vi.stubEnv("PAYMENT_PROVIDER_MODE", "disabled");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://istory-staging.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${"s".repeat(20)}.supabase.co`);
  vi.stubEnv("EXPECTED_SUPABASE_PROJECT_REF", "s".repeat(20));
  vi.stubEnv("PRODUCTION_SUPABASE_PROJECT_REF", "p".repeat(20));
}
describe("staging external media isolation", () => {
  it.each([transcribe, compile])("rejects live media work before database, body processing or provider initialization", async handler => {
    staging();
    const response = await handler(new NextRequest("https://istory-staging.vercel.app/api/media", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(providers.audio).not.toHaveBeenCalled(); expect(providers.database).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not create an immutable public IPFS copy in staging", async () => {
    staging();
    const body = new FormData(); body.set("metadata", JSON.stringify({ is_public: true, content: "Synthetic" }));
    const response = await upload(new NextRequest("https://istory-staging.vercel.app/api/ipfs/upload", { method: "POST", body }));
    expect(response.status).toBe(503); expect(fetch).not.toHaveBeenCalled();
  });
});
