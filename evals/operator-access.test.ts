import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { cohortMode, issueCohortCookie, verifyCohortCookie, COHORT_COOKIE, COHORT_ENTRY, COHORT_TTL_SECONDS } from "@/lib/runtime/cohort";
import { GET, POST } from "@/app/api/release/access/route";

const effects = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: effects.server }));
vi.mock("@supabase/supabase-js", () => ({ createClient: effects.admin }));
import { middleware } from "@/middleware";
import { validateAuthOrReject } from "@/lib/auth";
import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";
import { runtimeConfiguration, externalMediaEnabled, assertEmailRecipient } from "@/lib/runtime/config";

// Synthetic 32-byte material; never valid in a hosted environment.
const code = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => i + 1)).toString("base64url");
const origin = "https://synthetic.invalid";
const now = Date.parse("2026-11-12T12:00:00Z");
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  for (const [name, value] of Object.entries({ APP_RELEASE_MODE: "active", APP_FRONTDOOR_MODE: "operator", RELEASE_COHORT_SECRET: code,
    RELEASE_COHORT_ID: "11111111-1111-4111-8111-111111111111", VERCEL_GIT_COMMIT_SHA: "a".repeat(40), VERCEL_DEPLOYMENT_ID: "dpl_syntheticArtifactOne",
    NEXT_PUBLIC_APP_URL: origin, AI_PROVIDER_MODE: "disabled", PAYMENT_PROVIDER_MODE: "disabled", AI_WORKER_ENABLED: "false", PAYMENT_NOTICE_WORKER_ENABLED: "false" })) vi.stubEnv(name, value);
  effects.server.mockReturnValue({ auth: { getUser: effects.getUser } });
  effects.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
const request = (path: string, cookie?: string, method = "GET") => new NextRequest(origin + path, { method, headers: cookie ? { Cookie: `${COHORT_COOKIE}=${cookie}` } : {} });
afterEach(() => vi.useRealTimers());
const submit = (body: string, headers: Record<string, string> = {}) => new NextRequest(origin + COHORT_ENTRY, { method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...headers }, body });

it("preserves open-by-default behavior and rejects ambiguous or unsafe operator settings", () => {
  expect(cohortMode({})).toBe("open");
  expect(cohortMode()).toBe("operator");
  for (const patch of [{ APP_FRONTDOOR_MODE: "" }, { RELEASE_COHORT_SECRET: "weak" }, { VERCEL_GIT_COMMIT_SHA: "short" },
    { VERCEL_DEPLOYMENT_ID: "" }, { RELEASE_COHORT_ID: "not-a-window" }, { AI_PROVIDER_MODE: "live" }, { PAYMENT_PROVIDER_MODE: "live" },
    { AI_WORKER_ENABLED: "true" }, { PAYMENT_NOTICE_WORKER_ENABLED: "true" }, { NEXT_PUBLIC_APP_URL: "https://user:pass@synthetic.invalid" }]) {
    expect(cohortMode({ ...process.env, ...patch })).toBe("invalid");
  }
});
it("issues an expiring artifact-bound proof without embedding the access code", async () => {
  const cookie = await issueCohortCookie(code);
  expect(cookie).toBeTruthy(); expect(cookie).not.toContain(code);
  expect(await verifyCohortCookie(cookie)).toBe(true);
  expect(await issueCohortCookie("wrong")).toBeNull();
  expect(await verifyCohortCookie(cookie, process.env, now + COHORT_TTL_SECONDS * 1000)).toBe(false);
  expect(await verifyCohortCookie(cookie, process.env, now - 1000)).toBe(true);
  expect(await verifyCohortCookie(cookie, process.env, now - 6000)).toBe(false);
  expect(await issueCohortCookie(Buffer.alloc(32, 9).toString("base64url"))).toBeNull();
  expect(await verifyCohortCookie(`${Math.floor(now / 1000)}.${Buffer.alloc(32).toString("base64url")}`)).toBe(false);
  for (const patch of [{ RELEASE_COHORT_ID: "22222222-2222-4222-8222-222222222222" }, { VERCEL_GIT_COMMIT_SHA: "b".repeat(40) },
    { VERCEL_DEPLOYMENT_ID: "dpl_syntheticArtifactTwo" }, { NEXT_PUBLIC_APP_URL: "https://other.invalid" }]) {
    expect(await verifyCohortCookie(cookie, { ...process.env, ...patch })).toBe(false);
  }
  expect(await verifyCohortCookie(cookie?.slice(0, -1) + "!")).toBe(false);
});
it.each([["/profile", "GET"], ["/api/user/profile", "PUT"], ["/api/auth/callback?code=synthetic", "GET"],
  ["/api/auth/refresh", "POST"], ["/api/stories/synthetic.png", "DELETE"], ["/api/internal/ai-jobs", "POST"], ["/_next/image?url=synthetic", "GET"]])(
  "holds %s %s before downstream work without the operator proof", async (path, method) => {
    const response = await middleware(request(path, undefined, method));
    expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(effects.server).not.toHaveBeenCalled(); expect(effects.admin).not.toHaveBeenCalled();
  });
