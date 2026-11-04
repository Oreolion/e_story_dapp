import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import { SignJWT } from "jose";
import { createPostgresFixture, postgresAdmin } from "./support/postgres";
import { analysisOutput } from "./fixtures";

const state = vi.hoisted(() => ({ admin: null as unknown as ReturnType<typeof postgresAdmin> }));
// Replace storage transport, not the application's cookie/JWT authorization.
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => state.admin }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => state.admin }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }));
import { signWalletToken } from "@/lib/jwt";
import { POST as publish } from "@/app/api/ipfs/upload/route";
import { POST as save } from "@/app/api/stories/route";
import { POST as analyze } from "@/app/api/ai/analyze/route";

const owner = "00000000-0000-4000-8000-000000000011";
const other = "00000000-0000-4000-8000-000000000099";
const wallet = "0x" + "1".repeat(40);
const content = "A synthetic legacy story long enough to exercise durable analysis without any real inference.";
const key = "synthetic-legacy-test-signing-key-at-least-32-characters";
let db: PGlite;
let cookie: string;
beforeAll(async () => { db = await createPostgresFixture({ ownerType: "text" }); state.admin = postgresAdmin(db); }, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("TRUNCATE users CASCADE; TRUNCATE stories CASCADE;");
  await db.query("INSERT INTO users(id,wallet_address) VALUES($1,$2),($3,'synthetic-other')", [owner, wallet, other]);
  vi.stubEnv("WALLET_JWT_SECRET", key);
  vi.stubEnv("PINATA_JWT", "synthetic-pinning-placeholder");
  cookie = `estory_wallet_token=${await signWalletToken(owner, wallet)}`;
});
function json(path: string, body: unknown, auth = cookie) {
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: auth }, body: JSON.stringify(body) });
}

describe("deployed web caller compatibility with actual wallet JWT verification", () => {
  it.each([false, true])("preserves the legacy upload-then-save sequence (public=%s)", async isPublic => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ IpfsHash: "synthetic-public-cid" })));
    const form = new FormData();
    form.set("metadata", JSON.stringify({ title: "Legacy", content, author: wallet, is_public: isPublic, app: "EStories DApp" }));
    const upload = await publish(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", headers: { Cookie: cookie }, body: form }));
    expect(upload.ok).toBe(true);
    const pinned = await upload.json();
    const response = await save(json("/api/stories", { author_id: owner, author_wallet: wallet, title: "Legacy", content, is_public: isPublic, ipfs_hash: pinned.hash }));
    expect(response.status).toBe(200);
    expect((await db.query("SELECT is_public,ipfs_hash FROM stories")).rows[0]).toEqual({ is_public: isPublic, ipfs_hash: isPublic ? "synthetic-public-cid" : null });
    expect((await db.query("SELECT status FROM ai_jobs")).rows).toEqual([{ status: "queued" }]);
    expect(fetch).toHaveBeenCalledTimes(isPublic ? 1 : 0);
  });

  it("never signals inline completion until current metadata has committed", async () => {
    const saved = await (await save(json("/api/stories", { author_id: owner, title: "Legacy", content }))).json();
    const request = () => json("/api/ai/analyze", { storyId: saved.story.id, storyText: "Untrusted replacement" });
    const pending = await analyze(request());
    expect(pending.ok).toBe(false);
    expect(await pending.json()).toMatchObject({ code: "ANALYSIS_PENDING" });
    const job = (await db.query<{ id: string; lease_token: string }>("SELECT * FROM claim_ai_job(NULL)")).rows[0];
    await db.query("SELECT complete_ai_job($1,$2,$3::jsonb)", [job.id, job.lease_token, JSON.stringify(analysisOutput)]);
    const completed = await analyze(request());
    expect(completed.status).toBe(200);
    expect((await completed.json()).metadata.brief_insight).toBe(analysisOutput.brief_insight);
    expect((await db.query("SELECT attempts FROM ai_jobs")).rows).toEqual([{ attempts: 1 }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects missing, expired and other-owner credentials before changing another owner's story", async () => {
    const saved = await (await save(json("/api/stories", { author_id: owner, title: "Legacy", content }))).json();
    const body = { storyId: saved.story.id, storyText: content };
    expect((await analyze(json("/api/ai/analyze", body, ""))).status).toBe(401);
    const expired = await new SignJWT({ auth_method: "wallet", wallet }).setProtectedHeader({ alg: "HS256" }).setSubject(owner).setIssuer("estory").setAudience("estory-api").setExpirationTime(1).sign(new TextEncoder().encode(key));
    expect((await analyze(json("/api/ai/analyze", body, `estory_wallet_token=${expired}`))).status).toBe(401);
    const otherCookie = `estory_wallet_token=${await signWalletToken(other, "0x" + "9".repeat(40))}`;
    expect((await analyze(json("/api/ai/analyze", body, otherCookie))).status).toBe(403);
    expect((await db.query("SELECT status,attempts FROM ai_jobs")).rows).toEqual([{ status: "queued", attempts: 0 }]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
