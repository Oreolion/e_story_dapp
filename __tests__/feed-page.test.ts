import { describe, expect, it } from "vitest";
import {
  cursorFilter,
  encodeFeedCursor,
  feedPageInput,
  feedSearchFilter,
} from "@/lib/stories/feed-page";
describe("bounded feed requests", () => {
  it("quotes filter punctuation and escapes regex operators for literal substring matching", () => {
    const text = String.raw`a.b(hello),"quote"\*_%`;
    const value = JSON.stringify(String.raw`a\.b\(hello\),"quote"\\\*_%`);
    expect(feedSearchFilter(text)).toBe(
      `title.imatch.${value},content.imatch.${value}`,
    );
    const literal = new RegExp(JSON.parse(value), "i");
    expect(literal.test(`Before ${text.toUpperCase()} after`)).toBe(true);
    expect(literal.test('aXbhello,"quote"anything')).toBe(false);
    expect(() =>
      feedPageInput(new URLSearchParams({ q: "bad\u0000input" })),
    ).toThrow();
  });
  it("defaults to twenty records and preserves microsecond precision for equal-time paging", () => {
    expect(feedPageInput(new URLSearchParams()).limit).toBe(20);
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-11-27T10:00:00.123456+00:00",
    };
    const input = feedPageInput(
      new URLSearchParams({ cursor: encodeFeedCursor(row) }),
    );
    expect(input.cursor).toEqual(row);
    expect(cursorFilter(input.cursor!)).toContain(
      `and(created_at.eq.${row.created_at},id.lt.${row.id})`,
    );
  });
  it("accepts a null timestamp only with a valid story identity", () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: null,
    };
    expect(
      feedPageInput(new URLSearchParams({ cursor: encodeFeedCursor(row) }))
        .cursor,
    ).toEqual(row);
    expect(cursorFilter(row)).toBe(
      `and(created_at.is.null,id.lt.${row.id}),created_at.not.is.null`,
    );
  });
  it.each(["0", "51", "-1", "1.5", "100000", "20junk"])(
    "rejects an unbounded/invalid page size %s",
    (limit) =>
      expect(() => feedPageInput(new URLSearchParams({ limit }))).toThrow(),
  );
  it.each<Record<string, string>>([
    { cursor: "bad" },
    {
      cursor: encodeFeedCursor({
        id: "x),is_public.eq.false",
        created_at: "now",
      }),
    },
    { scope: "private" },
    { q: "x".repeat(81) },
  ])("rejects malformed cursor and filter input: %j", (params) =>
    expect(() => feedPageInput(new URLSearchParams(params))).toThrow(),
  );
});