it("allows operator navigation and callbacks without replacing normal account authentication", async () => {
  const cookie = await issueCohortCookie(code);
  const response = await middleware(request("/profile", cookie!));
  expect(response.status).toBe(200); expect(effects.getUser).toHaveBeenCalledOnce();
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  expect((await middleware(request("/api/auth/callback?code=synthetic", cookie!))).status).toBe(200);
  expect((await validateAuthOrReject(request("/api/user/profile")) as Response).status).toBe(503);
});
it("never overrides a global pause and leaves public readiness false", async () => {
  const cookie = await issueCohortCookie(code);
  expect(await (await health()).json()).toMatchObject({ acceptingTraffic: false, frontdoorMode: "operator" });
  expect((await ready()).status).toBe(503);
  vi.stubEnv("APP_RELEASE_MODE", "paused");
  for (const path of ["/profile", COHORT_ENTRY]) expect((await middleware(request(path, cookie!))).status).toBe(503);
  expect((await POST(submit(`code=${code}`))).status).toBe(503);
});
it("fails closed on malformed operator configuration without echoing it", async () => {
  vi.stubEnv("RELEASE_COHORT_SECRET", "private-invalid-setting");
  for (const path of ["/profile", "/api/user/profile", COHORT_ENTRY]) {
    const response = await middleware(request(path));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-invalid-setting");
  }
  expect(await (await health()).json()).toMatchObject({ acceptingTraffic: false, frontdoorMode: "invalid" });
  expect(effects.server).not.toHaveBeenCalled(); expect(effects.admin).not.toHaveBeenCalled();
});
it("serves a script-free operator form, closes entry in open mode and never echoes private settings", async () => {
  const response = await GET(); const html = await response.text();
  expect(response.status).toBe(200); expect(html).toContain('type="password"'); expect(html).not.toContain(code);
  expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  vi.stubEnv("APP_FRONTDOOR_MODE", "open"); expect((await GET()).status).toBe(404);
});
it("issues only a secure host cookie and redirects only to the fixed same-origin root", async () => {
  const response = await POST(submit(`code=${code}`));
  expect(response.status).toBe(303); expect(response.headers.get("Location")).toBe("/");
  const cookie = response.headers.get("Set-Cookie")!;
  for (const text of [COHORT_COOKIE, "HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) expect(cookie.toLowerCase()).toContain(text.toLowerCase());
  expect(cookie).not.toContain(code); expect(cookie).not.toContain("Domain=");
  expect(fetch).not.toHaveBeenCalled(); expect(effects.admin).not.toHaveBeenCalled();
});
it("rejects cross-origin, duplicate, oversized and incorrect submissions without redirects or reflected secrets", async () => {
  for (const [body, headers, status] of [[`code=${code}`, { Origin: "https://other.invalid" }, 403],
    [`code=${code}&code=${code}`, {}, 400], ["code=wrong", {}, 401], ["code=" + "x".repeat(513), {}, 413],
    [`code=${code}&next=https://other.invalid`, {}, 400]] as const) {
    const response = await POST(submit(body, headers)); expect(response.status).toBe(status);
    expect(response.headers.has("Set-Cookie")).toBe(false); expect(response.headers.has("Location")).toBe(false);
    expect(await response.text()).not.toContain(code);
  }
});
it("keeps application email, external media and all consumers held during operator acceptance", () => {
  expect(runtimeConfiguration()).toMatchObject({ aiMode: "disabled", paymentMode: "disabled", aiWorkerEnabled: false, paymentWorkerEnabled: false });
  expect(externalMediaEnabled()).toBe(false);
  expect(() => assertEmailRecipient("synthetic@example.invalid")).toThrow();
  vi.stubEnv("AI_WORKER_ENABLED", "true"); expect(() => runtimeConfiguration()).toThrow();
});
it("expires the browser's operator cookie on same-origin exit without affecting account data", async () => {
  const response = await POST(submit("action=end"));
  expect(response.status).toBe(303); expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  expect(effects.admin).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it("stops an unfinished body at the read deadline without issuing a proof", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(`code=${code}`)); } });
  const init = { method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: stream, duplex: "half" as const };
  const pending = POST(new NextRequest(origin + COHORT_ENTRY, init));
  await vi.advanceTimersByTimeAsync(2100);
  const response = await pending; expect(response.status).toBe(400); expect(response.headers.has("Set-Cookie")).toBe(false);
});
