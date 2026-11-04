import { beforeAll, afterAll, describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createPostgresFixture, postgresAdmin } from "./support/postgres";
import type { PGlite } from "@electric-sql/pglite";
import { analysisOutput, syntheticText } from "./fixtures";
import { createServer } from "node:http";
import { request as httpRequest } from "@playwright/test";
const owner = "00000000-0000-4000-8000-000000000011";
const fixture = vi.hoisted(() => ({ admin: null as unknown as ReturnType<typeof postgresAdmin>, generate: vi.fn(), quota: vi.fn() }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => fixture.admin }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: async (request: Request) => request.headers.get("authorization") === "Bearer synthetic-owner" || request.headers.get("cookie") === "synthetic-owner=1" ? "00000000-0000-4000-8000-000000000011" : new Response(null, { status: 401 }), isAuthError: (value: unknown) => value instanceof Response, resolveUserId: async (value: string) => value }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: fixture.generate }; } } }));
vi.mock("@/lib/apiQuota", () => ({ consumeApiQuota: fixture.quota }));
import { POST as enhance } from "@/app/api/ai/enhance/route";
import { POST as save } from "@/app/api/journal/save/route";
import { POST as worker } from "@/app/api/internal/ai-jobs/route";
import { POST as enqueue, GET as status } from "@/app/api/ai/analyze/route";
import { GET as metadata } from "@/app/api/stories/[storyId]/metadata/route";
import { GET as stories } from "@/app/api/stories/route";
import { POST as reflection } from "@/app/api/ai/reflection/route";
let db: PGlite;
function request(path: string, body: unknown, credential = "synthetic-owner") { return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` }, body: JSON.stringify(body) }); }
beforeAll(async () => { db = await createPostgresFixture(); fixture.admin = postgresAdmin(db); }, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("TRUNCATE users CASCADE");
  await db.query("INSERT INTO users(id,wallet_address,subscription_plan,subscription_expires_at) VALUES($1,'synthetic-wallet','storyteller',now()+interval '30 days')", [owner]);
  fixture.generate.mockReset().mockImplementation(async (prompt: string) => ({ response: { text: () => prompt.includes("storytelling editor") ? syntheticText : JSON.stringify(analysisOutput) } }));
  fixture.quota.mockReset().mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 60 });
  vi.stubEnv("AI_WORKER_SECRET", "synthetic-worker-token-longer-than-32-characters");
});

describe("real handler and PostgreSQL journeys with synthetic inference", () => {
  it.each(["bearer", "cookie"])("saves, queues and delivers current metadata over HTTP with %s auth", async auth => {
    const server = createServer(async (incoming, outgoing) => {
      try {
        const chunks: Buffer[] = []; let size = 0;
        for await (const part of incoming) { const chunk = Buffer.from(part); size += chunk.length; if (size > 100000) throw new Error("Fixture body limit"); chunks.push(chunk); }
        const headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) if (typeof value === "string") headers.set(key, value);
        const req = new NextRequest(`http://localhost${incoming.url}`, { method: incoming.method, headers, ...(incoming.method === "POST" ? { body: Buffer.concat(chunks).toString() } : {}) });
        const res = incoming.url === "/api/ai/enhance" ? await enhance(req) : incoming.url === "/api/journal/save" ? await save(req) : incoming.url === "/api/internal/ai-jobs" ? await worker(req) : incoming.url?.startsWith("/api/ai/analyze") ? await status(req) : incoming.url?.startsWith("/api/stories/") ? await metadata(req, { params: Promise.resolve({ storyId: incoming.url.split("/")[3] }) }) : new Response(null, { status: 404 });
        outgoing.writeHead(res.status, Object.fromEntries(res.headers)); outgoing.end(await res.text());
      } catch { outgoing.writeHead(500); outgoing.end("Synthetic transport failure"); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture listener unavailable");
    const client = await httpRequest.newContext({ baseURL: `http://127.0.0.1:${address.port}`, extraHTTPHeaders: auth === "bearer" ? { Authorization: "Bearer synthetic-owner" } : { Cookie: "synthetic-owner=1" } });
    try {
      const edited = await client.post("/api/ai/enhance", { data: { text: syntheticText } }); expect(edited.status()).toBe(200);
      const saved = await client.post("/api/journal/save", { data: { title: "Synthetic", content: (await edited.json()).text, is_public: false } }); expect(saved.status()).toBe(200);
      const storyId = (await saved.json()).data.id;
      expect((await client.get(`/api/ai/analyze?storyId=${storyId}`)).status()).toBe(200);
      const denied = await client.post("/api/internal/ai-jobs"); expect(denied.status()).toBe(401);
      const processed = await client.post("/api/internal/ai-jobs", { headers: { Authorization: `Bearer ${process.env.AI_WORKER_SECRET}` } });
      expect(await processed.json()).toEqual({ status: "succeeded" });
      const read = await client.get(`/api/stories/${storyId}/metadata`); expect((await read.json()).metadata.people_mentioned).toEqual(["Ada"]);
      expect((await db.query("SELECT status FROM ai_jobs")).rows).toEqual([{ status: "succeeded" }]);
      expect(fixture.generate).toHaveBeenCalledTimes(2); expect(fetch).not.toHaveBeenCalled();
    } finally { await client.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 15000);
  it("does not persist invalid model output and exposes a failed job", async () => {
    const saved = await (await save(request("/api/journal/save", { content: syntheticText }))).json();
    fixture.generate.mockResolvedValue({ response: { text: () => '{"invented":true}' } });
    const outcome = await worker(request("/api/internal/ai-jobs", {}, process.env.AI_WORKER_SECRET));
    expect(await outcome.json()).toMatchObject({ status: "failed", code: "invalid_output" });
    expect((await db.query("SELECT * FROM story_metadata")).rows).toHaveLength(0);
    expect((await enqueue(request("/api/ai/analyze", { storyId: saved.data.id, storyText: "Forged input" }))).status).toBe(409);
    expect((await db.query("SELECT status,attempts FROM ai_jobs")).rows).toEqual([{ status: "failed", attempts: 1 }]);
  });
  it("returns joined author and current metadata for mobile pattern clients", async () => {
    await save(request("/api/journal/save", { content: syntheticText }));
    await worker(request("/api/internal/ai-jobs", {}, process.env.AI_WORKER_SECRET));
    const response = await stories(new NextRequest("http://localhost/api/stories", { headers: { Authorization: "Bearer synthetic-owner" } }));
    const body = await response.json(); expect(body.stories[0].author.id).toBe(owner); expect(body.stories[0].story_metadata.themes).toEqual(analysisOutput.themes);
  });
  it("reflects an empty week and fails on missing persistence instead of temporary success", async () => {
    fixture.generate.mockResolvedValue({ response: { text: () => JSON.stringify({ reflection_text: "You can start a short note.", themes_identified: [], dominant_tone: "hopeful", dominant_domain: "growth" }) } });
    expect((await reflection(request("/api/ai/reflection", {}))).status).toBe(200);
    expect(fixture.generate.mock.calls[0][0]).toContain("not recorded any journal entries");
    expect((await reflection(request("/api/ai/reflection", {}))).status).toBe(429);
  });
});
