import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ owner: "owner-a" as string | null, token: vi.fn() }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ profile: auth.owner ? { id: auth.owner } : null, getAccessToken: auth.token }) }));
import { useStoryMetadata } from "@/app/hooks/useStoryMetadata";
beforeEach(() => { auth.owner = "owner-a"; auth.token.mockReset().mockResolvedValue("synthetic-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("owned insight status client", () => {
  it("does not poll or submit retries while provider setup is required", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => Response.json({ metadata: null, analysis: { status: "disabled", error_code: "AI_PROVIDER_SETUP_REQUIRED" } }));
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() => useStoryMetadata("story-a"));
    await act(async () => { await vi.advanceTimersByTimeAsync(200000); });
    expect(result.current.analysis.status).toBe("disabled");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await result.current.queueAnalysis(true)).toBe(false); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    unmount();
  });
  it("switches to an actionable held state when generation is disabled after loading", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("/analyze")
      ? Response.json({ code: "AI_PROVIDER_SETUP_REQUIRED" }, { status: 503 })
      : Response.json({ metadata: null, analysis: { status: "unavailable" } }));
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() => useStoryMetadata("story-a"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { expect(await result.current.queueAnalysis()).toBe(false); });
    expect(result.current.analysis.status).toBe("disabled");
    expect(result.current.error).toBeNull();
    unmount();
  });
  it("authenticates metadata reads and clears data on account switch", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ metadata: { brief_insight: "Synthetic private insight" }, analysis: { status: "succeeded" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender, unmount } = renderHook(() => useStoryMetadata("story-a"));
    await waitFor(() => expect(result.current.metadata?.brief_insight).toBe("Synthetic private insight"));
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
    await act(async () => { auth.owner = null; rerender(); });
    expect(result.current.metadata).toBeNull(); unmount();
  });
  it("polls queued work with a fixed request limit and never claims completion", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ metadata: null, analysis: { status: "queued" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() => useStoryMetadata("story-a"));
    await act(async () => { await vi.advanceTimersByTimeAsync(200000); });
    expect(fetcher).toHaveBeenCalledTimes(24); expect(result.current.analysis.status).toBe("queued"); expect(result.current.metadata).toBeNull();
    unmount();
  });
  it("ignores a response arriving after the owner changes", async () => {
    let release: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
    const { result, rerender, unmount } = renderHook(() => useStoryMetadata("story-a"));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { auth.owner = null; rerender(); release(new Response(JSON.stringify({ metadata: { brief_insight: "Old owner" }, analysis: { status: "succeeded" } }))); });
    expect(result.current.metadata).toBeNull(); unmount();
  });
});
