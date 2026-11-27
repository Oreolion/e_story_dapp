"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../components/Provider";
import { useAuth } from "../../components/AuthProvider";
import { useBackgroundMode } from "@/contexts/BackgroundContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Users, BookOpen, Search } from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { toast } from "react-hot-toast";
import { StoryCard } from "../../components/StoryCard";
import { StoryDataType } from "../types/index";
import { useEStoryToken } from "../hooks/useIStoryToken";
import { useStoryProtocol } from "../hooks/useStoryProtocol";
import { useAccount } from "wagmi";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";

// --- Types ---
interface AuthorProfile {
  id?: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  wallet_address: string | null;
  badges: string[] | null;
  followers: number;
  isFollowing: boolean;
}

export default function SocialPage({ home = false }: { home?: boolean }) {
  const { isConnected } = useApp();
  const { address } = useAccount();
  const { profile, getAccessToken, isLoading: isAuthLoading } = useAuth();
  const viewerKey = profile?.id ?? "anonymous";
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  // Set background mode for this page
  useBackgroundMode("social");

  // State
  const activeTab = ["feed", "trending", "following"].includes(
    params.get("tab") ?? "",
  )
    ? params.get("tab")!
    : "feed";
  const setActiveTab = (tab: string) =>
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  const [unlockedStories, setUnlockedStories] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const filter = `${viewerKey}:${activeTab}:${search}`;
  const [paging, setPaging] = useState<{
    filter: string;
    cursors: (string | null)[];
  }>({ filter: "", cursors: [null] });
  const cursors = paging.filter === filter ? paging.cursors : [null];
  const cursor = cursors[cursors.length - 1];

  // Hooks
  const eStoryToken = useEStoryToken();
  const { payPaywall } = useStoryProtocol();

  // ==============================
  // React Query Data Fetching
  // ==============================

  // 1. Fetch stories feed
  const {
    data: feedData,
    isLoading: isFeedLoading,
    isError: feedError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["stories", "feed", viewerKey, activeTab, search, cursor],
    queryFn: async () => {
      const token = await getAccessToken();
      const query = new URLSearchParams({
        pagination: "cursor",
        limit: "20",
        scope: activeTab === "feed" ? "latest" : activeTab,
        q: search,
      });
      if (cursor) query.set("cursor", cursor);
      return apiGet<{ stories: any[]; nextCursor: string | null }>(
        token,
        `/api/stories/feed?${query}`,
      );
    },
    enabled: !isAuthLoading && (activeTab !== "following" || !!profile),
    staleTime: 30_000,
  });

  const rawStories = feedData?.stories || [];

  // 2. Batch follow status (dependent on stories)
  const authorIds = useMemo(
    () =>
      [
        ...new Set(rawStories.map((s) => s.author?.id).filter(Boolean)),
      ] as string[],
    [rawStories],
  );

  const { data: followData } = useQuery({
    queryKey: ["social", "follow", "batch", viewerKey, authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return { following: {} };
      const token = await getAccessToken();
      return apiGet<{ following: Record<string, boolean> }>(
        token,
        `/api/social/follow?followed_ids=${authorIds.join(",")}`,
      );
    },
    enabled: authorIds.length > 0 && !isAuthLoading && !!profile,
    staleTime: 10_000,
  });

  // 3. Batch like status (dependent on stories)
  const storyIds = useMemo(() => rawStories.map((s) => s.id), [rawStories]);

  const { data: likeData } = useQuery({
    queryKey: ["social", "like", "batch", viewerKey, storyIds],
    queryFn: async () => {
      if (storyIds.length === 0) return { liked: {} };
      const token = await getAccessToken();
      return apiGet<{ liked: Record<string, boolean> }>(
        token,
        `/api/social/like/status?story_ids=${storyIds.join(",")}`,
      );
    },
    enabled: storyIds.length > 0 && !isAuthLoading && !!profile,
    staleTime: 10_000,
  });

  // 4. Build unified stories list with follow/like status
  const stories = useMemo<StoryDataType[]>(() => {
    const followingMap = followData?.following || {};
    const likedMap = likeData?.liked || {};

    return rawStories
      .filter((s: any) => s.author)
      .map((s: any) => {
        const author: AuthorProfile = {
          id: s.author.id,
          name: s.author.name || "Anonymous Writer",
          username: s.author.username || "writer",
          avatar: s.author.avatar,
          wallet_address: s.author.wallet_address,
          followers: s.author.followers_count ?? 0,
          badges: s.author.badges ?? [],
          isFollowing: followingMap[s.author.id] || false,
        };

        return {
          id: s.id,
          numeric_id: s.numeric_id ?? String(s.id),
          author,
          author_wallet: author,
          title: s.title ?? "Untitled Story",
          content: s.content ?? "",
          teaser: s.teaser,
          timestamp: s.created_at,
          likes: s.likes ?? 0,
          comments: s.comments_count ?? 0,
          shares: s.shares ?? 0,
          views: s.view_count ?? 0,
          hasAudio: s.has_audio ?? false,
          audio_url: s.audio_url,
          mood: s.mood || "neutral",
          tags: s.tags ?? [],
          paywallAmount: s.paywall_amount ?? 0,
          is_public: true,
          story_date: s.story_date || s.created_at,
          created_at: s.created_at,
          isLiked: likedMap[s.id] || false,
          isPaid: false,
        } as StoryDataType;
      });
  }, [rawStories, followData, likeData]);

  // ==============================
  // Mutations (Like / Follow)
  // ==============================

  const likeMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const token = await getAccessToken();
      return apiPost<{
        success: boolean;
        data: { isLiked: boolean; totalLikes: number };
      }>(token, "/api/social/like", { storyId });
    },
    onMutate: async (storyId) => {
      await qc.cancelQueries({ queryKey: ["social", "like", "batch"] });
      const previous = qc.getQueryData<{ liked: Record<string, boolean> }>([
        "social",
        "like",
        "batch",
        viewerKey,
        storyIds,
      ]);

      qc.setQueryData(
        ["social", "like", "batch", viewerKey, storyIds],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            liked: { ...old.liked, [storyId]: !old.liked?.[storyId] },
          };
        },
      );

      return { previous };
    },
    onError: (_err, _storyId, context) => {
      if (context?.previous) {
        qc.setQueryData(
          ["social", "like", "batch", viewerKey, storyIds],
          context.previous,
        );
      }
      toast.error("Like action failed");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["social", "like", "batch"] });
      qc.invalidateQueries({ queryKey: ["stories", "feed"] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (authorId: string) => {
      const token = await getAccessToken();
      return apiPost<{
        isFollowing: boolean;
        followers_count: number;
      }>(token, "/api/social/follow", { followed_id: authorId });
    },
    onMutate: async (authorId) => {
      await qc.cancelQueries({ queryKey: ["social", "follow", "batch"] });
      const previous = qc.getQueryData<{
        following: Record<string, boolean>;
      }>(["social", "follow", "batch", viewerKey, authorIds]);

      qc.setQueryData(
        ["social", "follow", "batch", viewerKey, authorIds],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            following: {
              ...old.following,
              [authorId]: !old.following?.[authorId],
            },
          };
        },
      );

      return { previous };
    },
    onError: (_err, _authorId, context) => {
      if (context?.previous) {
        qc.setQueryData(
          ["social", "follow", "batch", viewerKey, authorIds],
          context.previous,
        );
      }
      toast.error("Follow action failed");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["social", "follow", "batch"] });
    },
  });

  // ==============================
  // Event Handlers
  // ==============================

  const handleUnlock = async (storyNumericId: string) => {
    if (!isConnected || !address || !eStoryToken) {
      return toast.error("Please connect your wallet to unlock stories.");
    }

    const story = stories.find((s) => s.numeric_id === storyNumericId);
    if (!story || !story.author_wallet?.wallet_address) {
      return toast.error("Invalid story data");
    }

    try {
      toast.loading("Processing payment...", { id: "unlock-toast" });

      const authorAddress = story.author_wallet.wallet_address as string;

      await payPaywall(authorAddress, story.paywallAmount, story.numeric_id);

      setUnlockedStories((prev) => new Set(prev).add(String(story.id)));

      toast.success(`Unlocked! Paid ${story.paywallAmount} $ESTORY`, {
        id: "unlock-toast",
      });
    } catch (error: any) {
      console.error("Unlock error:", error);
      toast.error("Transaction failed", { id: "unlock-toast" });
    }
  };

  const handleLike = (storyId: string) => likeMutation.mutate(storyId);

  const handleFollow = (authorId: string) => {
    if (!authorId) return;
    followMutation.mutate(authorId);
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/story/${id}`;
    if (navigator.share) {
      navigator.share({ title: "Check out this story!", url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  // Filter Logic
  const filteredStories = stories;

  // --- Render ---

  const isLoading = isFeedLoading || isAuthLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <BrandedLoader size="md" message="Curating stories..." />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 mx-auto bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] rounded-full flex items-center justify-center shadow-lg"
        >
          <Users className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          {home ? (
            <>Your next chapter starts here.</>
          ) : (
            <>
              Discover <span className="text-gradient-memory">Stories</span>
            </>
          )}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {home
            ? "Read a new perspective. Revisit your archive. Put a little of your day into words."
            : "Explore narratives from storytellers preserving what matters"}
        </p>
      </div>

      {home && (
        <div className="rounded-2xl border border-l-[3px] border-l-[hsl(var(--story-500))] bg-card p-6 flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow">A space for your perspective</p>
            <p className="mt-2 text-lg font-medium break-words">
              {profile?.name
                ? `Welcome back, ${profile.name}.`
                : "What would you like to remember?"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/record">Create a story</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/library">Open your archive</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Center: Story Feed */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              aria-label="Search stories"
              maxLength={80}
              placeholder="Search titles or story text..."
              className="pl-10 bg-white/50 dark:bg-gray-800/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="feed">Latest</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="following">Following</TabsTrigger>
            </TabsList>

            {/* Feed Content */}
            <div className="space-y-6">
              {feedError ? (
                <div role="alert" className="rounded-xl border p-6">
                  <h2 className="font-semibold">
                    Stories are temporarily unavailable
                  </h2>
                  <p className="my-3 text-muted-foreground">
                    Try loading the feed again. Your archive is available
                    separately.
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Retry feed
                  </Button>
                </div>
              ) : activeTab === "following" && !profile ? (
                <p className="rounded-xl border p-6">
                  Log in to see stories from people you follow.
                </p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredStories.length > 0 ? (
                    filteredStories.map((story, index) => (
                      <motion.div
                        key={story.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          duration: 0.18,
                          delay: Math.min(index, 3) * 0.03,
                        }}
                      >
                        <StoryCard
                          linkTitle
                          story={{
                            ...story,
                            isPaid:
                              story.isPaid ||
                              unlockedStories.has(String(story.id)),
                          }}
                          onFollow={() => handleFollow(story.author?.id || "")}
                          onShare={() => handleShare(String(story.id))}
                          onLike={() => handleLike(String(story.id))}
                          onUnlock={() => handleUnlock(story.numeric_id)}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-16 text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold">
                        No stories found
                      </h3>
                      <p>
                        {search
                          ? "Try different words from the title or story."
                          : activeTab === "following"
                            ? "Follow a writer in Discover to find their next story here."
                            : "A quiet moment is a good place to begin."}
                      </p>
                      <Button asChild variant="outline" className="mt-4">
                        <Link
                          href={
                            activeTab === "following" ? "/social" : "/record"
                          }
                        >
                          {activeTab === "following"
                            ? "Discover writers"
                            : "Create a story"}
                        </Link>
                      </Button>
                    </div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </Tabs>
          <nav
            aria-label="Feed pages"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              disabled={cursors.length < 2 || isFetching}
              onClick={() =>
                setPaging({ filter, cursors: cursors.slice(0, -1) })
              }
            >
              Previous stories
            </Button>
            <span className="text-xs text-muted-foreground" role="status">
              Page {cursors.length}
              {isFetching ? " - Loading..." : ""}
            </span>
            <Button
              variant="outline"
              disabled={!feedData?.nextCursor || isFetching || feedError}
              onClick={() =>
                setPaging({
                  filter,
                  cursors: [...cursors, feedData!.nextCursor],
                })
              }
            >
              Next stories
            </Button>
          </nav>
        </div>

        <aside
          className="min-w-0 space-y-6"
          aria-label="Your storytelling space"
        >
          <div className="rounded-2xl border bg-card p-6 lg:sticky lg:top-28">
            <p className="eyebrow">There is a story in the everyday</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Keep a moment. Find a thread.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A conversation that stayed with you. A place you remember.
              Something you see differently now.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href="/record">Start with your own words</Link>
            </Button>
            <div className="mt-6 border-t pt-4 text-sm space-y-4">
              <Link
                className="block underline underline-offset-4"
                href="/library"
              >
                Revisit your archive
              </Link>
              <Link
                className="block underline underline-offset-4"
                href="/welcome"
              >
                The idea behind eStories
              </Link>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Your private entries stay in your archive. Only stories chosen for
              publication appear in this feed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
