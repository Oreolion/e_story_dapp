import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuth } from "@/lib/auth";
import {
  cursorFilter,
  encodeFeedCursor,
  feedPageInput,
  feedSearchFilter,
} from "./feed-page";

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const safeIds = (values: string[]) => {
  if (
    values.length > 1000 ||
    values.some((value) => !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
  )
    throw new Error("Feed filter unavailable");
  return values;
};
export async function paginatedFeed(req: NextRequest) {
  let input: ReturnType<typeof feedPageInput>;
  try {
    input = feedPageInput(req.nextUrl.searchParams);
  } catch {
    return reply({ error: "Invalid feed request" }, 400);
  }
  try {
    const viewer = await validateAuth(req);
    if (input.scope === "following" && !viewer)
      return reply(
        { error: "Sign in to see stories from people you follow" },
        401,
      );
    const admin = createSupabaseAdminClient();
    let blocked: string[] = [];
    if (viewer) {
      const { data, error } = await admin
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${viewer},blocked_id.eq.${viewer}`)
        .limit(1001);
      if (error) throw new Error("Feed filter unavailable");
      blocked = safeIds(
        (data ?? []).map((row) =>
          row.blocker_id === viewer ? row.blocked_id : row.blocker_id,
        ),
      );
    }
    let following: string[] | null = null;
    if (input.scope === "following") {
      const { data, error } = await admin
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewer!)
        .limit(1001);
      if (error) throw new Error("Following unavailable");
      following = safeIds((data ?? []).map((row) => row.following_id));
      if (!following.length) return reply({ stories: [], nextCursor: null });
    }
    let query = admin
      .from("stories")
      .select(
        "id, numeric_id, title, content, created_at, likes, comments_count, shares, has_audio, mood, tags, paywall_amount, teaser, is_public, author_id, author_wallet, story_date, view_count",
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);
    if (blocked.length)
      query = query.not("author_id", "in", `(${blocked.join(",")})`);
    if (following) query = query.in("author_id", following);
    if (input.scope === "trending") query = query.gt("likes", 5);
    const cursor = input.cursor ? cursorFilter(input.cursor) : null;
    const search = input.search ? feedSearchFilter(input.search) : null;
    const filter =
      cursor && search
        ? `and(or(${cursor}),or(${search}))`
        : (cursor ?? search);
    if (filter) query = query.or(filter);
    const { data, error } = await query;
    if (error) throw new Error("Feed unavailable");
    const rows = (data ?? []).slice(0, input.limit);
    const ids = [...new Set(rows.map((row) => row.author_id).filter(Boolean))];
    const authors = ids.length
      ? await admin
          .from("users")
          .select(
            "id, name, username, avatar, wallet_address, followers_count, badges",
          )
          .in("id", ids)
      : { data: [], error: null };
    if (authors.error) throw new Error("Authors unavailable");
    const byId = new Map(
      (authors.data ?? []).map((author) => [author.id, author]),
    );
    return reply({
      stories: rows.map((row) => ({
        ...row,
        audio_url: null,
        author: byId.get(row.author_id) ?? null,
      })),
      nextCursor:
        (data?.length ?? 0) > input.limit && rows.length
          ? encodeFeedCursor(rows[rows.length - 1])
          : null,
    });
  } catch {
    // Never log story content or arbitrary upstream exceptions.
    return reply(
      { error: "Stories are temporarily unavailable. Please retry." },
      503,
    );
  }
}
