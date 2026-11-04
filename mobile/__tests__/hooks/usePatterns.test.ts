import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ auth: { isAuthenticated: true, user: { id: "owner-a" } as { id: string } | null }, get: vi.fn() }));
vi.mock("../../stores/authStore", () => ({ useAuthStore: () => state.auth }));
vi.mock("../../lib/api", () => ({ apiGet: state.get }));
import { usePatterns } from "../../hooks/usePatterns";
const story = (id: string) => ({ id, created_at: "2026-10-28T00:00:00Z", story_metadata: { themes: ["work"], life_domain: "work", emotional_tone: "neutral", significance_score: 0.5 } });
beforeEach(() => { state.auth = { isAuthenticated: true, user: { id: "owner-a" } }; state.get.mockReset(); });
describe("owner-scoped mobile patterns", () => {
  it("combines bounded pages and deduplicates stable story IDs", async () => {
    state.get.mockResolvedValueOnce({ ok: true, data: { stories: [story("one")], nextOffset: 100 } }).mockResolvedValueOnce({ ok: true, data: { stories: [story("one"), story("two")], nextOffset: null } });
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stories.map(row => row.id)).toEqual(["one", "two"]);
    expect(state.get).toHaveBeenNthCalledWith(2, "/api/stories?limit=100&offset=100");
  });
  it("discards an old owner's late response after switching accounts", async () => {
    let resolveOld!: (value: unknown) => void;
    state.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ ok: true, data: { stories: [story("new-owner")], nextOffset: null } });
    const { result, rerender } = renderHook(() => usePatterns());
    state.auth = { isAuthenticated: true, user: { id: "owner-b" } }; rerender();
    await waitFor(() => expect(result.current.stories[0]?.id).toBe("new-owner"));
    await act(async () => { resolveOld({ ok: true, data: { stories: [story("old-owner")], nextOffset: null } }); });
    expect(result.current.stories.map(row => row.id)).toEqual(["new-owner"]);
    state.auth = { isAuthenticated: false, user: null }; rerender();
    expect(result.current.stories).toEqual([]);
  });
  it("does not report partial aggregates when a later page fails", async () => {
    state.get.mockResolvedValueOnce({ ok: true, data: { stories: [story("one")], nextOffset: 100 } }).mockResolvedValueOnce({ ok: false, error: "Unavailable" });
    const { result } = renderHook(() => usePatterns());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stories).toEqual([]); expect(result.current.error).toBe("Unavailable");
  });
});
