import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FixtureDatabase } from "../../evals/support/database";
// Original inline implementation tests are preserved byte-for-byte at
// docs/test-history/analyze-inline-before-durable-jobs.ts.txt.
const owner = "00000000-0000-4000-8000-000000000011", storyId = "00000000-0000-4000-8000-000000000012";
const state = vi.hoisted(() => ({ db: null as unknown as FixtureDatabase, rpc: vi.fn(), actor: "00000000-0000-4000-8000-000000000011" as string | Response }));
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: async () => state.actor, isAuthError: (value: unknown) => value instanceof Response, resolveUserId: async (value: string) => value }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => ({ from: (table: string) => state.db.from(table), rpc: state.rpc }) }));
import { POST } from "@/app/api/ai/analyze/route";
function request(body: unknown) { return new NextRequest("http://localhost/api/ai/analyze", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => {
  state.db = new FixtureDatabase(); state.actor = owner;
  state.db.rows("stories").push({ id: storyId, author_id: owner, revision: 1, content: "A synthetic story with enough characters for a real analysis job." });
  state.rpc.mockReset().mockResolvedValue({ data: { id: "synthetic-job", status: "queued" }, error: null });
});
describe("analysis scheduling contract", () => {
  it("schedules canonical stored text and returns accepted rather than false completion", async () => {
    const response = await POST(request({ storyId }));
    expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ success: true, status: "queued" });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("ensure_ai_job", { p_owner_id: owner, p_story_id: storyId });
  });
  it("does not re-execute a completed job", async () => {
    state.rpc.mockResolvedValue({ data: { id: "synthetic-job", status: "succeeded" }, error: null });
    state.db.rows("story_metadata").push({ story_id: storyId, source_revision: 1, brief_insight: "Persisted insight" });
    expect((await POST(request({ storyId }))).status).toBe(200);
  });
  it("does not let an old inline client mistake a queued job for completed metadata", async () => {
    const response = await POST(request({ storyId, storyText: "Forged client content", storyType: "invented" }));
    expect(response.ok).toBe(false);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ANALYSIS_PENDING", status: "queued", error: expect.stringContaining("Refresh") });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("ensure_ai_job", { p_owner_id: owner, p_story_id: storyId });
  });
  it("returns persisted current-revision metadata to a completed legacy consumer", async () => {
    state.rpc.mockResolvedValue({ data: { id: "synthetic-job", status: "succeeded" }, error: null });
    const metadata = { story_id: storyId, source_revision: 1, brief_insight: "Persisted insight" };
    state.db.rows("story_metadata").push(metadata);
    const response = await POST(request({ storyId, storyText: "Untrusted replacement content" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, status: "succeeded", metadata });
  });
  it("does not return false completion when persisted metadata is missing or stale", async () => {
    state.rpc.mockResolvedValue({ data: { id: "synthetic-job", status: "succeeded" }, error: null });
    state.db.rows("story_metadata").push({ story_id: storyId, source_revision: 0, brief_insight: "Old insight" });
    expect((await POST(request({ storyId, storyText: "Old caller" }))).status).toBe(503);
  });
  it.each([{}, { storyId: "invalid" }, null])("rejects malformed scheduling input", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("denies anonymous requests", async () => {
    state.actor = new Response(null, { status: 401 }); expect((await POST(request({ storyId }))).status).toBe(401); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("denies other-owner requests before queue mutation", async () => {
    state.actor = "00000000-0000-4000-8000-000000000099";
    expect((await POST(request({ storyId }))).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects missing and short canonical stories", async () => {
    expect((await POST(request({ storyId: "00000000-0000-4000-8000-000000000098" }))).status).toBe(404);
    state.db.rows("stories")[0].content = "Short";
    expect((await POST(request({ storyId, storyText: "x".repeat(100) }))).status).toBe(400); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("reports unavailable scheduling without implying a queued or completed result", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "Synthetic failure" } });
    expect((await POST(request({ storyId }))).status).toBe(503);
  });
  it("does not reserve analysis work for oversized grandfathered content", async () => {
    state.db.rows("stories")[0].content = "x".repeat(50_001);
    expect((await POST(request({ storyId, retry: true }))).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
