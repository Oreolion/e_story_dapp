import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth", () => ({ validateAuthOrReject: async () => "owner", isAuthError: () => false, resolveUserId: async () => "owner" }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({ createSupabaseAdminClient: () => { throw new Error("Rejected publication must not reach storage"); } }));
import { POST } from "@/app/api/ipfs/upload/route";
import { POST as audio } from "@/app/api/audio/upload/route";
import { POST as compile } from "@/app/api/book/compile/route";
describe("public IPFS publication boundary", () => {
  it.each([
    { metadata: { content: "private", is_public: false }, visibility: "public" },
    { metadata: { content: "unspecified" }, visibility: "" },
  ])("rejects private or unconfirmed publication before provider access", async ({ metadata, visibility }) => {
    vi.stubEnv("PINATA_JWT", "synthetic-pinning-placeholder");
    const data = new FormData(); data.set("metadata", JSON.stringify(metadata));
    if (visibility) data.set("visibility", visibility);
    const result = await POST(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", body: data }));
    expect(result.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it("publishes explicitly public metadata through the controlled provider", async () => {
    vi.stubEnv("PINATA_JWT", "synthetic-pinning-placeholder");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ IpfsHash: "synthetic-public-cid" }), { status: 200 }));
    const data = new FormData(); data.set("visibility", "public"); data.set("metadata", JSON.stringify({ is_public: true, content: "Synthetic public entry" }));
    const response = await POST(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", body: data }));
    expect(response.status).toBe(200); expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
  });
  it("accepts the deployed web client's explicit public intent in metadata", async () => {
    vi.stubEnv("PINATA_JWT", "synthetic-pinning-placeholder");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ IpfsHash: "synthetic-public-cid" })));
    const data = new FormData();
    data.set("metadata", JSON.stringify({ title: "Public", content: "Synthetic public story", is_public: true, app: "EStories DApp" }));
    const response = await POST(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", body: data }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ hash: "synthetic-public-cid" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("lets a deployed private story save continue without publishing or inventing a CID", async () => {
    vi.stubEnv("PINATA_JWT", "");
    const data = new FormData();
    data.set("metadata", JSON.stringify({ title: "Private", content: "Synthetic private story", is_public: false, app: "EStories DApp" }));
    const response = await POST(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", body: data }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hash: null, url: null, published: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects legacy public metadata containing nested private content", async () => {
    const data = new FormData();
    data.set("metadata", JSON.stringify({ is_public: true, entries: [{ is_public: false, content: "Private" }] }));
    expect((await POST(new NextRequest("http://localhost/api/ipfs/upload", { method: "POST", body: data }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not publish private or unconfirmed audio", async () => {
    const data = new FormData(); data.set("file", new File([new Uint8Array([0x1a,0x45,0xdf,0xa3])], "synthetic.webm", { type: "audio/webm" }));
    expect((await audio(new NextRequest("http://localhost/api/audio/upload", { method: "POST", body: data }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not publish a book from an old request with no publication consent", async () => {
    const response = await compile(new NextRequest("http://localhost/api/book/compile", { method: "POST", body: JSON.stringify({ entryIds: ["00000000-0000-4000-8000-000000000012"], authorId: "owner" }) }));
    expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
});
