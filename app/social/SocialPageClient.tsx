"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../components/Provider";
import { useAuth } from "../../components/AuthProvider";
import { useBackgroundMode } from "@/contexts/BackgroundContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Users,
  Star,
  BookOpen,
  Zap,
  Search,
} from "lucide-react";
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

export interface FeaturedWriterType {
  name: string;
  username: string;
  avatar: string;
  followers: number;
  stories: number;
  speciality: string;
}

// Mock data for sidebar (keep as requested)
const featuredWriters: FeaturedWriterType[] = [
  {
    name: "David Kim",
    username: "@davidk",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    followers: 2100,
    stories: 45,
    speciality: "Life Philosophy",
  },
  {
    name: "Anna Thompson",
    username: "@annat",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anna",
    followers: 1800,
    stories: 38,
    speciality: "Travel Adventures",
  },
  {
    name: "James Wilson",
    username: "@jamesw",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
    followers: 1450,
    stories: 52,
    speciality: "Tech Stories",
  },
];

export default function SocialPage() {
  const { isConnected } = useApp();
  const { address } = useAccount();
  const { getAccessToken, isLoading: isAuthLoading } = useAuth();
  const qc = useQueryClient();

  // Set background mode for this page
  useBackgroundMode("social");

  // State
  const [activeTab, setActiveTab] = useState("feed");
  const [unlockedStories, setUnlockedStories] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Hooks
  const eStoryToken = useEStoryToken();
  const { payPaywall } = useStoryProtocol();

  // ==============================
  // React Query Data Fetching
  // ==============================

  // 1. Fetch stories feed
  const { data: feedData, isLoading: isFeedLoading } = useQuery({
    queryKey: ["stories", "feed"],
    queryFn: async () => {
      const token = await getAccessToken();
      return apiGet<{ stories: any[] }>(token, "/api/stories/feed");
    },
    enabled: !isAuthLoading,
    staleTime: 30_000,
  });

  const rawStories = feedData?.stories || [];

  // 2. Batch follow status (dependent on stories)
  const authorIds = useMemo(
    () =>
      [...new Set(rawStories.map((s) => s.author?.id).filter(Boolean))] as string[],
    [rawStories]
  );

  const { data: followData } = useQuery({
    queryKey: ["social", "follow", "batch", authorIds],
    queryFn: async () => {
      if (authorIds.length === 0) return { following: {} };
      const token = await getAccessToken();
      return apiGet<{ following: Record<string, boolean> }>(
        token,
        `/api/social/follow?followed_ids=${authorIds.join(",")}`
      );
    },
    enabled: authorIds.length > 0 && !isAuthLoading,
    staleTime: 10_000,
  });

  // 3. Batch like status (dependent on stories)
  const storyIds = useMemo(
    () => rawStories.map((s) => s.id),
    [rawStories]
  );

  const { data: likeData } = useQuery({
    queryKey: ["social", "like", "batch", storyIds],
    queryFn: async () => {
      if (storyIds.length === 0) return { liked: {} };
      const token = await getAccessToken();
      return apiGet<{ liked: Record<string, boolean> }>(
        token,
        `/api/social/like/status?story_ids=${storyIds.join(",")}`
      );
    },
    enabled: storyIds.length > 0 && !isAuthLoading,
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
          username:
            s.author.username ||
            `@user${s.author.wallet_address?.slice(0, 4)}`,
          avatar: s.author.avatar,
          wallet_address: s.author.wallet_address,
          followers: s.author.followers_count ?? 0,
          badges: s.author.badges ?? ["Storyteller"],
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
          tags: s.tags && s.tags.length > 0 ? s.tags : ["life", "story"],
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
        storyIds,
      ]);

      qc.setQueryData(["social", "like", "batch", storyIds], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          liked: { ...old.liked, [storyId]: !old.liked?.[storyId] },
        };
      });

      return { previous };
    },
    onError: (_err, _storyId, context) => {
      if (context?.previous) {
        qc.setQueryData(
          ["social", "like", "batch", storyIds],
          context.previous
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
      }>(["social", "follow", "batch", authorIds]);

      qc.setQueryData(["social", "follow", "batch", authorIds], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          following: {
            ...old.following,
            [authorId]: !old.following?.[authorId],
          },
        };
      });

      return { previous };
    },
    onError: (_err, _authorId, context) => {
      if (context?.previous) {
        qc.setQueryData(
          ["social", "follow", "batch", authorIds],
          context.previous
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

  const handleLike = (storyNumericId: string) => {
    const story = stories.find((s) => s.numeric_id === storyNumericId);
    if (!story) return;
    likeMutation.mutate(String(story.id));
  };

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
  const filteredStories = stories.filter((story) => {
    const matchesSearch =
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "trending") return matchesSearch && story.likes > 5;
    if (activeTab === "following")
      return matchesSearch && story.author_wallet?.isFollowing;

    return matchesSearch;
  });

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
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
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
          Discover <span className="text-gradient-memory">Stories</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Explore narratives from storytellers preserving what matters
        </p>
      </div>

      {/* Stats Bar */}
      <Card className="card-elevated bg-[hsl(var(--memory-500)/0.05)] border-[hsl(var(--memory-500)/0.2)]">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <BookOpen className="w-6 h-6 mx-auto text-[hsl(var(--memory-500))]" />
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {stories.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Published Stories
              </div>
            </div>
            <div className="text-center space-y-2">
              <Users className="w-6 h-6 mx-auto text-[hsl(var(--insight-500))]" />
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {new Set(stories.map((s) => s.author?.id).filter(Boolean)).size}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Writers
              </div>
            </div>
            <div className="text-center space-y-2">
              <TrendingUp className="w-6 h-6 mx-auto text-[hsl(var(--growth-500))]" />
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                #mindful
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Trending
              </div>
            </div>
            <div className="text-center space-y-2">
              <Star className="w-6 h-6 mx-auto text-[hsl(var(--story-500))]" />
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isConnected && eStoryToken?.balance !== undefined
                  ? `${Number(eStoryToken.balance / BigInt(1e18)).toFixed(0)}`
                  : "0"}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Your $ESTORY
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Center: Story Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search stories or tags..."
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
              <AnimatePresence mode="popLayout">
                {filteredStories.length > 0 ? (
                  filteredStories.map((story, index) => (
                    <motion.div
                      key={story.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link href={`/story/${story.id}`} passHref>
                        <StoryCard
                          story={{
                            ...story,
                            isPaid:
                              story.isPaid ||
                              unlockedStories.has(String(story.id)),
                          }}
                          onFollow={() =>
                            handleFollow(story.author?.id || "")
                          }
                          onShare={() => handleShare(String(story.id))}
                          onLike={() => handleLike(String(story.numeric_id))}
                          onUnlock={() => handleUnlock(story.numeric_id)}
                        />
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold">No stories found</h3>
                    <p>Be the first to share your story!</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </Tabs>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Featured Writers */}
          <Card className="card-elevated sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-[hsl(var(--story-500))]" />
                <span>Featured Writers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {featuredWriters.map((writer) => (
                <div
                  key={writer.username}
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10 border-2 border-transparent group-hover:border-[hsl(var(--memory-400))] transition-all">
                      <AvatarImage src={writer.avatar} alt={writer.name || "Writer"} />
                      <AvatarFallback>{writer.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{writer.name}</div>
                      <div className="text-xs text-gray-500">
                        {writer.speciality}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs">
                    Follow
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Trending Topics */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-[hsl(var(--growth-500))]" />
                <span>Trending Topics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  "#mindfulness",
                  "#tech",
                  "#travel",
                  "#wellness",
                  "#crypto",
                  "#dreams",
                  "#nature",
                  "#future",
                ].map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-[hsl(var(--memory-500)/0.15)] transition-colors"
                    onClick={() => setSearchQuery(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Community Impact */}
          <Card className="card-elevated bg-[hsl(var(--growth-500)/0.05)] border-[hsl(var(--growth-500)/0.2)]">
            <CardHeader>
              <CardTitle className="text-lg text-gradient-growth">Community Impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Total Paid
                </span>
                <span className="font-bold text-[hsl(var(--growth-500))]">
                  45.2K $ESTORY
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Shared
                </span>
                <span className="font-bold text-[hsl(var(--growth-600))]">12.5K Stories</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
