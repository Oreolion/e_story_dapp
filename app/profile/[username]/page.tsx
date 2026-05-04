import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import PublicProfileClient from "./PublicProfileClient";

interface PublicUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  created_at: string;
  followers_count: number;
  badges: string[] | null;
}

interface PublicStory {
  id: string;
  numeric_id: string | null;
  title: string;
  content: string;
  created_at: string;
  likes: number;
  comments_count: number;
  shares: number;
  view_count: number;
  mood: string;
  tags: string[];
  has_audio: boolean;
  teaser: string | null;
  story_date: string | null;
}

async function fetchPublicProfile(
  username: string
): Promise<{ user: PublicUser; stories: PublicStory[]; booksCount: number } | null> {
  const admin = createSupabaseAdminClient();

  // Fetch user by username (case-insensitive)
  const { data: user, error: userErr } = await admin
    .from("users")
    .select(
      "id, name, username, avatar, bio, location, website, created_at, followers_count, badges"
    )
    .ilike("username", username)
    .maybeSingle();

  if (userErr || !user) {
    return null;
  }

  // Fetch public stories
  const { data: stories, error: storiesErr } = await admin
    .from("stories")
    .select(
      "id, numeric_id, title, content, created_at, likes, comments_count, shares, view_count, mood, tags, has_audio, teaser, story_date"
    )
    .eq("author_id", user.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (storiesErr) {
    console.error("[PublicProfile] stories fetch error:", storiesErr);
  }

  // Fetch books count
  const { count: booksCount, error: booksErr } = await admin
    .from("books")
    .select("*", { count: "exact", head: true })
    .eq("author_id", user.id);

  if (booksErr) {
    console.error("[PublicProfile] books count error:", booksErr);
  }

  return {
    user: user as PublicUser,
    stories: (stories || []) as PublicStory[],
    booksCount: booksCount || 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const result = await fetchPublicProfile(username);

  if (!result) {
    return {
      title: "Profile Not Found | eStories",
    };
  }

  const { user } = result;
  const displayName = user.name || user.username || "Writer";

  return {
    title: `${displayName} (@${user.username}) | eStories`,
    description: user.bio || `View ${displayName}'s stories and achievements on eStories.`,
    openGraph: {
      title: `${displayName} | eStories`,
      description: user.bio || `View ${displayName}'s stories on eStories.`,
      images: user.avatar ? [user.avatar] : undefined,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const result = await fetchPublicProfile(username);

  if (!result) {
    notFound();
  }

  return (
    <PublicProfileClient
      user={result.user}
      stories={result.stories}
      booksCount={result.booksCount}
    />
  );
}
