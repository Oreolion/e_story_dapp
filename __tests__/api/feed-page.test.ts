import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  encodeFeedCursor,
  cursorFilter,
  feedSearchFilter,
} from "@/lib/stories/feed-page";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth", () => ({ validateAuth: mocks.auth }));
vi.mock("@/app/utils/supabase/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));
import { paginatedFeed } from "@/lib/stories/paginated-feed";

const owner = "11111111-1111-4111-8111-111111111111";
const blocked = "22222222-2222-4222-8222-222222222222";
const row = {
  id: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-11-27T10:00:00.123456Z",
  author_id: owner,
  title: "A day",
  content: "Public words",
};
const results: Record<string, { data: any[] | null; error: unknown }> = {};
const queries: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
const request = (query = "") =>
  new NextRequest(
    `https://estories.app/api/stories/feed?pagination=cursor&${query}`,
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  for (const table of ["stories", "users", "user_blocks", "follows"]) {
    results[table] = {
      data:
        table === "stories"
          ? [row]
          : table === "users"
            ? [{ id: owner, name: "Writer" }]
            : [],
      error: null,
    };
    const chain: Record<string, any> = {};
    for (const method of [
      "select",
      "eq",
      "or",
      "order",
      "limit",
      "in",
      "not",
      "gt",
      "ilike",
    ])
      chain[method] = vi.fn(() => chain);
    chain.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(results[table]).then(resolve, reject);
    queries[table] = chain;
  }
  mocks.from.mockImplementation((table) => queries[table]);
});

describe("bounded public feed", () => {
  it("limits database work, orders ties, excludes private fields and disables shared caching", async () => {
    const response = await paginatedFeed(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(queries.stories.limit).toHaveBeenCalledWith(21);
    expect(queries.stories.eq).toHaveBeenCalledWith("is_public", true);
    expect(queries.stories.order.mock.calls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(queries.stories.select.mock.calls[0][0]).not.toContain("audio_url");
    expect(queries.users.select.mock.calls[0][0]).not.toMatch(
      /email|notification|subscription/,
    );
    expect(await response.json()).toMatchObject({
      stories: [
        { title: "A day", author: { name: "Writer" }, audio_url: null },
      ],
      nextCursor: null,
    });
  });
  it("uses one lookahead row and a stable cursor without returning it", async () => {
    results.stories.data = [row, { ...row, id: blocked }];
    const response = await paginatedFeed(request("limit=1"));
    const body = await response.json();
    expect(body.stories).toHaveLength(1);
    expect(body.nextCursor).toBe(encodeFeedCursor(row));
    await paginatedFeed(request(`limit=1&cursor=${body.nextCursor}`));
    expect(queries.stories.or).toHaveBeenCalledWith(
      `created_at.lt.${row.created_at},and(created_at.eq.${row.created_at},id.lt.${row.id})`,
    );
  });
  it("applies both directions of blocks before pagination and follows only the current viewer", async () => {
    mocks.auth.mockResolvedValue(owner);
    results.user_blocks.data = [{ blocker_id: blocked, blocked_id: owner }];
    results.follows.data = [{ following_id: blocked }];
    await paginatedFeed(request("scope=following"));
    expect(queries.user_blocks.limit).toHaveBeenCalledWith(1001);
    expect(queries.stories.not).toHaveBeenCalledWith(
      "author_id",
      "in",
      `(${blocked})`,
    );
    expect(queries.follows.eq).toHaveBeenCalledWith("follower_id", owner);
    expect(queries.stories.in).toHaveBeenCalledWith("author_id", [blocked]);
  });
  it("does not query stories for unauthenticated or empty Following", async () => {
    expect((await paginatedFeed(request("scope=following"))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue(owner);
    expect(
      await (await paginatedFeed(request("scope=following"))).json(),
    ).toEqual({ stories: [], nextCursor: null });
    expect(mocks.from).not.toHaveBeenCalledWith("stories");
  });
  it("fails closed when block lookup fails instead of displaying unfiltered or empty success", async () => {
    mocks.auth.mockResolvedValue(owner);
    results.user_blocks.error = { message: "private database detail" };
    const response = await paginatedFeed(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private database detail",
    );
    expect(mocks.from).not.toHaveBeenCalledWith("stories");
  });
  it("rejects invalid filters before authentication or database access", async () => {
    expect((await paginatedFeed(request("cursor=untrusted"))).status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("preserves literal title/body search and keeps trending bounded", async () => {
    await paginatedFeed(request("scope=trending&q=100%25_under"));
    expect(queries.stories.gt).toHaveBeenCalledWith("likes", 5);
    expect(queries.stories.or).toHaveBeenCalledWith(
      'title.imatch."100%_under",content.imatch."100%_under"',
    );
    expect(queries.stories.limit).toHaveBeenCalledWith(21);
  });
  it("combines search and cursor in one logic filter while retaining public and block restrictions", async () => {
    mocks.auth.mockResolvedValue(owner);
    results.user_blocks.data = [{ blocker_id: owner, blocked_id: blocked }];
    await paginatedFeed(request(`q=memory&cursor=${encodeFeedCursor(row)}`));
    expect(queries.stories.or).toHaveBeenCalledTimes(1);
    expect(queries.stories.or).toHaveBeenCalledWith(
      `and(or(${cursorFilter(row)}),or(${feedSearchFilter("memory")}))`,
    );
    expect(queries.stories.eq).toHaveBeenCalledWith("is_public", true);
    expect(queries.stories.not).toHaveBeenCalledWith(
      "author_id",
      "in",
      `(${blocked})`,
    );
  });
});
