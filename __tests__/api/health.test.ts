import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

afterEach(() => vi.unstubAllEnvs());
describe("release identity", () => {
  it("returns the complete commit and prevents cached release checks", async () => {
    const sha = "1234567890abcdef1234567890abcdef12345678";
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    vi.stubEnv("APP_ENV", "staging");
    const response = await GET();
    expect(await response.json()).toMatchObject({ version: sha.slice(0, 7), commitSha: sha, environment: "staging" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([undefined, "1234567", "unknown"])("does not claim a verifiable artifact for %s", async value => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", value);
    expect(await (await GET()).json()).toMatchObject({ version: "dev", commitSha: null });
  });
});
